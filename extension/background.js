/**
 * =========================================================================
 * 🚀 BACKGROUND SERVICE WORKER (MANIFEST V3)
 * INVERSIONES FB PARTS - RASTREADOR AUTOMÁTICO DE GUÍAS DE ENVÍO
 * =========================================================================
 */

import {
    CARRIERS_CONFIG,
    ESTADOS_ESTANDAR,
    detectarCarrier,
    construirUrlRastreo,
    normalizarEstatus
} from './config/carriers.js';

// Configuración de Firebase
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
    projectId: "fb-parts-app"
};
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// Estado de ejecución en memoria
let _rastreoEnProgreso = false;
let _cancelarRastreo = false;

// =========================================================================
// 1. HELPERS DE FIRESTORE REST API (LIVIANOS Y NATIVOS PARA SERVICE WORKER)
// =========================================================================

function parseFirestoreValue(val) {
    if (!val || typeof val !== 'object') return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('timestampValue' in val) return val.timestampValue;
    if ('nullValue' in val) return null;
    if ('mapValue' in val) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            obj[k] = parseFirestoreValue(v);
        }
        return obj;
    }
    if ('arrayValue' in val) {
        return (val.arrayValue.values || []).map(parseFirestoreValue);
    }
    return null;
}

function parseFirestoreDoc(doc) {
    if (!doc || !doc.fields) return null;
    const res = { id: doc.name.split('/').pop(), _docName: doc.name };
    for (const [key, valObj] of Object.entries(doc.fields)) {
        res[key] = parseFirestoreValue(valObj);
    }
    return res;
}

function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: val.toString() };
        return { doubleValue: val };
    }
    if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
            fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

/**
 * Consulta pedidos activos desde Firestore
 */
async function obtenerPedidosPendientesFirestore() {
    try {
        const url = `${FIRESTORE_BASE_URL}/pedidos?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            console.error("Error al consultar pedidos en Firestore:", resp.status, resp.statusText);
            return [];
        }
        const data = await resp.json();
        const docs = data.documents || [];
        const pedidos = docs.map(parseFirestoreDoc).filter(Boolean);

        // Filtrar pedidos que tengan guías pendientes por entregar
        return pedidos.filter(ped => {
            const estadoGlobal = (ped.estado || '').toLowerCase();
            if (estadoGlobal === 'cancelado' || estadoGlobal === 'entregado') {
                return false;
            }

            // Verificar si tiene guías en guiasEnvio
            if (Array.isArray(ped.guiasEnvio) && ped.guiasEnvio.length > 0) {
                return ped.guiasEnvio.some(g => (g.estadoRastreo || '').toUpperCase() !== ESTADOS_ESTANDAR.ENTREGADO);
            }

            // O si tiene tracking/trackingMotorizado clásico y estado Despachado/Procesando
            const tracking = ped.tracking || ped.trackingMotorizado || ped.ultimaGuiaAsignada;
            const envioTexto = (ped.envio || '').toLowerCase();
            const esEncomienda = !envioTexto.includes('retiro') && !envioTexto.includes('local');
            return Boolean(tracking && esEncomienda);
        });
    } catch (e) {
        console.error("Fallo obteniendo pedidos de Firestore:", e);
        return [];
    }
}

/**
 * Actualiza los campos de un pedido en Firestore mediante PATCH
 */
async function actualizarPedidoFirestore(docId, camposActualizados, fieldPaths) {
    try {
        const params = new URLSearchParams();
        fieldPaths.forEach(fp => params.append('updateMask.fieldPaths', fp));
        params.append('key', FIREBASE_CONFIG.apiKey);

        const url = `${FIRESTORE_BASE_URL}/pedidos/${docId}?${params.toString()}`;
        const fields = {};
        for (const [k, v] of Object.entries(camposActualizados)) {
            fields[k] = toFirestoreValue(v);
        }

        const resp = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
        });

        if (!resp.ok) {
            const errTxt = await resp.text();
            console.error(`Error actualizando pedido ${docId} en Firestore:`, errTxt);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`Excepción actualizando pedido ${docId}:`, e);
        return false;
    }
}

// =========================================================================
// 2. MOTOR HÍBRIDO DE RASTREO (TAB EN SEGUNDO PLANO O FETCH DIRECTO)
// =========================================================================

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Consulta un portal de encomienda abriendo una pestaña en background
 */
async function consultarGuiaViaTab(carrier, numeroGuia) {
    const url = construirUrlRastreo(carrier, numeroGuia);
    if (!url) return { exito: false, texto: '', error: 'URL inválida' };

    let tab = null;
    try {
        tab = await chrome.tabs.create({ url, active: false });

        // Esperar a que la pestaña termine de cargar inicialmente
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 12000); // 12s timeout máx

            function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    clearTimeout(timeout);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            }
            chrome.tabs.onUpdated.addListener(listener);
        });

        // Esperar unos ms adicionales para renderizado dinámico de la página SPA
        await esperar(carrier.waitMs || 2500);

        // Inyectar script para extraer el texto renderizado
        const injection = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (selector) => {
                const el = selector ? document.querySelector(selector) : document.body;
                return el ? el.innerText : document.body.innerText;
            },
            args: [carrier.resultSelector || 'body']
        });

        const texto = (injection && injection[0] && injection[0].result) ? injection[0].result : '';
        return { exito: true, texto, url };
    } catch (e) {
        console.error(`Error consultando pestaña para guía ${numeroGuia}:`, e);
        return { exito: false, texto: '', error: e.message, url };
    } finally {
        if (tab && tab.id) {
            try {
                await chrome.tabs.remove(tab.id);
            } catch (err) {
                // Pestaña ya cerrada
            }
        }
    }
}

/**
 * Consulta vía fetch directo si la agencia devuelve HTML estático
 */
async function consultarGuiaViaFetch(carrier, numeroGuia) {
    const url = construirUrlRastreo(carrier, numeroGuia);
    if (!url) return { exito: false, texto: '', error: 'URL inválida' };

    try {
        const resp = await fetch(url, { headers: { 'Accept': 'text/html,application/xhtml+xml' } });
        if (!resp.ok) {
            return { exito: false, texto: '', error: `HTTP ${resp.status}`, url };
        }
        const html = await resp.text();
        // Quitar etiquetas HTML básicas para obtener texto
        const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        return { exito: true, texto, url };
    } catch (e) {
        return { exito: false, texto: '', error: e.message, url };
    }
}

/**
 * Disparador unificado de consulta por guía
 */
async function consultarGuiaPublica(carrier, numeroGuia) {
    if (carrier.modo === 'fetch') {
        return await consultarGuiaViaFetch(carrier, numeroGuia);
    }
    // Por defecto modo 'tab' (más robusto contra SPAs y JS dinámico)
    return await consultarGuiaViaTab(carrier, numeroGuia);
}

// =========================================================================
// 3. SECUENCIADOR Y REGLA MULTI-GUÍA CON PAUSA DE 2 SEGUNDOS
// =========================================================================

export async function ejecutarRastreoSecuencial() {
    if (_rastreoEnProgreso) {
        console.warn("Ya hay un ciclo de rastreo en progreso.");
        return;
    }

    _rastreoEnProgreso = true;
    _cancelarRastreo = false;

    await chrome.storage.local.set({ enProgreso: true });
    enviarMensajePopup({ tipo: 'INICIO_RASTREO' });

    const pedidos = await obtenerPedidosPendientesFirestore();
    console.log(`📦 Encontrados ${pedidos.length} pedidos pendientes de revisión en Firebase.`);

    // Desglosar la lista de guías a verificar
    const listaTareas = [];
    for (const ped of pedidos) {
        let guias = [];
        if (Array.isArray(ped.guiasEnvio) && ped.guiasEnvio.length > 0) {
            guias = ped.guiasEnvio;
        } else {
            // Retrocompatibilidad si tiene tracking pero no guiasEnvio
            const rawTrack = ped.tracking || ped.trackingMotorizado || ped.ultimaGuiaAsignada;
            if (rawTrack) {
                const trackings = rawTrack.split(',').map(s => s.trim()).filter(Boolean);
                guias = trackings.map(num => ({
                    numero: num,
                    agencia: ped.agenciaEnvio || ped.envio || 'Tealca',
                    estadoRastreo: 'EN_TRANSITO',
                    destinatario: ped.cliente || ''
                }));
            }
        }

        guias.forEach((g, idx) => {
            if ((g.estadoRastreo || '').toUpperCase() !== ESTADOS_ESTANDAR.ENTREGADO) {
                listaTareas.push({
                    pedido: ped,
                    guia: g,
                    guiaIndex: idx,
                    totalGuiasPedido: guias.length
                });
            }
        });
    }

    const totalTareas = listaTareas.length;
    let procesadas = 0;
    let entregadasNuevas = 0;
    let novedadesDetectadas = 0;
    let captchasRequeridos = 0;

    const historialResultados = [];

    enviarMensajePopup({
        tipo: 'PROGRESO_RASTREO',
        procesadas: 0,
        total: totalTareas,
        mensaje: `Iniciando revisión de ${totalTareas} guías...`
    });

    for (let i = 0; i < listaTareas.length; i++) {
        if (_cancelarRastreo) {
            console.log("Rastreo cancelado por el usuario.");
            break;
        }

        const tarea = listaTareas[i];
        const numGuia = tarea.guia.numero;
        const carrier = detectarCarrier(tarea.guia.agencia || tarea.pedido.agenciaEnvio || tarea.pedido.envio);

        enviarMensajePopup({
            tipo: 'PROGRESO_RASTREO',
            procesadas: i + 1,
            total: totalTareas,
            guiaActual: numGuia,
            agenciaActual: carrier.nombre,
            clienteActual: tarea.pedido.cliente,
            mensaje: `Consultando guía ${numGuia} (${carrier.nombre})...`
        });

        // 1. Ejecutar consulta al portal público
        const resultadoPortal = await consultarGuiaPublica(carrier, numGuia);

        // 2. Normalizar el estatus
        let normalizado;
        if (resultadoPortal.exito) {
            normalizado = normalizarEstatus(resultadoPortal.texto);
        } else {
            normalizado = {
                estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
                resumen: `Error de conexión: ${resultadoPortal.error}`,
                requiereCaptcha: false,
                confianza: 'baja'
            };
        }

        // Actualizar objeto de guía en memoria
        tarea.guia.estadoRastreo = normalizado.estado;
        tarea.guia.ultimaRevision = new Date().toISOString();
        tarea.guia.ultimoDetalleRastreo = normalizado.resumen;
        tarea.guia.requiereCaptcha = normalizado.requiereCaptcha;
        tarea.guia.urlRastreo = resultadoPortal.url || construirUrlRastreo(carrier, numGuia);

        // Contadores
        if (normalizado.estado === ESTADOS_ESTANDAR.ENTREGADO) entregadasNuevas++;
        if (normalizado.estado === ESTADOS_ESTANDAR.NOVEDAD) novedadesDetectadas++;
        if (normalizado.requiereCaptcha) captchasRequeridos++;

        historialResultados.push({
            numero: numGuia,
            agencia: carrier.nombre,
            cliente: tarea.pedido.cliente || 'Cliente',
            pedidoId: tarea.pedido.id,
            estadoRastreo: normalizado.estado,
            resumen: normalizado.resumen,
            requiereCaptcha: normalizado.requiereCaptcha,
            urlRastreo: tarea.guia.urlRastreo,
            fecha: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
        });

        // 3. Regla Multi-Guía: Evaluar si el pedido ahora tiene TODAS sus guías entregadas
        const todasGuias = tarea.pedido.guiasEnvio || [tarea.guia];
        const todasEntregadas = todasGuias.every(g => (g.estadoRastreo || '').toUpperCase() === ESTADOS_ESTANDAR.ENTREGADO);

        const camposActualizar = {
            guiasEnvio: todasGuias,
            ultimaRevisionRastreo: new Date().toISOString()
        };
        const fieldPaths = ['guiasEnvio', 'ultimaRevisionRastreo'];

        if (todasEntregadas && (tarea.pedido.estado || '').toLowerCase() !== 'entregado') {
            camposActualizar.estado = 'Entregado';
            camposActualizar.fechaEntrega = new Date().toLocaleDateString('es-VE');
            fieldPaths.push('estado', 'fechaEntrega');

            // Disparar Notificación de Chrome
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon-128.png',
                title: '🎉 ¡Pedido Entregado! - Inversiones FB Parts',
                message: `El pedido de ${tarea.pedido.cliente || 'Cliente'} (${todasGuias.length} bulto/s) ha sido confirmado como ENTREGADO en destino.`,
                priority: 2
            });
        }

        // 4. Guardar en Firestore
        await actualizarPedidoFirestore(tarea.pedido.id, camposActualizar, fieldPaths);

        procesadas++;

        // 5. PAUSA OBLIGATORIA DE 2 SEGUNDOS ENTRE GUÍAS PARA NO SATURAR PORTALES
        if (i < listaTareas.length - 1 && !_cancelarRastreo) {
            await esperar(2000);
        }
    }

    _rastreoEnProgreso = false;
    _cancelarRastreo = false;

    // Guardar estadísticas e historial reciente en chrome.storage.local
    const storageData = await chrome.storage.local.get(['estadisticasHistoricas', 'historialReciente']);
    const statsPrev = storageData.estadisticasHistoricas || { entregadas: 0, novedades: 0, verificadas: 0 };

    const nuevasStats = {
        entregadas: statsPrev.entregadas + entregadasNuevas,
        novedades: statsPrev.novedades + novedadesDetectadas,
        verificadas: statsPrev.verificadas + procesadas
    };

    await chrome.storage.local.set({
        enProgreso: false,
        ultimoRastreoTimestamp: new Date().toISOString(),
        estadisticasHistoricas: nuevasStats,
        historialReciente: historialResultados.slice(-50)
    });

    enviarMensajePopup({
        tipo: 'FIN_RASTREO',
        procesadas,
        total: totalTareas,
        entregadasNuevas,
        novedadesDetectadas,
        captchasRequeridos
    });

    // Notificación de resumen si se procesaron guías
    if (procesadas > 0) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: '✅ Rastreo Finalizado - FB Parts',
            message: `Se revisaron ${procesadas} guías: ${entregadasNuevas} entregadas, ${novedadesDetectadas} novedades, ${captchasRequeridos} requieren verificación.`,
            priority: 1
        });
    }
}

function enviarMensajePopup(mensaje) {
    try {
        chrome.runtime.sendMessage(mensaje).catch(() => {});
    } catch (e) {
        // El popup puede estar cerrado, ignorar
    }
}

// =========================================================================
// 4. PROGRAMACIÓN DE CHEQUEOS AUTOMÁTICOS CON CHROME.ALARMS
// =========================================================================

/**
 * Programa dos chequeos automáticos diarios: 9:00 AM y 3:00 PM
 */
async function configurarAlarmasProgramadas(activo = true) {
    await chrome.alarms.clear('alarma_rastreo_9am');
    await chrome.alarms.clear('alarma_rastreo_3pm');

    if (!activo) {
        console.log("⏰ Alarmas de rastreo automático desactivadas.");
        await chrome.storage.local.set({ autoCheckActivo: false });
        return;
    }

    await chrome.storage.local.set({ autoCheckActivo: true });

    // Calcular próximo 9:00 AM y 3:00 PM
    const ahora = new Date();

    function calcularProximoDisparo(horaObjetivo) {
        const d = new Date();
        d.setHours(horaObjetivo, 0, 0, 0);
        if (d <= ahora) {
            d.setDate(d.getDate() + 1);
        }
        return d.getTime();
    }

    const trigger9am = calcularProximoDisparo(9);
    const trigger3pm = calcularProximoDisparo(15);

    chrome.alarms.create('alarma_rastreo_9am', {
        when: trigger9am,
        periodInMinutes: 24 * 60 // diario
    });

    chrome.alarms.create('alarma_rastreo_3pm', {
        when: trigger3pm,
        periodInMinutes: 24 * 60 // diario
    });

    console.log("⏰ Alarmas programadas:", {
        proximo9am: new Date(trigger9am).toLocaleString('es-VE'),
        proximo3pm: new Date(trigger3pm).toLocaleString('es-VE')
    });
}

// Escuchar disparos de alarmas
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('alarma_rastreo')) {
        console.log(`⏰ Alarma disparada: ${alarm.name}. Iniciando ciclo de rastreo automático...`);
        ejecutarRastreoSecuencial();
    }
});

// =========================================================================
// 5. RECEPCIÓN DE MENSAJES DESDE EL POPUP
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.tipo === 'INICIAR_RASTREO') {
        ejecutarRastreoSecuencial();
        sendResponse({ ok: true, status: 'iniciado' });
        return true;
    }

    if (request.tipo === 'DETENER_RASTREO') {
        _cancelarRastreo = true;
        sendResponse({ ok: true, status: 'cancelando' });
        return true;
    }

    if (request.tipo === 'OBTENER_ESTADO') {
        chrome.storage.local.get([
            'enProgreso',
            'autoCheckActivo',
            'ultimoRastreoTimestamp',
            'estadisticasHistoricas',
            'historialReciente'
        ]).then(data => {
            sendResponse({
                enProgreso: _rastreoEnProgreso || Boolean(data.enProgreso),
                autoCheckActivo: data.autoCheckActivo !== false,
                ultimoRastreoTimestamp: data.ultimoRastreoTimestamp || null,
                estadisticasHistoricas: data.estadisticasHistoricas || { entregadas: 0, novedades: 0, verificadas: 0 },
                historialReciente: data.historialReciente || []
            });
        });
        return true;
    }

    if (request.tipo === 'TOGGLE_AUTO_CHECK') {
        configurarAlarmasProgramadas(Boolean(request.activo)).then(() => {
            sendResponse({ ok: true, activo: request.activo });
        });
        return true;
    }

    if (request.tipo === 'PROBAR_GUIA_INDIVIDUAL') {
        const carrier = detectarCarrier(request.agencia);
        consultarGuiaPublica(carrier, request.numeroGuia).then(res => {
            const norm = res.exito ? normalizarEstatus(res.texto) : { estado: 'ERROR', resumen: res.error };
            sendResponse({ ok: res.exito, normalizado: norm, url: res.url });
        });
        return true;
    }
});

// Inicialización de la extensión
chrome.runtime.onInstalled.addListener(async () => {
    console.log("🚀 FB Parts Tracker Extension instalada con éxito.");
    const data = await chrome.storage.local.get('autoCheckActivo');
    // Activo por defecto
    const activo = (data.autoCheckActivo !== false);
    configurarAlarmasProgramadas(activo);
});

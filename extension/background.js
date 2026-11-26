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

// Control de ejecución global
let _rastreoEnProgreso = false;
let _cancelarRastreo = false;
let _tabActivaId = null;
let _esperaTimeoutId = null;

// Storage para sesiones en memoria (tabId persistente durante recargas de página)
const sessionStore = chrome.storage.session || chrome.storage.local;

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

            // O si tiene tracking clásico
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
// 2. MOTOR HÍBRIDO DE RASTREO CON TIMEOUT PROTEGIDO Y CIERRE SEGURO
// =========================================================================

function esperarConCancelacion(ms) {
    return new Promise(resolve => {
        _esperaTimeoutId = setTimeout(() => {
            _esperaTimeoutId = null;
            resolve();
        }, ms);
    });
}

/**
 * Consulta un portal de encomienda abriendo una pestaña en background
 */
async function consultarGuiaViaTab(carrier, numeroGuia) {
    if (_cancelarRastreo) return { exito: false, texto: '', error: 'Cancelado por usuario' };

    const url = construirUrlRastreo(carrier, numeroGuia);
    if (!url) return { exito: false, texto: '', error: 'URL inválida' };

    let tab = null;
    try {
        tab = await chrome.tabs.create({ url, active: false });
        _tabActivaId = tab.id;

        // Esperar a que la pestaña termine de cargar inicialmente con timeout máximo de 7 segundos
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 7000);

            function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    clearTimeout(timeout);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            }
            chrome.tabs.onUpdated.addListener(listener);
        });

        if (_cancelarRastreo) return { exito: false, texto: '', error: 'Cancelado' };

        // 1. CASO ESPECIAL ZOOM: ZOOMTrack con interacción estricta y espera activa de resultado
        if (carrier.id === 'zoom') {
            const injection = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (numGuia) => {
                    // --- Script de Automatización ZOOMTrack en el DOM ---
                    // 1. Buscar input y asignar con setter nativo
                    const inputSelectors = [
                        "#form-field-nro_guia",
                        "input[name*='nro_guia' i]",
                        "input[name*='guia' i]",
                        "input[name*='codigo' i]",
                        "input[name*='tracking' i]",
                        "input[placeholder*='guia' i]",
                        "input[placeholder*='nro' i]",
                        "input[type='text']",
                        "input[type='search']"
                    ];

                    let input = null;
                    for (const sel of inputSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.offsetParent !== null) {
                            input = el;
                            break;
                        }
                    }
                    if (!input) {
                        input = document.querySelector("input[type='text'], input:not([type='hidden']):not([type='radio']):not([type='checkbox'])");
                    }

                    if (!input) {
                        return { exito: false, texto: '', error: 'Input de guía no encontrado en ZOOMTrack' };
                    }

                    input.focus();
                    try {
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                        if (nativeSetter) {
                            nativeSetter.call(input, numGuia);
                        } else {
                            input.value = numGuia;
                        }
                    } catch (e) {
                        input.value = numGuia;
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));

                    // 2. SELECCIÓN OBLIGATORIA DEL RADIO BUTTON 'ENVÍOS'
                    let radioEnvios = null;

                    // Buscar label con texto 'ENVÍOS', 'ENVIOS', 'ENVÍO', 'ENVIO'
                    const allLabels = Array.from(document.querySelectorAll('label, span, div, p'));
                    for (const lbl of allLabels) {
                        const txt = (lbl.innerText || lbl.textContent || '').trim().toUpperCase();
                        if (txt === 'ENVÍOS' || txt === 'ENVIOS' || txt === 'ENVÍO' || txt === 'ENVIO' || txt.includes('ENVÍO') || txt.includes('ENVIO')) {
                            const forId = lbl.getAttribute('for');
                            if (forId) {
                                const el = document.getElementById(forId);
                                if (el && el.type === 'radio') {
                                    radioEnvios = el;
                                    break;
                                }
                            }
                            const nested = lbl.querySelector("input[type='radio']");
                            if (nested) {
                                radioEnvios = nested;
                                break;
                            }
                            const prev = lbl.previousElementSibling;
                            if (prev && prev.type === 'radio') {
                                radioEnvios = prev;
                                break;
                            }
                            const next = lbl.nextElementSibling;
                            if (next && next.type === 'radio') {
                                radioEnvios = next;
                                break;
                            }
                        }
                    }

                    // Fallback a radio por value, id, name o primer radio
                    if (!radioEnvios) {
                        const radios = Array.from(document.querySelectorAll("input[type='radio']"));
                        for (const r of radios) {
                            const val = (r.value || '').toUpperCase();
                            const id = (r.id || '').toUpperCase();
                            const name = (r.name || '').toUpperCase();
                            if (val.includes('ENVIO') || id.includes('ENVIO') || val.includes('CARGA') || name.includes('TIPO')) {
                                radioEnvios = r;
                                break;
                            }
                        }
                        if (!radioEnvios && radios.length > 0) {
                            radioEnvios = radios[0];
                        }
                    }

                    if (radioEnvios) {
                        radioEnvios.checked = true;
                        try { radioEnvios.click(); } catch (e) {}
                        radioEnvios.dispatchEvent(new Event('change', { bubbles: true }));
                        radioEnvios.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Espera obligatoria de 300 ms antes de hacer clic en RASTREAR
                    await new Promise(r => setTimeout(r, 300));

                    // 3. Localizar y hacer clic en RASTREAR
                    let btnRastrear = null;
                    const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], a.btn, .elementor-button, [role='button']"));
                    for (const b of candidates) {
                        const txt = (b.innerText || b.textContent || b.value || '').trim().toUpperCase();
                        if (txt.includes('RASTREAR') || txt.includes('CONSULTAR')) {
                            btnRastrear = b;
                            break;
                        }
                    }
                    if (!btnRastrear) {
                        btnRastrear = document.querySelector("#tracking-page-btn-rastrear, #home-btn-rastrear, button[type='submit'], input[type='submit']");
                    }

                    if (btnRastrear) {
                        btnRastrear.click();
                    } else {
                        const form = input.closest('form');
                        if (form && typeof form.requestSubmit === 'function') {
                            form.requestSubmit();
                        } else if (form) {
                            form.submit();
                        }
                    }

                    // 4. Espera Activa del Resultado (timeoutMs = 10000, verificación cada 500ms)
                    const keywords = [
                        'entregado', 'entregada', 'recibido', 'recibida', 'tránsito', 'transito',
                        'oficina', 'agencia', 'fecha', 'estatus', 'estado', 'destinatario',
                        'no existe', 'no encontrado', 'sin información', 'sin informacion',
                        'guía no encontrada', 'guia no encontrada', 'novedad', 'retenido',
                        'en ruta', 'disponible', 'taquilla', 'almacén', 'almacen', 'firma', 'receptor'
                    ];

                    const startTime = Date.now();
                    const timeoutMs = 10000;

                    while (Date.now() - startTime < timeoutMs) {
                        await new Promise(r => setTimeout(r, 500));

                        const containerSelectors = [
                            ".elementor-widget-container",
                            ".tracking-result",
                            "#resultado-rastreo",
                            ".tabla-rastreo",
                            "#tracking-status",
                            ".tracking-status",
                            ".resultado",
                            ".timeline",
                            "table",
                            "main",
                            "body"
                        ];

                        for (const sel of containerSelectors) {
                            const el = document.querySelector(sel);
                            if (el) {
                                const txt = (el.innerText || '').trim();
                                const txtLow = txt.toLowerCase();
                                const coincide = keywords.some(k => txtLow.includes(k));
                                if (coincide && txt.length > 40) {
                                    return {
                                        exito: true,
                                        texto: txt,
                                        url: window.location.href
                                    };
                                }
                            }
                        }
                    }

                    // Último intento en todo el documento
                    const bodyTxt = document.body ? (document.body.innerText || '').trim() : '';
                    const bodyLow = bodyTxt.toLowerCase();
                    if (keywords.some(k => bodyLow.includes(k)) && bodyTxt.length > 50) {
                        return {
                            exito: true,
                            texto: bodyTxt,
                            url: window.location.href
                        };
                    }

                    // Si vence el tiempo y el contenedor sigue vacío:
                    return {
                        exito: false,
                        texto: '',
                        error: 'Sin respuesta en ZOOMTrack'
                    };
                },
                args: [numeroGuia]
            });

            const resZoom = injection && injection[0] && injection[0].result;
            if (resZoom) {
                return {
                    exito: Boolean(resZoom.exito),
                    texto: resZoom.texto || '',
                    error: resZoom.error || '',
                    url: resZoom.url || url
                };
            }
            return { exito: false, texto: '', error: 'Sin respuesta en ZOOMTrack', url };
        }

        // 2. CASO GENÉRICO PARA OTRAS AGENCIAS
        if (carrier.inputSelector && carrier.submitSelector) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (inSel, subSel, num) => {
                        const input = document.querySelector(inSel);
                        if (input) {
                            try {
                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                if (nativeSetter) {
                                    nativeSetter.call(input, num);
                                } else {
                                    input.value = num;
                                }
                            } catch (e) {
                                input.value = num;
                            }
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        const btn = document.querySelector(subSel);
                        if (btn) btn.click();
                    },
                    args: [carrier.inputSelector, carrier.submitSelector, numeroGuia]
                });
            } catch (errForm) {
                // Si la inyección falló, continuar
            }
        }

        // Breve espera para renderizado
        await esperarConCancelacion(carrier.waitMs || 2200);

        if (_cancelarRastreo) return { exito: false, texto: '', error: 'Cancelado' };

        // Inyectar script para extraer el texto renderizado
        const injection = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (selector) => {
                try {
                    const el = selector ? document.querySelector(selector) : document.body;
                    return el ? el.innerText : (document.body ? document.body.innerText : '');
                } catch (e) {
                    return document.body ? document.body.innerText : '';
                }
            },
            args: [carrier.resultSelector || 'body']
        });

        const texto = (injection && injection[0] && injection[0].result) ? injection[0].result : '';
        return { exito: true, texto, url };
    } catch (e) {
        console.warn(`Aviso consultando pestaña para guía ${numeroGuia}:`, e.message);
        return { exito: false, texto: '', error: e.message, url };
    } finally {
        if (tab && tab.id) {
            try {
                await chrome.tabs.remove(tab.id);
            } catch (err) {}
        }
        if (_tabActivaId === tab?.id) {
            _tabActivaId = null;
        }
    }
}

/**
 * Parsea el HTML de ZOOMTrack directamente en el Service Worker (sin DOMParser)
 * filtrando scripts, headers, navs y localizando el bloque "INFORMACIÓN DEL ENVÍO".
 */
function parsearHtmlTrackingZoom(htmlRaw) {
    if (!htmlRaw || typeof htmlRaw !== 'string') {
        return {
            estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
            resumen: 'Sin respuesta HTML de ZOOMTrack',
            bloqueoTemporal: false
        };
    }

    // 1. Limpieza RIGUROSA inicial: eliminar scripts, estilos, noscript, headers y navs
    // Esto previene falsos positivos porque Zoom incluye ct-bot-detector en sus scripts
    let limpio = htmlRaw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');

    // 2. Normalizar etiquetas y espacios
    limpio = limpio
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();

    // 3. VERIFICAR PRIMERO SI CONTIENE "INFORMACIÓN DEL ENVÍO"
    const regexEncabezado = /informaci[oó]n\s+del\s+env[ií]o/i;
    const matchEncabezado = limpio.search(regexEncabezado);

    if (matchEncabezado !== -1) {
        // ¡Éxito! Contiene la información del envío. Se ignora cualquier mención a CleanTalk
        const seccionTracking = limpio.substring(matchEncabezado);

        // A) ENTREGADO
        if (/\b(entregad[oa]s?|recibid[oa]s?\s+conforme|entregad[oa]\s+en\s+destino|entrega\s+efectuada)\b/i.test(seccionTracking)) {
            const matchRecibido = seccionTracking.match(/recibid[oa]\s+por\s*:?\s*([A-Za-z\s]+)/i);
            const detalle = matchRecibido 
                ? `Entregado (Recibió: ${matchRecibido[1].trim().substring(0, 30)})` 
                : 'Entregado en destino (Confirmado por Zoom)';
            return {
                estado: ESTADOS_ESTANDAR.ENTREGADO,
                resumen: detalle,
                bloqueoTemporal: false
            };
        }

        // B) LISTO_RETIRO (EN CIUDAD DESTINO / EN OFICINA / DISPONIBLE PARA RETIRO)
        if (/\b(en\s+ciudad\s+destino|en\s+oficina|disponible\s+para\s+retiro|en\s+taquilla|en\s+agencia\s+destino)\b/i.test(seccionTracking)) {
            return {
                estado: ESTADOS_ESTANDAR.LISTO_RETIRO,
                resumen: 'Disponible para retiro en oficina/agencia destino Zoom',
                bloqueoTemporal: false
            };
        }

        // C) EN_TRANSITO (EN CAMINO / EN TRÁNSITO / DESPACHADO)
        if (/\b(en\s+camino|en\s+tr[aá]nsito|despachad[oa]|en\s+ruta|en\s+viaje|recibid[oa]\s+en\s+origen)\b/i.test(seccionTracking)) {
            return {
                estado: ESTADOS_ESTANDAR.EN_TRANSITO,
                resumen: 'En tránsito hacia destino (Zoom)',
                bloqueoTemporal: false
            };
        }

        // D) Fallback si hay texto en la sección
        const lineas = seccionTracking.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const resumenFallback = lineas.slice(0, 2).join(' • ');

        return {
            estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
            resumen: resumenFallback.substring(0, 90) || 'Estatus recibido en Zoom',
            bloqueoTemporal: false
        };
    }

    // 4. ÚNICAMENTE SI NO APARECE "INFORMACIÓN DEL ENVÍO", verificar si es bloqueo real de CleanTalk
    if (/sent\s+forms\s+too\s+often|forbidden|access\s+denied|bloqueo\s+temporal/i.test(limpio)) {
        return {
            estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
            resumen: 'Bloqueo temporal anti-spam detectado en Zoom (CleanTalk: Sent forms too often)',
            bloqueoTemporal: true,
            requiereCaptcha: true
        };
    }

    // 5. Verificar si dice explícitamente no encontrada o sin información
    if (/no\s+encontrad[oa]|no\s+existe|sin\s+informaci[oó]n|gu[ií]a\s+inv[aá]lida/i.test(limpio)) {
        return {
            estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
            resumen: 'Guía no registrada o no encontrada en Zoom',
            bloqueoTemporal: false
        };
    }

    return {
        estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
        resumen: 'No se encontró el bloque "INFORMACIÓN DEL ENVÍO" en la respuesta',
        bloqueoTemporal: false
    };
}

/**
 * Consulta vía fetch directo si la agencia devuelve HTML estático
 */
async function consultarGuiaViaFetch(carrier, numeroGuia) {
    if (_cancelarRastreo) return { exito: false, texto: '', error: 'Cancelado' };
    const url = construirUrlRastreo(carrier, numeroGuia);
    if (!url) return { exito: false, texto: '', error: 'URL inválida' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
        const resp = await fetch(url, {
            method: 'GET',
            credentials: 'omit',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            const isBlocked = (resp.status === 403 || resp.status === 429);
            return {
                exito: false,
                texto: '',
                error: isBlocked ? `Bloqueo HTTP ${resp.status} (CleanTalk/Forbidden)` : `HTTP ${resp.status}`,
                bloqueoTemporal: isBlocked,
                requiereCaptcha: isBlocked,
                url
            };
        }

        const html = await resp.text();

        // Si es Zoom, usar parser especializado para Service Worker (sin DOMParser)
        if (carrier.id === 'zoom') {
            const parsed = parsearHtmlTrackingZoom(html);
            return {
                exito: true,
                parsed,
                texto: html,
                bloqueoTemporal: Boolean(parsed.bloqueoTemporal),
                requiereCaptcha: Boolean(parsed.requiereCaptcha),
                url
            };
        }

        const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        return { exito: true, texto, url };
    } catch (e) {
        clearTimeout(timeoutId);
        const errorMsg = e.name === 'AbortError' ? 'Tiempo de espera agotado (Timeout 9s)' : e.message;
        return { exito: false, texto: '', error: errorMsg, url };
    }
}

/**
 * Disparador unificado de consulta por guía
 */
async function consultarGuiaPublica(carrier, numeroGuia) {
    if (carrier.modo === 'fetch') {
        return await consultarGuiaViaFetch(carrier, numeroGuia);
    }
    return await consultarGuiaViaTab(carrier, numeroGuia);
}

// =========================================================================
// 3. SECUENCIADOR Y REGLA MULTI-GUÍA CON PROTECCIÓN TOTAL DE ESTADO
// =========================================================================

export async function ejecutarRastreoSecuencial() {
    if (_rastreoEnProgreso) {
        console.warn("Ya hay un ciclo de rastreo en progreso.");
        return;
    }

    _rastreoEnProgreso = true;
    _cancelarRastreo = false;

    await chrome.storage.local.set({ enProgreso: true });
    enviarMensajePopup({
        tipo: 'INICIO_RASTREO',
        mensaje: 'Conectando con Firebase...'
    });

    try {
        const pedidos = await obtenerPedidosPendientesFirestore();
        console.log(`📦 Encontrados ${pedidos.length} pedidos pendientes en Firebase.`);

        if (_cancelarRastreo) return;

        // Desglosar la lista de guías a verificar
        const listaTareas = [];
        for (const ped of pedidos) {
            let guias = Array.isArray(ped.guiasEnvio) && ped.guiasEnvio.length > 0 ? ped.guiasEnvio : [];
            const rawTrack = ped.tracking || ped.trackingMotorizado || ped.ultimaGuiaAsignada;
            if (rawTrack) {
                const trackings = rawTrack.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
                if (guias.length === 0) {
                    guias = trackings.map(num => ({
                        numero: num,
                        agencia: ped.agenciaEnvio || ped.envio || 'Tealca',
                        estadoRastreo: 'EN_TRANSITO',
                        destinatario: ped.cliente || '',
                        tipoTramo: 'ENTREGA_CLIENTE'
                    }));
                } else {
                    trackings.forEach(num => {
                        const yaExiste = guias.some(g => (g.numero || '').toLowerCase() === num.toLowerCase());
                        if (!yaExiste) {
                            guias.push({
                                numero: num,
                                agencia: ped.agenciaEnvio || ped.envio || 'Tealca',
                                estadoRastreo: 'EN_TRANSITO',
                                destinatario: ped.cliente || '',
                                tipoTramo: 'ENTREGA_CLIENTE'
                            });
                        }
                    });
                }
            }
            ped.guiasEnvio = guias;

            ped.guiasEnvio.forEach((g, idx) => {
                if ((g.estadoRastreo || '').toUpperCase() !== ESTADOS_ESTANDAR.ENTREGADO) {
                    listaTareas.push({
                        pedido: ped,
                        guia: g,
                        guiaIndex: idx,
                        totalGuiasPedido: ped.guiasEnvio.length
                    });
                }
            });
        }

        const totalTareas = listaTareas.length;
        if (totalTareas === 0) {
            enviarMensajePopup({
                tipo: 'FIN_RASTREO',
                procesadas: 0,
                total: 0,
                mensaje: 'No hay guías pendientes por revisar en este momento.'
            });
            return;
        }

        let procesadas = 0;
        let entregadasNuevas = 0;
        let novedadesDetectadas = 0;
        let captchasRequeridos = 0;
        let _zoomBloqueadoTemporal = false;

        const historialResultados = [];

        enviarMensajePopup({
            tipo: 'PROGRESO_RASTREO',
            procesadas: 0,
            total: totalTareas,
            mensaje: `Iniciando revisión de ${totalTareas} guías...`
        });

        for (let i = 0; i < listaTareas.length; i++) {
            if (_cancelarRastreo) {
                console.log("Rastreo interrumpido por el usuario.");
                break;
            }

            const tarea = listaTareas[i];
            const numGuia = tarea.guia.numero;
            const rawAgencia = (tarea.guia.agencia || tarea.pedido.agenciaEnvio || tarea.pedido.envio || '').trim();
            const carrier = detectarCarrier(rawAgencia);

            // Si es entrega local / motorizado / delivery directo sin portal público
            if (!carrier) {
                const nombreAgencia = rawAgencia || 'Motorizado / Entrega Local';
                if (!tarea.guia.tipoTramo) {
                    tarea.guia.tipoTramo = 'ENTREGA_CLIENTE';
                }

                // Si no tiene estatus asignado, mantenerlo como EN_TRANSITO
                const estatusLocal = tarea.guia.estadoRastreo || ESTADOS_ESTANDAR.EN_TRANSITO;
                const resumenLocal = `Envío local / motorizado (${nombreAgencia}). Requiere confirmación manual.`;

                tarea.guia.estadoRastreo = estatusLocal;
                tarea.guia.ultimaRevision = new Date().toISOString();
                tarea.guia.ultimoDetalleRastreo = resumenLocal;
                tarea.guia.requiereCaptcha = false;
                tarea.guia.urlRastreo = '';

                const itemHistorial = {
                    numero: numGuia || 'S/N',
                    agencia: nombreAgencia,
                    tipoTramo: 'ENTREGA_CLIENTE',
                    cliente: tarea.pedido.cliente || 'Cliente',
                    pedidoId: tarea.pedido.id,
                    estadoRastreo: estatusLocal,
                    resumen: resumenLocal,
                    requiereCaptcha: false,
                    urlRastreo: '',
                    fecha: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                };
                historialResultados.push(itemHistorial);
                procesadas++;

                enviarMensajePopup({
                    tipo: 'PROGRESO_RASTREO',
                    procesadas,
                    total: totalTareas,
                    guiaActual: numGuia || 'S/N',
                    agenciaActual: nombreAgencia,
                    clienteActual: tarea.pedido.cliente,
                    mensaje: `Guía local ${numGuia || 'S/N'} (${nombreAgencia}) registrada.`
                });

                continue;
            }

            const nombreCarrier = carrier.nombre || rawAgencia || 'Encomienda';
            if (!tarea.guia.tipoTramo) {
                tarea.guia.tipoTramo = carrier.categoria === 'INTERNACIONAL' ? 'IMPORTACION' : 'ENTREGA_CLIENTE';
            }

            enviarMensajePopup({
                tipo: 'PROGRESO_RASTREO',
                procesadas: i + 1,
                total: totalTareas,
                guiaActual: numGuia,
                agenciaActual: nombreCarrier,
                clienteActual: tarea.pedido.cliente,
                mensaje: `Consultando guía ${numGuia} (${nombreCarrier})...`
            });

            // 1. Ejecutar consulta al portal público (respetando bloqueo temporal anti-spam)
            let normalizado;
            let resultadoPortal = null;

            if (carrier.id === 'zoom' && _zoomBloqueadoTemporal) {
                normalizado = {
                    estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
                    resumen: 'Pausado: Bloqueo anti-spam activo en Zoom (CleanTalk)',
                    requiereCaptcha: true,
                    confianza: 'alta'
                };
                resultadoPortal = { exito: false, url: construirUrlRastreo(carrier, numGuia) };
            } else {
                resultadoPortal = await consultarGuiaPublica(carrier, numGuia);

                if (_cancelarRastreo) break;

                // 2. Normalizar el estatus
                if (resultadoPortal && resultadoPortal.parsed) {
                    normalizado = resultadoPortal.parsed;
                    if (resultadoPortal.bloqueoTemporal) {
                        _zoomBloqueadoTemporal = true;
                    }
                } else if (resultadoPortal && resultadoPortal.exito) {
                    normalizado = normalizarEstatus(resultadoPortal.texto);
                } else {
                    normalizado = {
                        estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
                        resumen: resultadoPortal?.error || 'Verificar en portal (Sin respuesta)',
                        requiereCaptcha: Boolean(resultadoPortal?.requiereCaptcha || resultadoPortal?.bloqueoTemporal),
                        confianza: 'baja'
                    };
                    if (resultadoPortal?.bloqueoTemporal && carrier.id === 'zoom') {
                        _zoomBloqueadoTemporal = true;
                    }
                }
            }

            // Actualizar objeto de guía en memoria
            tarea.guia.estadoRastreo = normalizado.estado;
            tarea.guia.ultimaRevision = new Date().toISOString();
            tarea.guia.ultimoDetalleRastreo = normalizado.resumen;
            tarea.guia.requiereCaptcha = normalizado.requiereCaptcha;
            tarea.guia.urlRastreo = resultadoPortal?.url || (carrier ? construirUrlRastreo(carrier, numGuia) : '');

            // Contadores
            if (normalizado.estado === ESTADOS_ESTANDAR.ENTREGADO) entregadasNuevas++;
            if (normalizado.estado === ESTADOS_ESTANDAR.NOVEDAD) novedadesDetectadas++;
            if (normalizado.requiereCaptcha) captchasRequeridos++;

            const itemHistorial = {
                numero: numGuia,
                agencia: nombreCarrier,
                tipoTramo: tarea.guia.tipoTramo || (carrier?.categoria === 'INTERNACIONAL' ? 'IMPORTACION' : 'ENTREGA_CLIENTE'),
                cliente: tarea.pedido.cliente || 'Cliente',
                pedidoId: tarea.pedido.id,
                estadoRastreo: normalizado.estado,
                resumen: normalizado.resumen,
                requiereCaptcha: normalizado.requiereCaptcha,
                urlRastreo: tarea.guia.urlRastreo,
                fecha: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
            };
            historialResultados.push(itemHistorial);

            // Registrar cada revisión inmediatamente en chrome.storage.local y notificar al popup
            try {
                const storageSnap = await chrome.storage.local.get(['historialReciente']);
                const histExistente = storageSnap.historialReciente || [];
                const histActualizado = [...histExistente, itemHistorial].slice(-50);
                await chrome.storage.local.set({
                    historialReciente: histActualizado,
                    ultimoRastreoTimestamp: new Date().toISOString()
                });

                enviarMensajePopup({
                    tipo: 'ACTUALIZACION_HISTORIAL',
                    item: itemHistorial,
                    historial: histActualizado
                });
            } catch (eStorage) {
                console.warn("Aviso guardando historial parcial en storage:", eStorage);
            }

            // 3. Regla de Cierre Diferenciada (Importación / Amazon vs Entrega al Cliente)
            const todasGuias = tarea.pedido.guiasEnvio || [tarea.guia];
            const camposActualizar = {
                guiasEnvio: todasGuias,
                ultimaRevisionRastreo: new Date().toISOString()
            };
            const fieldPaths = ['guiasEnvio', 'ultimaRevisionRastreo'];

            const estadoActualPedido = (tarea.pedido.estado || '').toLowerCase();

            // Si la guía es de importación y fue entregada
            if (tarea.guia.tipoTramo === 'IMPORTACION' && normalizado.estado === ESTADOS_ESTANDAR.ENTREGADO) {
                tarea.guia.recibidaImportacion = true;
            }

            // Separar guías por tramo
            const guiasImportacion = todasGuias.filter(g => g.tipoTramo === 'IMPORTACION');
            const guiasEntregaCliente = todasGuias.filter(g => g.tipoTramo !== 'IMPORTACION');

            // Regla A: Si tiene guías de Importación y todas las de importación fueron entregadas:
            // Pasa a "En Casillero / Listo para Despacho" (NUNCA a "Entregado" al cliente)
            if (guiasImportacion.length > 0) {
                const todasImportacionesEntregadas = guiasImportacion.every(g => (g.estadoRastreo || '').toUpperCase() === ESTADOS_ESTANDAR.ENTREGADO);
                if (todasImportacionesEntregadas && !['en casillero / listo para despacho', 'despachado', 'entregado'].includes(estadoActualPedido)) {
                    camposActualizar.estado = 'En Casillero / Listo para Despacho';
                    fieldPaths.push('estado');

                    try {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon-128.png',
                            title: '📦 ¡Llegó repuesto de Amazon! (UPS/DHL)',
                            message: `El pedido #${tarea.pedido.id} (${tarea.pedido.cliente || 'Cliente'}) ya fue recibido en casillero y está listo para despacho.`,
                            priority: 2
                        });
                    } catch (eNotif) {}
                }
            }

            // Regla B: Solo marcar como 'Entregado' si el 100% de las guías de ENTREGA AL CLIENTE están entregadas
            // (Si solo tiene guías de importación y ninguna de entrega cliente, NUNCA se marca 'Entregado')
            if (guiasEntregaCliente.length > 0) {
                const todasClienteEntregadas = guiasEntregaCliente.every(g => (g.estadoRastreo || '').toUpperCase() === ESTADOS_ESTANDAR.ENTREGADO);
                if (todasClienteEntregadas && estadoActualPedido !== 'entregado') {
                    camposActualizar.estado = 'Entregado';
                    camposActualizar.fechaEntrega = new Date().toLocaleDateString('es-VE');
                    fieldPaths.push('estado', 'fechaEntrega');

                    try {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icons/icon-128.png',
                            title: '🎉 ¡Pedido Entregado! - Inversiones FB Parts',
                            message: `El pedido #${tarea.pedido.id} de ${tarea.pedido.cliente || 'Cliente'} (${todasGuias.length} bulto/s) ha sido confirmado como ENTREGADO en destino.`,
                            priority: 2
                        });
                    } catch (eNotif) {}
                }
            }

            // 4. Guardar en Firestore
            await actualizarPedidoFirestore(tarea.pedido.id, camposActualizar, fieldPaths);

            procesadas++;

            // 5. PAUSA RESPETUOSA (2.5 segundos para Zoom y agencias fetch, 2.0s para otras)
            if (i < listaTareas.length - 1 && !_cancelarRastreo) {
                const pausaMs = (carrier?.id === 'zoom' || carrier?.modo === 'fetch') ? 2500 : 2000;
                await esperarConCancelacion(pausaMs);
            }
        }

        // Guardar estadísticas e historial reciente
        const storageData = await chrome.storage.local.get(['estadisticasHistoricas', 'historialReciente']);
        const statsPrev = storageData.estadisticasHistoricas || { entregadas: 0, novedades: 0, verificadas: 0 };
        const histPrev = storageData.historialReciente || [];

        const nuevasStats = {
            entregadas: statsPrev.entregadas + entregadasNuevas,
            novedades: statsPrev.novedades + novedadesDetectadas,
            verificadas: statsPrev.verificadas + procesadas
        };

        const histConsolidado = [...histPrev, ...historialResultados].slice(-50);

        await chrome.storage.local.set({
            ultimoRastreoTimestamp: new Date().toISOString(),
            estadisticasHistoricas: nuevasStats,
            historialReciente: histConsolidado
        });

        enviarMensajePopup({
            tipo: 'FIN_RASTREO',
            procesadas,
            total: totalTareas,
            entregadasNuevas,
            novedadesDetectadas,
            captchasRequeridos
        });

        if (procesadas > 0 && !_cancelarRastreo) {
            try {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon-128.png',
                    title: '✅ Rastreo Finalizado - FB Parts',
                    message: `Se revisaron ${procesadas} guías: ${entregadasNuevas} entregadas, ${novedadesDetectadas} novedades, ${captchasRequeridos} requieren verificación.`,
                    priority: 1
                });
            } catch (eN) {}
        }

    } catch (errorGeneral) {
        console.error("Error general en ejecutarRastreoSecuencial:", errorGeneral);
        enviarMensajePopup({
            tipo: 'FIN_RASTREO',
            error: errorGeneral.message || 'Error general en el proceso'
        });
    } finally {
        // Garantizar que SIEMPRE se libere el estado de ejecución
        _rastreoEnProgreso = false;
        _cancelarRastreo = false;
        _tabActivaId = null;
        await chrome.storage.local.set({ enProgreso: false });
    }
}

function enviarMensajePopup(mensaje) {
    try {
        chrome.runtime.sendMessage(mensaje).catch(() => {});
    } catch (e) {}
}

// =========================================================================
// 4. PROGRAMACIÓN DE CHEQUEOS AUTOMÁTICOS CON CHROME.ALARMS
// =========================================================================

async function configurarAlarmasProgramadas(activo = true) {
    await chrome.alarms.clear('alarma_rastreo_9am');
    await chrome.alarms.clear('alarma_rastreo_3pm');

    if (!activo) {
        console.log("⏰ Alarmas de rastreo automático desactivadas.");
        await chrome.storage.local.set({ autoCheckActivo: false });
        return;
    }

    await chrome.storage.local.set({ autoCheckActivo: true });

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
        periodInMinutes: 24 * 60
    });

    chrome.alarms.create('alarma_rastreo_3pm', {
        when: trigger3pm,
        periodInMinutes: 24 * 60
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('alarma_rastreo')) {
        console.log(`⏰ Alarma ${alarm.name} disparada. Ejecutando rastreo automático...`);
        ejecutarRastreoSecuencial();
    }
});

// =========================================================================
// 5. RECEPCIÓN DE MENSAJES DESDE EL POPUP (CON RESET INMEDIATO)
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.tipo === 'INICIAR_RASTREO') {
        ejecutarRastreoSecuencial();
        sendResponse({ ok: true, status: 'iniciado' });
        return true;
    }

    if (request.tipo === 'DETENER_RASTREO') {
        _cancelarRastreo = true;
        _rastreoEnProgreso = false;

        // Cerrar inmediatamente cualquier pestaña de background abierta
        if (_tabActivaId) {
            chrome.tabs.remove(_tabActivaId).catch(() => {});
            _tabActivaId = null;
        }
        if (_esperaTimeoutId) {
            clearTimeout(_esperaTimeoutId);
            _esperaTimeoutId = null;
        }

        chrome.storage.local.set({ enProgreso: false }).then(() => {
            enviarMensajePopup({ tipo: 'FIN_RASTREO', motivo: 'detenido_por_usuario' });
            sendResponse({ ok: true, detenido: true });
        });
        return true;
    }

    if (request.tipo === 'FORZAR_REINICIO_ESTADO') {
        _cancelarRastreo = true;
        _rastreoEnProgreso = false;
        if (_tabActivaId) {
            chrome.tabs.remove(_tabActivaId).catch(() => {});
            _tabActivaId = null;
        }
        if (_esperaTimeoutId) {
            clearTimeout(_esperaTimeoutId);
            _esperaTimeoutId = null;
        }

        chrome.storage.local.remove([
            'bloqueoTemporalZoom',
            'ultimoRastreoTimestamp',
            'historialReciente'
        ]).then(() => {
            return chrome.storage.local.set({ enProgreso: false });
        }).then(() => {
            enviarMensajePopup({ tipo: 'FIN_RASTREO', motivo: 'reinicio_forzado' });
            sendResponse({ ok: true, reiniciado: true });
        }).catch(err => {
            chrome.storage.local.set({ enProgreso: false });
            sendResponse({ ok: true, reiniciado: true, error: err.message });
        });
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
            // Si la memoria del SW dice que no está en progreso, forzar storage
            const realProgreso = _rastreoEnProgreso;
            if (!realProgreso && data.enProgreso) {
                chrome.storage.local.set({ enProgreso: false });
            }

            sendResponse({
                enProgreso: realProgreso,
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

    // =========================================================================
    // 6. MODO ASISTIDO INTERACTIVO (ABRIR PORTAL, PROCESAR Y CERRAR)
    // =========================================================================

    if (request.action === 'ABRIR_ASISTIDO' || request.tipo === 'ABRIR_ASISTIDO') {
        const { guia, agencia, pedidoId, cliente, url } = request;
        const carrier = detectarCarrier(agencia);
        const targetUrl = url || construirUrlRastreo(carrier, guia);

        chrome.tabs.create({ url: targetUrl, active: true }).then(async (tab) => {
            const datosAsistido = {
                guia,
                agencia: carrier?.nombre || agencia || 'Encomienda',
                idAgencia: carrier?.id || (agencia || '').toLowerCase(),
                pedidoId,
                cliente,
                url: targetUrl
            };

            // 1. Persistir sesión en storage.session asociada al tabId
            const claveSesion = `asistido_${tab.id}`;
            await sessionStore.set({ [claveSesion]: datosAsistido });

            // Inyección inicial con breve margen por si la página carga muy rápido
            setTimeout(() => {
                inyectarOverlayAsistido(tab.id, datosAsistido);
            }, 2500);

            sendResponse({ ok: true, tabId: tab.id });
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (request.action === 'CANCELAR_MODO_ASISTIDO' || request.tipo === 'CANCELAR_MODO_ASISTIDO') {
        const tabId = sender?.tab?.id || request.tabId;
        if (tabId) {
            sessionStore.remove(`asistido_${tabId}`).catch(() => {});
        }
        sendResponse({ ok: true });
        return true;
    }

    if (request.action === 'PROCESAR_RESULTADO_ASISTIDO' || request.tipo === 'PROCESAR_RESULTADO_ASISTIDO') {
        (async () => {
            try {
                const { textoExtraido, guia, pedidoId, agencia } = request;
                const tabId = sender?.tab?.id || request.tabId;
                const carrier = detectarCarrier(agencia);

                // Si es Zoom, usar el parser específico que prioriza INFORMACIÓN DEL ENVÍO
                let normalizado;
                if (carrier?.id === 'zoom') {
                    const parsedZoom = parsearHtmlTrackingZoom(textoExtraido);
                    if (parsedZoom && parsedZoom.estado !== ESTADOS_ESTANDAR.VERIFICAR_MANUAL) {
                        normalizado = parsedZoom;
                    } else {
                        normalizado = normalizarEstatus(textoExtraido);
                    }
                } else {
                    normalizado = normalizarEstatus(textoExtraido);
                }

                // 1. Obtener pedido desde Firestore
                let ped = null;
                if (pedidoId) {
                    try {
                        const urlDoc = `${FIRESTORE_BASE_URL}/pedidos/${pedidoId}?key=${FIREBASE_CONFIG.apiKey}`;
                        const respDoc = await fetch(urlDoc);
                        if (respDoc.ok) {
                            const rawDoc = await respDoc.json();
                            ped = parseFirestoreDoc(rawDoc);
                        }
                    } catch (ePed) {
                        console.error("Error obteniendo pedido en asistido:", ePed);
                    }
                }

                let pedidoEntregado = false;
                let pedidoEnCasillero = false;

                if (ped) {
                    let guias = Array.isArray(ped.guiasEnvio) && ped.guiasEnvio.length > 0 ? ped.guiasEnvio : [];
                    const rawTrack = ped.tracking || ped.trackingMotorizado || ped.ultimaGuiaAsignada;
                    if (rawTrack && guias.length === 0) {
                        const trackings = rawTrack.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
                        guias = trackings.map(num => ({
                            numero: num,
                            agencia: ped.agenciaEnvio || ped.envio || carrier.nombre,
                            estadoRastreo: 'EN_TRANSITO',
                            destinatario: ped.cliente || '',
                            tipoTramo: carrier.categoria === 'INTERNACIONAL' ? 'IMPORTACION' : 'ENTREGA_CLIENTE'
                        }));
                    }

                    let guiaEncontrada = guias.find(g => (g.numero || '').toLowerCase() === (guia || '').toLowerCase());
                    if (!guiaEncontrada) {
                        guiaEncontrada = {
                            numero: guia,
                            agencia: carrier.nombre,
                            estadoRastreo: normalizado.estado,
                            tipoTramo: carrier.categoria === 'INTERNACIONAL' ? 'IMPORTACION' : 'ENTREGA_CLIENTE',
                            destinatario: ped.cliente || ''
                        };
                        guias.push(guiaEncontrada);
                    }

                    // Actualizar datos de la guía
                    guiaEncontrada.estadoRastreo = normalizado.estado;
                    guiaEncontrada.ultimaRevision = new Date().toISOString();
                    guiaEncontrada.ultimoDetalleRastreo = `[Modo Asistido] ${normalizado.resumen}`;
                    guiaEncontrada.urlRastreo = construirUrlRastreo(carrier, guia);

                    if (guiaEncontrada.tipoTramo === 'IMPORTACION' && normalizado.estado === ESTADOS_ESTANDAR.ENTREGADO) {
                        guiaEncontrada.recibidaImportacion = true;
                    }

                    // Regla Multi-Guía
                    const camposActualizar = {
                        guiasEnvio: guias,
                        ultimaRevisionRastreo: new Date().toISOString()
                    };
                    const fieldPaths = ['guiasEnvio', 'ultimaRevisionRastreo'];

                    const estadoActualPedido = (ped.estado || '').toLowerCase();
                    const guiasImportacion = guias.filter(g => g.tipoTramo === 'IMPORTACION');
                    const guiasEntregaCliente = guias.filter(g => g.tipoTramo !== 'IMPORTACION');

                    // Regla A: Importación
                    if (guiasImportacion.length > 0) {
                        const todasImpEntregadas = guiasImportacion.every(g => (g.estadoRastreo || '').toUpperCase() === ESTADOS_ESTANDAR.ENTREGADO);
                        if (todasImpEntregadas && !['en casillero / listo para despacho', 'despachado', 'entregado'].includes(estadoActualPedido)) {
                            camposActualizar.estado = 'En Casillero / Listo para Despacho';
                            fieldPaths.push('estado');
                            pedidoEnCasillero = true;
                            try {
                                chrome.notifications.create({
                                    type: 'basic',
                                    iconUrl: 'icons/icon-128.png',
                                    title: '📦 ¡Llegó repuesto de Amazon! (UPS/DHL)',
                                    message: `El pedido #${ped.id} (${ped.cliente || 'Cliente'}) ya fue recibido en casillero y está listo para despacho.`,
                                    priority: 2
                                });
                            } catch (eN) {}
                        }
                    }

                    // Regla B: Entrega al Cliente
                    if (guiasEntregaCliente.length > 0) {
                        const todasCliEntregadas = guiasEntregaCliente.every(g => (g.estadoRastreo || '').toUpperCase() === ESTADOS_ESTANDAR.ENTREGADO);
                        if (todasCliEntregadas && estadoActualPedido !== 'entregado') {
                            camposActualizar.estado = 'Entregado';
                            camposActualizar.fechaEntrega = new Date().toLocaleDateString('es-VE');
                            fieldPaths.push('estado', 'fechaEntrega');
                            pedidoEntregado = true;
                            try {
                                chrome.notifications.create({
                                    type: 'basic',
                                    iconUrl: 'icons/icon-128.png',
                                    title: '🎉 ¡Pedido Entregado! - Inversiones FB Parts',
                                    message: `El pedido #${ped.id} de ${ped.cliente || 'Cliente'} (${guias.length} bulto/s) ha sido confirmado como ENTREGADO en destino.`,
                                    priority: 2
                                });
                            } catch (eN) {}
                        }
                    }

                    await actualizarPedidoFirestore(ped.id, camposActualizar, fieldPaths);
                }

                // 2. Guardar en historial local de chrome.storage.local
                const itemHistorial = {
                    numero: guia,
                    agencia: carrier.nombre,
                    tipoTramo: carrier.categoria === 'INTERNACIONAL' ? 'IMPORTACION' : 'ENTREGA_CLIENTE',
                    cliente: ped?.cliente || 'Cliente',
                    pedidoId: pedidoId,
                    estadoRastreo: normalizado.estado,
                    resumen: `[Modo Asistido] ${normalizado.resumen}`,
                    requiereCaptcha: false,
                    urlRastreo: construirUrlRastreo(carrier, guia),
                    fecha: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                };

                const storageSnap = await chrome.storage.local.get(['historialReciente']);
                const histExistente = storageSnap.historialReciente || [];
                const histActualizado = [...histExistente, itemHistorial].slice(-50);
                await chrome.storage.local.set({
                    historialReciente: histActualizado,
                    ultimoRastreoTimestamp: new Date().toISOString()
                });

                enviarMensajePopup({
                    tipo: 'ACTUALIZACION_HISTORIAL',
                    item: itemHistorial,
                    historial: histActualizado
                });

                // 3. Buscar si hay una siguiente guía pendiente para asistir
                let siguienteGuia = null;
                try {
                    const pendientes = await obtenerPedidosPendientesFirestore();
                    for (const p of pendientes) {
                        const gList = Array.isArray(p.guiasEnvio) ? p.guiasEnvio : [];
                        const pendG = gList.find(g => (g.numero || '').toLowerCase() !== (guia || '').toLowerCase() && (g.estadoRastreo || '').toUpperCase() !== ESTADOS_ESTANDAR.ENTREGADO);
                        if (pendG) {
                            const carrPend = detectarCarrier(pendG.agencia || p.agenciaEnvio || p.envio);
                            siguienteGuia = {
                                numero: pendG.numero,
                                agencia: carrPend.nombre,
                                pedidoId: p.id,
                                cliente: p.cliente || 'Cliente',
                                urlRastreo: construirUrlRastreo(carrPend, pendG.numero)
                            };
                            break;
                        }
                    }
                } catch (eNext) {}

                // Limpieza de sesión en storage.session tras éxito al actualizar Firebase
                if (tabId) {
                    await sessionStore.remove(`asistido_${tabId}`);
                }

                sendResponse({
                    ok: true,
                    estado: normalizado.estado,
                    resumen: normalizado.resumen,
                    pedidoEntregado,
                    pedidoEnCasillero,
                    siguienteGuia
                });
            } catch (errAsist) {
                console.error("Error en PROCESAR_RESULTADO_ASISTIDO:", errAsist);
                sendResponse({ ok: false, error: errAsist.message });
            }
        })();
        return true;
    }

    if (request.action === 'CERRAR_TAB_ACTUAL' || request.tipo === 'CERRAR_TAB_ACTUAL') {
        const tabId = sender?.tab?.id || request.tabId;
        if (tabId) {
            sessionStore.remove(`asistido_${tabId}`).catch(() => {});
            chrome.tabs.remove(tabId).catch(() => {});
        }
        sendResponse({ ok: true });
        return true;
    }
});

// =========================================================================
// 7. GESTOR DE SESIONES PERSISTENTES Y AUTO-INYECCIÓN EN RECARGAS (MODO ASISTIDO)
// =========================================================================

async function inyectarOverlayAsistido(tabId, sesion) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            func: (datos) => {
                window.__FB_PARTS_ASISTIDO__ = datos;
            },
            args: [sesion]
        });

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['assistedOverlay.js']
        });
    } catch (err) {
        console.warn(`[Modo Asistido] Inyección no aplicada en tab ${tabId}:`, err.message);
    }
}

// Listener persistente: re-inyecta el overlay asistido cada vez que la pestaña termine de recargar (Turnstile / búsqueda)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        try {
            const claveSesion = `asistido_${tabId}`;
            const res = await sessionStore.get(claveSesion);
            const sesion = res[claveSesion];
            if (sesion) {
                await inyectarOverlayAsistido(tabId, sesion);
            }
        } catch (e) {
            console.warn(`[Modo Asistido] Error en onUpdated tab ${tabId}:`, e);
        }
    }
});

// Limpieza automática cuando el usuario cierra la pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
    sessionStore.remove(`asistido_${tabId}`).catch(() => {});
});

chrome.runtime.onInstalled.addListener(async () => {
    console.log("🚀 FB Parts Tracker Extension inicializada.");
    const data = await chrome.storage.local.get('autoCheckActivo');
    configurarAlarmasProgramadas(data.autoCheckActivo !== false);
});

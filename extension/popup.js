/**
 * =========================================================================
 * 📱 POPUP LOGIC (VANILLA JS ES MODULE)
 * INVERSIONES FB PARTS - RASTREADOR CHROME EXTENSION (MV3)
 * =========================================================================
 */

import { CARRIERS_CONFIG, detectarCarrier } from './config/carriers.js';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
    projectId: "fb-parts-app"
};
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

let _estadoActual = {
    enProgreso: false,
    autoCheckActivo: true,
    ultimoRastreoTimestamp: null,
    historialReciente: []
};
let _tabActiva = 'todos';

// Elementos DOM
const btnToggleRastreo = document.getElementById('btn-toggle-rastreo');
const btnIcon = document.getElementById('btn-icon');
const btnLabel = document.getElementById('btn-label');
const labelLiveStatus = document.getElementById('label-live-status');
const dotLiveStatus = document.getElementById('dot-live-status');
const txtContadorProgreso = document.getElementById('txt-contador-progreso');
const barProgresoFill = document.getElementById('bar-progreso-fill');
const switchAutoCheck = document.getElementById('switch-auto-check');
const feedListItems = document.getElementById('feed-list-items');
const txtUltimaHoraRevision = document.getElementById('txt-ultima-hora-revision');
const txtTotalPendientes = document.getElementById('txt-total-pendientes');
const txtTotalInternacional = document.getElementById('txt-total-internacional');
const btnForzarReset = document.getElementById('btn-forzar-reset');

// Contadores de agencias (Nacionales e Internacionales)
const countsEl = {
    handling: document.getElementById('count-handling'),
    intercargo: document.getElementById('count-intercargo'),
    rlu: document.getElementById('count-rlu'),
    zoom: document.getElementById('count-zoom'),
    tealca: document.getElementById('count-tealca'),
    mrw: document.getElementById('count-mrw'),
    ups: document.getElementById('count-ups'),
    dhl: document.getElementById('count-dhl')
};

// =========================================================================
// 1. INICIALIZACIÓN Y CARGA DE DATOS
// =========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    configurarTabs();
    configurarBotones();
    await cargarEstadoBackground();
    await cargarContadoresAgencias();
});

async function cargarEstadoBackground() {
    try {
        const respuesta = await Promise.race([
            chrome.runtime.sendMessage({ tipo: 'OBTENER_ESTADO' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout SW')), 700))
        ]);
        if (respuesta) {
            _estadoActual = respuesta;
            actualizarUIConEstado();
        }
    } catch (e) {
        console.warn("No se pudo obtener estado de background, reseteando estado local:", e);
        _estadoActual.enProgreso = false;
        await chrome.storage.local.set({ enProgreso: false });
        actualizarUIConEstado();
    }
}

function actualizarUIConEstado() {
    // 1. Estado del botón principal
    if (_estadoActual.enProgreso) {
        btnToggleRastreo.classList.add('btn-action-cancel');
        btnIcon.textContent = '⏹';
        btnLabel.textContent = 'Detener Rastreo';
        btnToggleRastreo.disabled = false;
        dotLiveStatus.style.background = '#eab308';
        if (!labelLiveStatus.textContent || labelLiveStatus.textContent === 'Listo para rastrear') {
            labelLiveStatus.textContent = 'Rastreo en progreso...';
        }
    } else {
        btnToggleRastreo.classList.remove('btn-action-cancel');
        btnIcon.textContent = '🚀';
        btnLabel.textContent = 'Revisar Guías Ahora';
        btnToggleRastreo.disabled = false;
        dotLiveStatus.style.background = '#94a3b8';
        labelLiveStatus.textContent = 'Listo para rastrear';
        barProgresoFill.style.width = '0%';
        txtContadorProgreso.textContent = '0 / 0';
    }

    // 2. Switch auto-check
    if (switchAutoCheck) {
        switchAutoCheck.checked = (_estadoActual.autoCheckActivo !== false);
    }

    // 3. Última hora de revisión
    if (txtUltimaHoraRevision) {
        if (_estadoActual.ultimoRastreoTimestamp) {
            try {
                const d = new Date(_estadoActual.ultimoRastreoTimestamp);
                if (!isNaN(d.getTime())) {
                    txtUltimaHoraRevision.textContent = `Última: ${d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    txtUltimaHoraRevision.textContent = '-';
                }
            } catch (e) {
                txtUltimaHoraRevision.textContent = '-';
            }
        } else {
            txtUltimaHoraRevision.textContent = '-';
        }
    }

    // 4. Feed de historial
    renderizarFeedHistorial();
}

/**
 * Consulta Firebase directamente para calcular conteos pendientes por agencia
 */
async function cargarContadoresAgencias() {
    try {
        const url = `${FIRESTORE_BASE_URL}/pedidos?pageSize=100&key=${FIREBASE_CONFIG.apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) return;

        const data = await resp.json();
        const docs = data.documents || [];

        const totales = {
            handling: 0,
            intercargo: 0,
            rlu: 0,
            zoom: 0,
            tealca: 0,
            mrw: 0,
            ups: 0,
            dhl: 0
        };
        let totalNacionales = 0;
        let totalInternacional = 0;

        docs.forEach(doc => {
            const fields = doc.fields || {};
            const estadoGlobal = (fields.estado?.stringValue || '').toLowerCase();
            if (estadoGlobal === 'entregado' || estadoGlobal === 'cancelado') return;

            // Revisar si tiene array de guiasEnvio
            if (fields.guiasEnvio?.arrayValue?.values && fields.guiasEnvio.arrayValue.values.length > 0) {
                const guias = fields.guiasEnvio.arrayValue.values;
                guias.forEach(gObj => {
                    const gFields = gObj.mapValue?.fields || {};
                    const estatusRastreo = (gFields.estadoRastreo?.stringValue || '').toUpperCase();
                    if (estatusRastreo !== 'ENTREGADO') {
                        const carrier = detectarCarrier(gFields.agencia?.stringValue || fields.agenciaEnvio?.stringValue || fields.envio?.stringValue);
                        if (carrier && totales[carrier.id] !== undefined) {
                            totales[carrier.id]++;
                            if (['ups', 'dhl'].includes(carrier.id) || gFields.tipoTramo?.stringValue === 'IMPORTACION') {
                                totalInternacional++;
                            } else {
                                totalNacionales++;
                            }
                        }
                    }
                });
            } else {
                // Tracking simple
                const tracking = fields.tracking?.stringValue || fields.trackingMotorizado?.stringValue || fields.ultimaGuiaAsignada?.stringValue;
                const envioTxt = (fields.envio?.stringValue || '').toLowerCase();
                if (tracking && !envioTxt.includes('retiro') && !envioTxt.includes('local')) {
                    const carrier = detectarCarrier(fields.agenciaEnvio?.stringValue || fields.envio?.stringValue);
                    if (carrier && totales[carrier.id] !== undefined) {
                        totales[carrier.id]++;
                        if (['ups', 'dhl'].includes(carrier.id)) {
                            totalInternacional++;
                        } else {
                            totalNacionales++;
                        }
                    }
                }
            }
        });

        // Actualizar UI de conteos individuales
        for (const [key, el] of Object.entries(countsEl)) {
            if (el) el.textContent = totales[key] || 0;
        }

        // Totales globales
        if (txtTotalPendientes) {
            txtTotalPendientes.textContent = `Total: ${totalNacionales + totalInternacional}`;
        }
        if (txtTotalInternacional) {
            txtTotalInternacional.textContent = `Int: ${totalInternacional}`;
        }
    } catch (e) {
        console.error("Error al cargar contadores de agencias:", e);
    }
}

// =========================================================================
// 2. EVENTOS DE INTERACCIÓN (BOTONES, SWITCH, TABS)
// =========================================================================

function configurarBotones() {
    // Iniciar / Detener Rastreo (con protección anti-bloqueo)
    btnToggleRastreo.addEventListener('click', async () => {
        if (_estadoActual.enProgreso) {
            btnLabel.textContent = 'Deteniendo...';
            btnToggleRastreo.disabled = true;

            try {
                await Promise.race([
                    chrome.runtime.sendMessage({ tipo: 'DETENER_RASTREO' }),
                    new Promise(r => setTimeout(r, 800))
                ]);
            } catch (e) {
                console.warn("Aviso al detener rastreo:", e);
            }

            _estadoActual.enProgreso = false;
            await chrome.storage.local.set({ enProgreso: false });
            btnToggleRastreo.disabled = false;
            actualizarUIConEstado();
            await cargarContadoresAgencias();
        } else {
            _estadoActual.enProgreso = true;
            labelLiveStatus.textContent = 'Conectando con Firebase...';
            dotLiveStatus.style.background = '#eab308';
            actualizarUIConEstado();
            try {
                await chrome.runtime.sendMessage({ tipo: 'INICIAR_RASTREO' });
            } catch (e) {
                _estadoActual.enProgreso = false;
                actualizarUIConEstado();
            }
        }
    });

    // Botón de Restablecer Estado de Emergencia
    if (btnForzarReset) {
        btnForzarReset.addEventListener('click', async () => {
            btnForzarReset.textContent = 'Restableciendo...';
            try {
                await Promise.race([
                    chrome.runtime.sendMessage({ tipo: 'FORZAR_REINICIO_ESTADO' }),
                    new Promise(r => setTimeout(r, 800))
                ]);
            } catch (e) {
                console.warn("Aviso al forzar reinicio:", e);
            }

            // Limpieza inmediata total de storage y memoria
            try {
                await chrome.storage.local.remove([
                    'enProgreso',
                    'bloqueoTemporalZoom',
                    'ultimoRastreoTimestamp',
                    'historialReciente'
                ]);
                await chrome.storage.local.set({ enProgreso: false });
            } catch (eStorage) {}

            _estadoActual = {
                enProgreso: false,
                autoCheckActivo: true,
                ultimoRastreoTimestamp: null,
                historialReciente: []
            };

            btnForzarReset.textContent = 'Restablecer';
            actualizarUIConEstado();
            await cargarContadoresAgencias();
        });
    }

    // Switch Automático
    if (switchAutoCheck) {
        switchAutoCheck.addEventListener('change', async (e) => {
            await chrome.runtime.sendMessage({
                tipo: 'TOGGLE_AUTO_CHECK',
                activo: e.target.checked
            });
        });
    }
}

function configurarTabs() {
    const tabs = document.querySelectorAll('.feed-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            _tabActiva = tab.getAttribute('data-tab') || 'todos';
            renderizarFeedHistorial();
        });
    });
}

// =========================================================================
// 3. RENDERIZADO DEL FEED DE ACTIVIDAD
// =========================================================================

function renderizarFeedHistorial() {
    if (!feedListItems) return;

    let lista = _estadoActual.historialReciente || [];

    // Filtrar según la pestaña activa
    if (_tabActiva === 'novedades') {
        lista = lista.filter(item => item.estadoRastreo === 'NOVEDAD' || item.requiereCaptcha || item.estadoRastreo === 'VERIFICAR_MANUAL');
    } else if (_tabActiva === 'entregados') {
        lista = lista.filter(item => item.estadoRastreo === 'ENTREGADO');
    }

    if (lista.length === 0) {
        feedListItems.innerHTML = `
            <div class="feed-empty">
                ${_tabActiva === 'novedades' ? '¡Excelente! No hay novedades ni captchas pendientes.' : 
                  _tabActiva === 'entregados' ? 'No hay entregas registradas en este lote.' : 
                  'No hay revisiones recientes registradas.<br>Haz clic en "Revisar Guías Ahora".'}
            </div>
        `;
        return;
    }

    const invertida = [...lista].reverse();

    feedListItems.innerHTML = invertida.map(item => {
        const estadoPillClass = `pill-${item.estadoRastreo || 'VERIFICAR_MANUAL'}`;
        const estadoLabel = item.estadoRastreo ? item.estadoRastreo.replace('_', ' ') : 'VERIFICAR';
        
        const esImportacion = item.tipoTramo === 'IMPORTACION' || ['UPS', 'DHL'].some(ag => (item.agencia || '').toUpperCase().includes(ag));
        const badgeTramo = esImportacion
            ? `<span style="background: #fef3c7; color: #92400e; font-size: 8.5px; font-weight: 800; padding: 1.5px 5px; border-radius: 4px; border: 1px solid #fde68a;">✈️ IMPORTACIÓN</span>`
            : `<span style="background: #e2e8f0; color: #475569; font-size: 8.5px; font-weight: 700; padding: 1.5px 5px; border-radius: 4px;">🚚 ENTREGA CLIENTE</span>`;

        let botonResolverCaptcha = '';
        if (item.requiereCaptcha || item.estadoRastreo === 'VERIFICAR_MANUAL') {
            botonResolverCaptcha = `
                <button type="button" class="btn-abrir-portal" 
                    data-url="${encodeURI(item.urlRastreo || '')}"
                    data-guia="${item.numero || ''}"
                    data-agencia="${item.agencia || ''}"
                    data-pedido-id="${item.pedidoId || ''}"
                    data-cliente="${item.cliente || ''}">
                    🔍 Resolver / Ver en Portal
                </button>
            `;
        }

        return `
            <div class="feed-item">
                <div class="feed-item-top">
                    <span class="feed-guia">${item.agencia || 'Encomienda'}: ${item.numero || 'S/N'}</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        ${badgeTramo}
                        <span class="status-pill ${estadoPillClass}">${estadoLabel}</span>
                    </div>
                </div>
                <div class="feed-cliente"><b>Cliente:</b> ${item.cliente || 'Desconocido'} • <span style="color:#94a3b8;">${item.fecha || ''}</span></div>
                <div class="feed-resumen">${item.resumen || 'Sin observaciones'}</div>
                ${botonResolverCaptcha}
            </div>
        `;
    }).join('');

    feedListItems.querySelectorAll('.btn-abrir-portal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const el = e.currentTarget;
            const url = el.getAttribute('data-url');
            const guia = el.getAttribute('data-guia');
            const agencia = el.getAttribute('data-agencia');
            const pedidoId = el.getAttribute('data-pedido-id');
            const cliente = el.getAttribute('data-cliente');

            // Abrir Modo Asistido interactivo en background
            chrome.runtime.sendMessage({
                action: 'ABRIR_ASISTIDO',
                tipo: 'ABRIR_ASISTIDO',
                url,
                guia,
                agencia,
                pedidoId,
                cliente
            });
        });
    });
}

// =========================================================================
// 4. RECEPCIÓN DE MENSAJES DE PROGRESO DESDE EL BACKGROUND
// =========================================================================

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.tipo === 'INICIO_RASTREO') {
        _estadoActual.enProgreso = true;
        labelLiveStatus.textContent = msg.mensaje || 'Iniciando rastreo...';
        dotLiveStatus.style.background = '#eab308';
        actualizarUIConEstado();
    }

    if (msg.tipo === 'PROGRESO_RASTREO') {
        _estadoActual.enProgreso = true;
        btnToggleRastreo.classList.add('btn-action-cancel');
        btnIcon.textContent = '⏹';
        btnLabel.textContent = 'Detener Rastreo';
        btnToggleRastreo.disabled = false;
        dotLiveStatus.style.background = '#eab308';
        labelLiveStatus.textContent = msg.mensaje || 'Rastreando...';

        txtContadorProgreso.textContent = `${msg.procesadas || 0} / ${msg.total || 0}`;

        if (msg.total > 0) {
            const pct = Math.round(((msg.procesadas || 0) / msg.total) * 100);
            barProgresoFill.style.width = `${pct}%`;
        }
    }

    if (msg.tipo === 'ACTUALIZACION_HISTORIAL') {
        if (msg.historial) {
            _estadoActual.historialReciente = msg.historial;
        } else if (msg.item) {
            _estadoActual.historialReciente = [...(_estadoActual.historialReciente || []), msg.item].slice(-50);
        }
        renderizarFeedHistorial();
        cargarContadoresAgencias();
    }

    if (msg.tipo === 'FIN_RASTREO') {
        _estadoActual.enProgreso = false;
        btnToggleRastreo.disabled = false;
        actualizarUIConEstado();
        cargarEstadoBackground();
        cargarContadoresAgencias();
    }
});

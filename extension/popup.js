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

// Contadores de agencias
const countsEl = {
    handling: document.getElementById('count-handling'),
    intercargo: document.getElementById('count-intercargo'),
    rlu: document.getElementById('count-rlu'),
    zoom: document.getElementById('count-zoom'),
    tealca: document.getElementById('count-tealca'),
    mrw: document.getElementById('count-mrw')
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
        const respuesta = await chrome.runtime.sendMessage({ tipo: 'OBTENER_ESTADO' });
        if (respuesta) {
            _estadoActual = respuesta;
            actualizarUIConEstado();
        }
    } catch (e) {
        console.warn("No se pudo obtener estado de background:", e);
    }
}

function actualizarUIConEstado() {
    // 1. Estado del botón principal
    if (_estadoActual.enProgreso) {
        btnToggleRastreo.classList.add('btn-action-cancel');
        btnIcon.textContent = '⏹';
        btnLabel.textContent = 'Detener Rastreo';
        dotLiveStatus.style.background = '#eab308';
        labelLiveStatus.textContent = 'Rastreo en progreso...';
    } else {
        btnToggleRastreo.classList.remove('btn-action-cancel');
        btnIcon.textContent = '🚀';
        btnLabel.textContent = 'Revisar Guías Ahora';
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
    if (_estadoActual.ultimoRastreoTimestamp && txtUltimaHoraRevision) {
        const d = new Date(_estadoActual.ultimoRastreoTimestamp);
        txtUltimaHoraRevision.textContent = `Última: ${d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
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
            mrw: 0
        };
        let granTotal = 0;

        docs.forEach(doc => {
            const fields = doc.fields || {};
            const estadoGlobal = (fields.estado?.stringValue || '').toLowerCase();
            if (estadoGlobal === 'entregado' || estadoGlobal === 'cancelado') return;

            // Revisar si tiene array de guiasEnvio
            if (fields.guiasEnvio?.arrayValue?.values) {
                const guias = fields.guiasEnvio.arrayValue.values;
                guias.forEach(gObj => {
                    const gFields = gObj.mapValue?.fields || {};
                    const estatusRastreo = (gFields.estadoRastreo?.stringValue || '').toUpperCase();
                    if (estatusRastreo !== 'ENTREGADO') {
                        const carrier = detectarCarrier(gFields.agencia?.stringValue || fields.agenciaEnvio?.stringValue || fields.envio?.stringValue);
                        if (carrier && totales[carrier.id] !== undefined) {
                            totales[carrier.id]++;
                            granTotal++;
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
                        granTotal++;
                    }
                }
            }
        });

        // Actualizar UI de conteos
        for (const [key, el] of Object.entries(countsEl)) {
            if (el) el.textContent = totales[key] || 0;
        }
        if (txtTotalPendientes) {
            txtTotalPendientes.textContent = `Total: ${granTotal}`;
        }
    } catch (e) {
        console.error("Error al cargar contadores de agencias:", e);
    }
}

// =========================================================================
// 2. EVENTOS DE INTERACCIÓN (BOTONES, SWITCH, TABS)
// =========================================================================

function configurarBotones() {
    // Iniciar / Detener Rastreo
    btnToggleRastreo.addEventListener('click', async () => {
        if (_estadoActual.enProgreso) {
            btnLabel.textContent = 'Deteniendo...';
            await chrome.runtime.sendMessage({ tipo: 'DETENER_RASTREO' });
        } else {
            _estadoActual.enProgreso = true;
            actualizarUIConEstado();
            await chrome.runtime.sendMessage({ tipo: 'INICIAR_RASTREO' });
        }
    });

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

    // Mostrar del más reciente al más antiguo
    const invertida = [...lista].reverse();

    feedListItems.innerHTML = invertida.map(item => {
        const estadoPillClass = `pill-${item.estadoRastreo || 'VERIFICAR_MANUAL'}`;
        const estadoLabel = item.estadoRastreo ? item.estadoRastreo.replace('_', ' ') : 'VERIFICAR';
        
        let botonResolverCaptcha = '';
        if (item.requiereCaptcha || item.estadoRastreo === 'VERIFICAR_MANUAL') {
            botonResolverCaptcha = `
                <button type="button" class="btn-abrir-portal" data-url="${encodeURI(item.urlRastreo || '')}">
                    🔍 Resolver / Ver en Portal
                </button>
            `;
        }

        return `
            <div class="feed-item">
                <div class="feed-item-top">
                    <span class="feed-guia">${item.agencia || 'Encomienda'}: ${item.numero || 'S/N'}</span>
                    <span class="status-pill ${estadoPillClass}">${estadoLabel}</span>
                </div>
                <div class="feed-cliente"><b>Cliente:</b> ${item.cliente || 'Desconocido'} • <span style="color:#94a3b8;">${item.fecha || ''}</span></div>
                <div class="feed-resumen">${item.resumen || 'Sin observaciones'}</div>
                ${botonResolverCaptcha}
            </div>
        `;
    }).join('');

    // Asignar listeners a botones de abrir portal
    feedListItems.querySelectorAll('.btn-abrir-portal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            if (url) {
                chrome.tabs.create({ url, active: true });
            }
        });
    });
}

// =========================================================================
// 4. RECEPCIÓN DE MENSAJES DE PROGRESO DESDE EL BACKGROUND
// =========================================================================

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.tipo === 'INICIO_RASTREO') {
        _estadoActual.enProgreso = true;
        actualizarUIConEstado();
    }

    if (msg.tipo === 'PROGRESO_RASTREO') {
        _estadoActual.enProgreso = true;
        btnToggleRastreo.classList.add('btn-action-cancel');
        btnIcon.textContent = '⏹';
        btnLabel.textContent = 'Detener Rastreo';
        dotLiveStatus.style.background = '#eab308';
        labelLiveStatus.textContent = msg.mensaje || 'Rastreando...';

        txtContadorProgreso.textContent = `${msg.procesadas || 0} / ${msg.total || 0}`;

        if (msg.total > 0) {
            const pct = Math.round(((msg.procesadas || 0) / msg.total) * 100);
            barProgresoFill.style.width = `${pct}%`;
        }
    }

    if (msg.tipo === 'FIN_RASTREO') {
        _estadoActual.enProgreso = false;
        cargarEstadoBackground();
        cargarContadoresAgencias();
    }
});

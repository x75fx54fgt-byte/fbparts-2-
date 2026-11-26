/**
 * =========================================================================
 * 🛠️ ASSISTED OVERLAY SCRIPT (MODO ASISTIDO INTERACTIVO)
 * INVERSIONES FB PARTS - RASTREADOR CHROME EXTENSION (MV3)
 * =========================================================================
 * 
 * Se inyecta en la pestaña del portal de encomiendas cuando el usuario hace clic
 * en "🔍 Resolver / Ver en Portal" para guías en VERIFICAR_MANUAL o con Captcha.
 */

(function () {
    // Evitar inyecciones duplicadas
    if (document.getElementById('fbparts-assisted-overlay')) {
        return;
    }

    const datos = window.__FB_PARTS_ASISTIDO__ || {
        guia: '',
        agencia: 'Encomienda',
        idAgencia: '',
        pedidoId: '',
        cliente: 'Cliente'
    };

    const guia = datos.guia || '';
    const agencia = datos.agencia || 'Encomienda';
    const idAgencia = (datos.idAgencia || agencia).toLowerCase();
    const pedidoId = datos.pedidoId || '';
    const cliente = datos.cliente || 'Cliente';

    // 1. DETECTAR SI LA PÁGINA YA CONTIENE EL RESULTADO DEL RASTREO (POST-RECARGA / ZOOM / TURNSTILE)
    const bodyText = (document.body ? (document.body.innerText || document.body.textContent) : '') || '';
    const regexEncabezado = /informaci[oó]n\s+del\s+env[ií]o/i;
    const yaTieneResultado = regexEncabezado.test(bodyText) || 
        (/\b(entregad[oa]s?|recibid[oa]s?\s+conforme|en\s+ciudad\s+destino|en\s+oficina|disponible\s+para\s+retiro|en\s+camino|en\s+tr[aá]nsito)\b/i.test(bodyText) && bodyText.length > 250);

    // 2. INTENTO DE AUTO-RELLENO EN EL DOM (SOLO SI AÚN NO SE HA DETECTADO EL RESULTADO)
    let autoFilled = false;
    if (!yaTieneResultado) {
        try {
            const inputSelectors = [
                "#form-field-nro_guia",
                "input[name*='nro_guia' i]",
                "input[name*='guia' i]",
                "input[name*='codigo' i]",
                "input[name*='tracking' i]",
                "input[name='busqueda']",
                "input[placeholder*='guia' i]",
                "input[placeholder*='nro' i]",
                "input[placeholder*='código' i]",
                "input#busqueda",
                "input#codigo",
                "input#tracking",
                "input[type='text']",
                "input[type='search']"
            ];

            let targetInput = null;
            for (const sel of inputSelectors) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    targetInput = el;
                    break;
                }
            }
            if (!targetInput) {
                targetInput = document.querySelector("input[type='text'], input:not([type='hidden']):not([type='radio']):not([type='checkbox'])");
            }

            if (targetInput && guia) {
                targetInput.focus();
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(targetInput, guia);
                } else {
                    targetInput.value = guia;
                }
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                autoFilled = true;
            }

            // Si es Zoom, pre-marcar radio ENVÍOS para facilitar la acción
            if (idAgencia.includes('zoom')) {
                const allRadios = Array.from(document.querySelectorAll("input[type='radio']"));
                for (const r of allRadios) {
                    const labelTxt = (r.closest('label')?.innerText || r.nextElementSibling?.innerText || r.value || '').toUpperCase();
                    if (labelTxt.includes('ENVIO') || labelTxt.includes('ENVÍO')) {
                        r.checked = true;
                        try { r.click(); } catch(e) {}
                        r.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            }
        } catch (eAuto) {
            console.warn("[FB Parts Asistido] Aviso en auto-relleno:", eAuto);
        }
    }

    // 3. CREACIÓN DEL CONTENEDOR FLOTANTE CON ESTILOS CORPORATIVOS
    const overlay = document.createElement('div');
    overlay.id = 'fbparts-assisted-overlay';
    overlay.setAttribute('style', `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: 370px !important;
        max-width: calc(100vw - 30px) !important;
        background: #ffffff !important;
        color: #1e293b !important;
        border: 2px solid ${yaTieneResultado ? '#10b981' : '#5e8877'} !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35) !important;
        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        z-index: 2147483647 !important;
        overflow: hidden !important;
        transition: all 0.25s ease !important;
        box-sizing: border-box !important;
    `);

    // Instrucciones dinámicas según transportista y estatus de pantalla
    let instruccionHtml = '';
    if (yaTieneResultado) {
        instruccionHtml = `
            <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; font-size: 12px; color: #065f46; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);">
                <span style="font-size: 18px; flex-shrink: 0;">✅</span>
                <span>¡Resultado detectado en pantalla! Presiona <b>Listo para guardar en Firebase</b>.</span>
            </div>
        `;
    } else if (idAgencia.includes('zoom')) {
        instruccionHtml = `
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: #92400e;">
                <b>📋 Pasos en ZOOMTrack:</b><br>
                1. Asegúrate de marcar el radio <b>ENVÍOS</b>.<br>
                2. Completa la verificación (Turnstile / Captcha) si aparece.<br>
                3. Haz clic en el botón <b>RASTREAR &gt;</b>.<br>
                4. Al recargar con el estatus, pulsa <b>Listo para guardar en Firebase</b>.
            </div>
        `;
    } else if (idAgencia.includes('tealca')) {
        instruccionHtml = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: #065f46;">
                <b>📋 Pasos en Tealca:</b><br>
                1. Resuelve el Captcha si la página lo solicita.<br>
                2. Haz clic en <b>Rastrear / Buscar</b>.<br>
                3. Al visualizarse el resultado, pulsa <b>Listo para guardar en Firebase</b>.
            </div>
        `;
    } else if (idAgencia.includes('mrw')) {
        instruccionHtml = `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: #991b1b;">
                <b>📋 Pasos en MRW:</b><br>
                1. Completa la verificación o código de seguridad.<br>
                2. Al ver la información de entrega, pulsa <b>Listo para guardar en Firebase</b>.
            </div>
        `;
    } else {
        instruccionHtml = `
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: #334155;">
                <b>📋 Modo Asistido:</b><br>
                Completa la consulta en pantalla y haz clic en <b>Listo para guardar en Firebase</b> cuando veas el estado.
            </div>
        `;
    }

    const autoFilledNotice = (!yaTieneResultado && autoFilled) 
        ? `<div style="font-size: 11px; color: #15803d; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
             <span>✨</span> <span>Número <b>${guia}</b> auto-rellenado en el buscador.</span>
           </div>`
        : '';

    overlay.innerHTML = `
        <!-- Encabezado Corporativo -->
        <div style="background: linear-gradient(135deg, #385723 0%, #283f19 100%); color: #ffffff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #5e8877;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">🔍</span>
                <div>
                    <div style="font-weight: 800; font-size: 12.5px; letter-spacing: 0.5px; text-transform: uppercase;">F&amp;B PARTS • MODO ASISTIDO</div>
                    <div style="font-size: 10.5px; color: #d1fae5;">Resolución de Guías de Envío</div>
                </div>
            </div>
            <button id="fbparts-btn-cerrar" type="button" style="background: rgba(255,255,255,0.15); border: none; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; line-height: 1;">✕</button>
        </div>

        <!-- Cuerpo del Asistente -->
        <div id="fbparts-body-content" style="padding: 12px 14px; background: #ffffff;">
            <!-- Ficha de Datos -->
            <div style="background: #eef3f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 10.5px; font-weight: 700; color: #5e8877; text-transform: uppercase;">${agencia}</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace;">${guia || 'Sin número'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: #64748b;">PEDIDO</div>
                    <div style="font-size: 12px; font-weight: 700; color: #385723;">#${pedidoId || 'N/A'}</div>
                </div>
            </div>

            ${autoFilledNotice}
            ${instruccionHtml}

            <!-- Botones de Acción -->
            <div id="fbparts-actions-row" style="display: flex; flex-direction: column; gap: 8px;">
                <button type="button" id="fbparts-btn-leer-actualizar" style="
                    background: ${yaTieneResultado ? '#15803d' : '#385723'};
                    color: #ffffff;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 14px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    box-shadow: ${yaTieneResultado ? '0 4px 12px rgba(21, 128, 61, 0.35)' : '0 3px 8px rgba(56, 87, 35, 0.25)'};
                    transition: all 0.15s ease;
                ">
                    <span>✅</span> <span>${yaTieneResultado ? 'Listo para guardar en Firebase' : 'Listo, Leer y Actualizar'}</span>
                </button>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                    <span style="color: #64748b;">Cliente: <b>${cliente}</b></span>
                    <a href="javascript:void(0)" id="fbparts-link-cancelar" style="color: #94a3b8; text-decoration: underline; cursor: pointer;">Cancelar</a>
                </div>
            </div>

            <!-- Contenedor de Resultado / Éxito (Oculto inicialmente) -->
            <div id="fbparts-result-box" style="display: none; margin-top: 10px; border-radius: 6px; padding: 10px; font-size: 12px;"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 3. EXTRACCIÓN LIMPIA DEL RESULTADO (TEXTO COMPLETO DEL DOM SIN TRUNCAR)
    function extraerTextoLimpioResultado() {
        try {
            const overlayEl = document.getElementById('fbparts-assisted-overlay');
            if (overlayEl) overlayEl.style.display = 'none';

            // Obtener texto completo y real del documento
            const textoCompleto = (document.body ? (document.body.innerText || document.body.textContent) : '') || '';

            if (overlayEl) overlayEl.style.display = 'block';
            return textoCompleto.trim();
        } catch (e) {
            console.warn("[FB Parts Asistido] Error extrayendo texto del DOM:", e);
            return (document.body ? (document.body.innerText || document.body.textContent) : '') || '';
        }
    }

    // 4. EVENTOS DE INTERACCIÓN
    const btnCerrar = overlay.querySelector('#fbparts-btn-cerrar');
    const linkCancelar = overlay.querySelector('#fbparts-link-cancelar');
    const btnLeerActualizar = overlay.querySelector('#fbparts-btn-leer-actualizar');
    const resultBox = overlay.querySelector('#fbparts-result-box');
    const actionsRow = overlay.querySelector('#fbparts-actions-row');

    function cerrarOverlay() {
        overlay.style.opacity = '0';
        overlay.style.transform = 'translateY(15px)';
        setTimeout(() => overlay.remove(), 250);
        try {
            chrome.runtime.sendMessage({
                action: 'CANCELAR_MODO_ASISTIDO',
                tipo: 'CANCELAR_MODO_ASISTIDO'
            }).catch(() => {});
        } catch (e) {}
    }

    btnCerrar?.addEventListener('click', cerrarOverlay);
    linkCancelar?.addEventListener('click', cerrarOverlay);

    btnLeerActualizar?.addEventListener('click', async () => {
        btnLeerActualizar.disabled = true;
        btnLeerActualizar.style.background = '#475569';
        btnLeerActualizar.innerHTML = `<span>⏳</span> <span>Leyendo DOM y actualizando Firebase...</span>`;

        const textoExtraido = extraerTextoLimpioResultado();

        chrome.runtime.sendMessage({
            action: 'PROCESAR_RESULTADO_ASISTIDO',
            tipo: 'PROCESAR_RESULTADO_ASISTIDO',
            textoExtraido,
            guia,
            pedidoId,
            agencia
        }, (respuesta) => {
            if (chrome.runtime.lastError || !respuesta || !respuesta.ok) {
                btnLeerActualizar.disabled = false;
                btnLeerActualizar.style.background = '#dc2626';
                btnLeerActualizar.innerHTML = `<span>⚠️</span> <span>Reintentar Lectura</span>`;
                resultBox.style.display = 'block';
                resultBox.style.background = '#fef2f2';
                resultBox.style.color = '#991b1b';
                resultBox.style.border = '1px solid #fecaca';
                resultBox.innerHTML = `<b>Error al procesar:</b> ${respuesta?.error || chrome.runtime.lastError?.message || 'Sin respuesta del background'}`;
                return;
            }

            // Ocultar fila de botones de lectura
            actionsRow.style.display = 'none';

            // Mostrar caja de resultado
            resultBox.style.display = 'block';
            const estado = respuesta.estado || 'VERIFICAR_MANUAL';
            const resumen = respuesta.resumen || 'Estado actualizado';

            let estadoColor = '#0369a1';
            let estadoBg = '#e0f2fe';
            let iconEstado = '🚚';

            if (estado === 'ENTREGADO') {
                estadoColor = '#15803d';
                estadoBg = '#dcfce7';
                iconEstado = '🎉';
            } else if (estado === 'NOVEDAD' || estado === 'VERIFICAR_MANUAL') {
                estadoColor = '#b45309';
                estadoBg = '#fef3c7';
                iconEstado = '⚠️';
            }

            let avisoPedido = '';
            if (respuesta.pedidoEntregado) {
                avisoPedido = `<div style="margin-top: 6px; padding: 6px 8px; background: #15803d; color: #ffffff; border-radius: 4px; font-weight: 700; font-size: 11.5px;">
                    🎉 ¡Pedido #${pedidoId} completado y marcado como ENTREGADO en Firebase!
                </div>`;
            } else if (respuesta.pedidoEnCasillero) {
                avisoPedido = `<div style="margin-top: 6px; padding: 6px 8px; background: #b45309; color: #ffffff; border-radius: 4px; font-weight: 700; font-size: 11.5px;">
                    📦 ¡Repuesto de importación recibido en Casillero / Listo para Despacho!
                </div>`;
            }

            let botonSiguienteHtml = '';
            if (respuesta.siguienteGuia) {
                botonSiguienteHtml = `
                    <button type="button" id="fbparts-btn-siguiente" style="
                        background: #385723;
                        color: #ffffff;
                        border: none;
                        border-radius: 6px;
                        padding: 8px 12px;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        flex: 1;
                    ">
                        <span>➡️</span> <span>Siguiente Guía (${respuesta.siguienteGuia.numero})</span>
                    </button>
                `;
            }

            resultBox.style.background = estadoBg;
            resultBox.style.color = estadoColor;
            resultBox.style.border = `1.5px solid ${estadoColor}`;
            resultBox.innerHTML = `
                <div style="font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span>${iconEstado}</span> <span>ESTADO DETECTADO: ${estado}</span>
                </div>
                <div style="font-size: 11.5px; margin-bottom: 8px;">${resumen}</div>
                ${avisoPedido}
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    ${botonSiguienteHtml}
                    <button type="button" id="fbparts-btn-cerrar-tab" style="
                        background: #334155;
                        color: #ffffff;
                        border: none;
                        border-radius: 6px;
                        padding: 8px 12px;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                        flex: 1;
                    ">✕ Cerrar Pestaña</button>
                </div>
            `;

            // Acción Cerrar Pestaña
            overlay.querySelector('#fbparts-btn-cerrar-tab')?.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'CERRAR_TAB_ACTUAL', tipo: 'CERRAR_TAB_ACTUAL' });
            });

            // Acción Siguiente Guía
            overlay.querySelector('#fbparts-btn-siguiente')?.addEventListener('click', () => {
                const sig = respuesta.siguienteGuia;
                if (sig) {
                    chrome.runtime.sendMessage({
                        action: 'ABRIR_ASISTIDO',
                        tipo: 'ABRIR_ASISTIDO',
                        guia: sig.numero,
                        agencia: sig.agencia,
                        pedidoId: sig.pedidoId,
                        cliente: sig.cliente,
                        url: sig.urlRastreo
                    });
                    // Cerrar la pestaña actual al abrir la siguiente
                    chrome.runtime.sendMessage({ action: 'CERRAR_TAB_ACTUAL', tipo: 'CERRAR_TAB_ACTUAL' });
                }
            });
        });
    });
})();

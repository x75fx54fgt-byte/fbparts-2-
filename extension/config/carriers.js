/**
 * =========================================================================
 * 📦 CONFIGURACIÓN DE AGENCIAS DE TRANSPORTE Y RASTREO PÚBLICO
 * INVERSIONES FB PARTS - RASTREADOR CHROME EXTENSION (MV3)
 * =========================================================================
 * 
 * Agencias soportadas:
 *  1. Handling (Principal)
 *  2. Intercargo
 *  3. RLU Cargo
 *  4. Grupo Zoom
 *  5. Tealca
 *  6. MRW
 */

export const ESTADOS_ESTANDAR = {
    ENTREGADO: 'ENTREGADO',
    LISTO_RETIRO: 'LISTO_RETIRO',
    EN_TRANSITO: 'EN_TRANSITO',
    NOVEDAD: 'NOVEDAD',
    VERIFICAR_MANUAL: 'VERIFICAR_MANUAL'
};

export const CARRIERS_CONFIG = {
    handling: {
        id: 'handling',
        nombre: 'Handling (Principal)',
        color: '#385723',
        alias: ['handling', 'grupo handling', 'handling logistic', 'handling express'],
        urlTemplate: 'https://grupohandling.com/',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "input[name*='guia' i], input#guia, input[placeholder*='guia' i]",
        submitSelector: "button[type='submit'], .btn-rastreo, #btn_buscar, input[type='submit']",
        resultSelector: ".tracking-result, #resultado-rastreo, .timeline, body"
    },
    intercargo: {
        id: 'intercargo',
        nombre: 'Intercargo',
        color: '#1d4ed8',
        alias: ['intercargo', 'inter cargo', 'inter-cargo'],
        urlTemplate: 'https://intercargo.com.ve/rastreo?guia={GUIA}',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "input[name='tracking'], input#tracking, input[placeholder*='guia' i]",
        submitSelector: "button[type='submit'], input[type='submit']",
        resultSelector: ".tracking-info, #resultado, body"
    },
    rlu: {
        id: 'rlu',
        nombre: 'RLU Cargo',
        color: '#b45309',
        alias: ['rlu', 'rlu cargo', 'rlucargo'],
        urlTemplate: 'https://rlucargo.com/rastreo?guia={GUIA}',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "input[name='guia'], input#guia",
        submitSelector: "button[type='submit'], .btn-buscar",
        resultSelector: "#timeline, .rastreo-box, body"
    },
    zoom: {
        id: 'zoom',
        nombre: 'Grupo Zoom',
        color: '#ea580c',
        alias: ['zoom', 'grupo zoom', 'zoom envios'],
        urlTemplate: 'https://zoom.red/tracking-de-envios-personas/',
        modo: 'tab',
        waitMs: 3000,
        inputSelector: "#form-field-nro_guia, input[name*='nro_guia']",
        submitSelector: "#tracking-page-btn-rastrear, #home-btn-rastrear, button[type='submit']",
        resultSelector: ".elementor-widget-container, .tracking-result, .elementor-form, body"
    },
    tealca: {
        id: 'tealca',
        nombre: 'Tealca',
        color: '#059669',
        alias: ['tealca', 'tealca envios', 'encomienda tealca'],
        urlTemplate: 'https://www.tealca.com/rastrear-envio/',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "#busqueda, input[name='numberTracking'], input#numero_guia",
        submitSelector: "input[type='submit'], button[type='submit'], #btnRastrear",
        resultSelector: ".resultado_busqueda, .tabla-rastreo, form, body"
    },
    mrw: {
        id: 'mrw',
        nombre: 'MRW',
        color: '#dc2626',
        alias: ['mrw', 'mrw venezuela', 'encomienda mrw'],
        urlTemplate: 'https://www.mrwve.com/rastreo?guia={GUIA}',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "input[name='numero'], input#guia, input#numero",
        submitSelector: "button[type='submit'], #btnBuscar, input[type='submit']",
        resultSelector: ".resultado-envio, #detalle-guia, body"
    }
};

/**
 * Detecta qué transportista corresponde a partir del nombre o texto de envío
 */
export function detectarCarrier(textoAgencia) {
    if (!textoAgencia) return CARRIERS_CONFIG.handling;
    const str = textoAgencia.toString().toLowerCase().trim();

    for (const carrier of Object.values(CARRIERS_CONFIG)) {
        if (carrier.alias.some(alias => str.includes(alias))) {
            return carrier;
        }
    }
    // Si contiene motorizado, no es encomienda pública
    if (str.includes('motorizado') || str.includes('delivery')) {
        return null;
    }
    // Por defecto Handling (agencia principal)
    return CARRIERS_CONFIG.handling;
}

/**
 * Construye la URL de rastreo público para una guía específica
 */
export function construirUrlRastreo(carrier, numeroGuia) {
    if (!carrier || !carrier.urlTemplate) return '';
    const cleanGuia = encodeURIComponent((numeroGuia || '').toString().trim());
    if (carrier.urlTemplate.includes('{GUIA}')) {
        return carrier.urlTemplate.replace('{GUIA}', cleanGuia);
    }
    return carrier.urlTemplate;
}

/**
 * Patrones de expresiones regulares y palabras clave para normalizar el estado del portal
 */
const PATRONES_ESTATUS = {
    CAPTCHA_O_BLOQUEO: [
        /\b(captcha|recaptcha|hcaptcha|turnstile|cloudflare|verificaci[oó]n\s+humana|comprobar\s+que\s+eres\s+humano|security\s+check)\b/i,
        /\b(acceso\s+denegado|bloqueo\s+temporal|demasiadas\s+solicitudes|429\s+too\s+many|403\s+forbidden)\b/i
    ],
    ENTREGADO: [
        /\b(entregad[oa]|recibid[oa]\s+conforme|retirad[oa]\s+por|entregado\s+en\s+destino|finalizad[oa]|entregado\s+a\s+cliente|despacho\s+finalizado)\b/i,
        /\b(recibido\s+por\s*:\s*[a-zA-Z\s]+|entregada\s+satisfactoriamente|firma\s+digital)\b/i
    ],
    LISTO_RETIRO: [
        /\b(disponible\s+para\s+retiro|en\s+oficina\s+destino|esperando\s+por\s+cliente|lista\s+para\s+entrega|disponible\s+en\s+taquilla|por\s+retirar|en\s+agencia\s+destino|en\s+almac[eé]n\s+destino)\b/i,
        /\b(lleg[oó]\s+a\s+destino|arribo\s+a\s+agencia)\b/i
    ],
    EN_TRANSITO: [
        /\b(en\s+tr[aá]nsito|en\s+ruta|despachad[oa]|centro\s+de\s+distribuci[oó]n|centro\s+de\s+acopio|en\s+viaje|recibid[oa]\s+en\s+origen|embarcad[oa]|traslado\s+entre\s+agencias|recepci[oó]n\s+en\s+oficina|procesando\s+en\s+origen)\b/i,
        /\b(salida\s+de\s+origen|en\s+camino|veh[ií]culo\s+en\s+ruta)\b/i
    ],
    NOVEDAD: [
        /\b(retenid[oa]|direcci[oó]n\s+incorrecta|devuelt[oa]|devoluci[oó]n|siniestro|extrav[ií]o|no\s+localizad[oa]|rechazad[oa]|demorado\s+por\s+fuerza\s+mayor|da[ñn]ad[oa]|aver[ií]a|problema\s+con\s+direcci[oó]n)\b/i
    ],
    NO_REGISTRADO: [
        /\b(gu[ií]a\s+no\s+encontrada|no\s+existe\s+informaci[oó]n|sin\s+registro|n[uú]mero\s+de\s+gu[ií]a\s+inv[aá]lido|no\s+se\s+encontraron\s+datos)\b/i
    ]
};

/**
 * Normaliza el texto extraído del portal de rastreo en uno de los 5 estados estándar
 */
export function normalizarEstatus(textoExtraido) {
    if (!textoExtraido || typeof textoExtraido !== 'string') {
        return {
            estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
            resumen: 'Sin respuesta o respuesta vacía del portal',
            requiereCaptcha: false,
            confianza: 'baja'
        };
    }

    const limpio = textoExtraido.replace(/\s+/g, ' ').trim();

    // 1. Detección de Captcha / Bloqueo
    for (const rx of PATRONES_ESTATUS.CAPTCHA_O_BLOQUEO) {
        if (rx.test(limpio)) {
            return {
                estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
                resumen: 'Se detectó verificación de seguridad o Captcha en el portal',
                requiereCaptcha: true,
                confianza: 'alta'
            };
        }
    }

    // 2. Detección de ENTREGADO
    for (const rx of PATRONES_ESTATUS.ENTREGADO) {
        if (rx.test(limpio)) {
            const match = limpio.match(rx);
            return {
                estado: ESTADOS_ESTANDAR.ENTREGADO,
                resumen: `Entregado confirmado (${match ? match[0] : 'Conforme'})`,
                requiereCaptcha: false,
                confianza: 'alta'
            };
        }
    }

    // 3. Detección de LISTO_RETIRO
    for (const rx of PATRONES_ESTATUS.LISTO_RETIRO) {
        if (rx.test(limpio)) {
            const match = limpio.match(rx);
            return {
                estado: ESTADOS_ESTANDAR.LISTO_RETIRO,
                resumen: `Disponible para retiro en agencia de destino (${match ? match[0] : 'En taquilla'})`,
                requiereCaptcha: false,
                confianza: 'alta'
            };
        }
    }

    // 4. Detección de NOVEDAD
    for (const rx of PATRONES_ESTATUS.NOVEDAD) {
        if (rx.test(limpio)) {
            const match = limpio.match(rx);
            return {
                estado: ESTADOS_ESTANDAR.NOVEDAD,
                resumen: `Novedad o retención reportada (${match ? match[0] : 'Alerta'})`,
                requiereCaptcha: false,
                confianza: 'alta'
            };
        }
    }

    // 5. Detección de EN_TRANSITO
    for (const rx of PATRONES_ESTATUS.EN_TRANSITO) {
        if (rx.test(limpio)) {
            const match = limpio.match(rx);
            return {
                estado: ESTADOS_ESTANDAR.EN_TRANSITO,
                resumen: `En tránsito / En camino (${match ? match[0] : 'Ruta activa'})`,
                requiereCaptcha: false,
                confianza: 'media'
            };
        }
    }

    // 6. Detección de No Encontrado o Inválido
    for (const rx of PATRONES_ESTATUS.NO_REGISTRADO) {
        if (rx.test(limpio)) {
            return {
                estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
                resumen: 'Guía aún no registrada en el sistema de la encomienda',
                requiereCaptcha: false,
                confianza: 'media'
            };
        }
    }

    // Si el texto es muy corto o ambiguo
    const extracto = limpio.length > 90 ? limpio.substring(0, 90) + '...' : limpio;
    return {
        estado: ESTADOS_ESTANDAR.VERIFICAR_MANUAL,
        resumen: extracto || 'Información no concluyente (Revisar manualmente)',
        requiereCaptcha: false,
        confianza: 'baja'
    };
}

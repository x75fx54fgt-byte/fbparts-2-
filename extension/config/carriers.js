/**
 * =========================================================================
 * 📦 CONFIGURACIÓN DE AGENCIAS DE TRANSPORTE Y RASTREO PÚBLICO
 * INVERSIONES FB PARTS - RASTREADOR CHROME EXTENSION (MV3)
 * =========================================================================
 * 
 * Agencias soportadas:
 *  Nacionales:
 *    1. Handling (Principal)
 *    2. Intercargo
 *    3. RLU Cargo
 *    4. Grupo Zoom
 *    5. Tealca
 *    6. MRW
 *  Internacionales / Amazon:
 *    7. UPS (United Parcel Service)
 *    8. DHL Express
 */

export const ESTADOS_ESTANDAR = {
    ENTREGADO: 'ENTREGADO',
    LISTO_RETIRO: 'LISTO_RETIRO',
    EN_TRANSITO: 'EN_TRANSITO',
    NOVEDAD: 'NOVEDAD',
    VERIFICAR_MANUAL: 'VERIFICAR_MANUAL'
};

export const CARRIERS_CONFIG = {
    // --- Agencias Nacionales ---
    handling: {
        id: 'handling',
        nombre: 'Handling (Principal)',
        categoria: 'NACIONAL',
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
        categoria: 'NACIONAL',
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
        categoria: 'NACIONAL',
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
        categoria: 'NACIONAL',
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
        categoria: 'NACIONAL',
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
        categoria: 'NACIONAL',
        color: '#dc2626',
        alias: ['mrw', 'mrw venezuela', 'encomienda mrw'],
        urlTemplate: 'https://www.mrwve.com/rastreo?guia={GUIA}',
        modo: 'tab',
        waitMs: 2500,
        inputSelector: "input[name='numero'], input#guia, input#numero",
        submitSelector: "button[type='submit'], #btnBuscar, input[type='submit']",
        resultSelector: ".resultado-envio, #detalle-guia, body"
    },

    // --- Agencias Internacionales / Amazon ---
    ups: {
        id: 'ups',
        nombre: 'UPS (Internacional / Amazon)',
        categoria: 'INTERNACIONAL',
        color: '#351c15',
        alias: ['ups', 'united parcel service', 'ups tracking'],
        urlTemplate: 'https://www.ups.com/track?loc=es_US&tracknum={GUIA}',
        modo: 'tab',
        waitMs: 3500,
        inputSelector: "input#stApp_trackingNumber, input#trackNums",
        submitSelector: "button#stApp_btnTrack, button#trackBtn",
        resultSelector: "#stApp_trackingNumber, #st_App_Track_Details, .ups-card, body"
    },
    dhl: {
        id: 'dhl',
        nombre: 'DHL Express',
        categoria: 'INTERNACIONAL',
        color: '#d40511',
        alias: ['dhl', 'dhl express', 'dhl tracking'],
        urlTemplate: 'https://www.dhl.com/es-es/home/seguimiento.html?tracking-id={GUIA}&submit=1',
        modo: 'tab',
        waitMs: 3500,
        inputSelector: "input#c-tracking-input",
        submitSelector: "button.c-tracking-input__btn",
        resultSelector: ".c-tracking-result, .c-tracking-result--wrapper, body"
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
 * Patrones de expresiones regulares y palabras clave bilingües (Inglés + Español)
 */
const PATRONES_ESTATUS = {
    CAPTCHA_O_BLOQUEO: [
        /\b(captcha|recaptcha|hcaptcha|turnstile|cloudflare|akamai|verificaci[oó]n\s+humana|comprobar\s+que\s+eres\s+humano|security\s+check|bot\s+detection)\b/i,
        /\b(acceso\s+denegado|bloqueo\s+temporal|demasiadas\s+solicitudes|429\s+too\s+many|403\s+forbidden|access\s+denied)\b/i
    ],
    ENTREGADO: [
        // Español
        /\b(entregad[oa]|recibid[oa]\s+conforme|retirad[oa]\s+por|entregado\s+en\s+destino|finalizad[oa]|entregado\s+a\s+cliente|despacho\s+finalizado)\b/i,
        /\b(recibido\s+por\s*:\s*[a-zA-Z\s]+|entregada\s+satisfactoriamente|firma\s+digital)\b/i,
        // Inglés (UPS / DHL / Amazon)
        /\b(delivered|signed\s+by|left\s+at\s+dock|left\s+at\s+front\s+door|proof\s+of\s+delivery|delivered\s+to|left\s+with|received\s+by|delivery\s+completed)\b/i
    ],
    LISTO_RETIRO: [
        // Español
        /\b(disponible\s+para\s+retiro|en\s+oficina\s+destino|esperando\s+por\s+cliente|lista\s+para\s+entrega|disponible\s+en\s+taquilla|por\s+retirar|en\s+agencia\s+destino|en\s+almac[eé]n\s+destino)\b/i,
        /\b(lleg[oó]\s+a\s+destino|arribo\s+a\s+agencia)\b/i,
        // Inglés
        /\b(ready\s+for\s+pick-?up|available\s+for\s+pick-?up|held\s+for\s+pick-?up|at\s+customer\s+service\s+point|ready\s+at\s+access\s+point)\b/i
    ],
    EN_TRANSITO: [
        // Español
        /\b(en\s+tr[aá]nsito|en\s+ruta|despachad[oa]|centro\s+de\s+distribuci[oó]n|centro\s+de\s+acopio|en\s+viaje|recibid[oa]\s+en\s+origen|embarcad[oa]|traslado\s+entre\s+agencias|recepci[oó]n\s+en\s+oficina|procesando\s+en\s+origen|en\s+aduana|nacionalizaci[oó]n)\b/i,
        /\b(salida\s+de\s+origen|en\s+camino|veh[ií]culo\s+en\s+ruta)\b/i,
        // Inglés (UPS / DHL)
        /\b(in\s+transit|on\s+the\s+way|arrived\s+at\s+facility|departed\s+facility|customs\s+clearance|cleared\s+customs|processing\s+at\s+facility|out\s+for\s+delivery|shipment\s+picked\s+up|order\s+processed)\b/i
    ],
    NOVEDAD: [
        // Español
        /\b(retenid[oa]|direcci[oó]n\s+incorrecta|devuelt[oa]|devoluci[oó]n|siniestro|extrav[ií]o|no\s+localizad[oa]|rechazad[oa]|demorado\s+por\s+fuerza\s+mayor|da[ñn]ad[oa]|aver[ií]a|problema\s+con\s+direcci[oó]n)\b/i,
        // Inglés (UPS / DHL)
        /\b(exception|delay|action\s+required|on\s+hold|clearance\s+delay|delivery\s+attempted|returned\s+to\s+sender|address\s+correction\s+needed|operational\s+delay|weather\s+delay)\b/i
    ],
    NO_REGISTRADO: [
        /\b(gu[ií]a\s+no\s+encontrada|no\s+existe\s+informaci[oó]n|sin\s+registro|n[uú]mero\s+de\s+gu[ií]a\s+inv[aá]lido|no\s+se\s+encontraron\s+datos|tracking\s+number\s+not\s+found|invalid\s+tracking\s+number)\b/i
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
                resumen: `Disponible para retiro (${match ? match[0] : 'En taquilla/oficina'})`,
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
                resumen: `En tránsito (${match ? match[0] : 'En ruta activa'})`,
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
                resumen: 'Guía aún no registrada o inválida en el sistema de la encomienda',
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

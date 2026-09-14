/**
 * ==============================================================================
 * F&B PARTS - BOT DE COBRANZA AUTOMATIZADO (MICROSERVICIO EN SEGUNDO PLANO)
 * ==============================================================================
 * Archivo: cobranza-bot.js
 * Descripción: Monitorea diariamente la colección 'facturas' en Firebase Firestore,
 *              detecta cuentas por cobrar con diasVencidos > 1 y compila un reporte
 *              detallado que envía por correo electrónico a la gerencia.
 * Programación: Todos los días a las 8:00 AM (America/Caracas).
 * ==============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// ==============================================================================
// 1. CONFIGURACIÓN GENERAL Y VARIABLES DE ENTORNO
// ==============================================================================
const CONFIG = {
    reportEmail: process.env.REPORT_EMAIL || 'fybinversiones.ccs@gmail.com',
    senderEmail: process.env.EMAIL_USER || 'fybinversiones.ccs@gmail.com',
    senderPass: process.env.EMAIL_PASS || '',
    cronSchedule: process.env.CRON_SCHEDULE || '0 8 * * *', // 8:00 AM todos los días
    timezone: process.env.TIMEZONE || 'America/Caracas',
    diasVencidosMinimo: parseInt(process.env.DIAS_VENCIDOS_MINIMO, 10) || 1,
    projectId: process.env.FIREBASE_PROJECT_ID || 'fb-parts-app',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'serviceAccountKey.json')
};

// ==============================================================================
// 2. INICIALIZACIÓN DE FIREBASE ADMIN SDK
// ==============================================================================
function inicializarFirebase() {
    if (admin.apps.length > 0) {
        return admin.firestore();
    }

    try {
        // Opción A: Archivo JSON de clave privada
        if (fs.existsSync(CONFIG.serviceAccountPath)) {
            console.log(`🔑 [Firebase] Autenticando mediante cuenta de servicio: ${CONFIG.serviceAccountPath}`);
            const serviceAccount = JSON.parse(fs.readFileSync(CONFIG.serviceAccountPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: CONFIG.projectId
            });
        }
        // Opción B: Variable de entorno GOOGLE_APPLICATION_CREDENTIALS
        else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log(`🔑 [Firebase] Autenticando mediante GOOGLE_APPLICATION_CREDENTIALS`);
            admin.initializeApp();
        }
        // Opción C: Credenciales por defecto del entorno / Proyecto
        else {
            console.warn(`⚠️ [Firebase] No se encontró '${CONFIG.serviceAccountPath}'. Intentando inicialización predeterminada con projectId: '${CONFIG.projectId}'`);
            admin.initializeApp({
                projectId: CONFIG.projectId
            });
        }

        const db = admin.firestore();
        console.log(`✅ [Firebase] Conexión a Firestore establecida exitosamente (Proyecto: ${CONFIG.projectId})`);
        return db;
    } catch (error) {
        console.error(`❌ [Firebase] Error crítico al inicializar Firebase Admin:`, error.message);
        console.error(`
👉 INSTRUCCIONES PARA RESOLVERLO:
1. Ve a la consola de Firebase: https://console.firebase.google.com/project/${CONFIG.projectId}/settings/serviceaccounts/adminsdk
2. Haz clic en "Generar nueva clave privada" y descarga el archivo JSON.
3. Guarda ese archivo como 'serviceAccountKey.json' en esta carpeta:
   ${__dirname}
4. O especifica la ruta en el archivo .env: FIREBASE_SERVICE_ACCOUNT_PATH=/ruta/al/archivo.json
        `);
        throw error;
    }
}

// ==============================================================================
// 3. TRANSPORTE DE CORREO ELECTRÓNICO (NODEMAILER)
// ==============================================================================
function crearTransportadorCorreo() {
    if (!CONFIG.senderPass) {
        console.warn(`⚠️ [Nodemailer] ADVERTENCIA: No se ha configurado EMAIL_PASS en el archivo .env.`);
        console.warn(`   Para enviar correos reales con Gmail, crea una "Contraseña de Aplicación" en:`);
        console.warn(`   https://myaccount.google.com/apppasswords e ingrésala en tu archivo .env`);
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: CONFIG.senderEmail,
            pass: CONFIG.senderPass
        }
    });
}

// ==============================================================================
// 4. PARSEO Y CÁLCULO DE FECHAS / DÍAS VENCIDOS
// ==============================================================================

/**
 * Parsea fechas en formatos comunes de la aplicación:
 * - "14/9/2026" o "14/09/2026" (toLocaleDateString de es-VE)
 * - "2026-09-14" (ISO / YYYY-MM-DD)
 * - Timestamps de Firestore o milisegundos numéricos
 */
function parsearFecha(fechaInput) {
    if (!fechaInput) return null;

    // Si es un Timestamp de Firestore
    if (typeof fechaInput.toDate === 'function') {
        return fechaInput.toDate();
    }

    // Si es número (epoch timestamp)
    if (typeof fechaInput === 'number') {
        return new Date(fechaInput);
    }

    if (typeof fechaInput === 'string') {
        const str = fechaInput.trim();

        // Formato DD/MM/YYYY o D/M/YYYY
        if (str.includes('/')) {
            const partes = str.split('/');
            if (partes.length === 3) {
                const dia = parseInt(partes[0], 10);
                const mes = parseInt(partes[1], 10) - 1; // Base 0
                const anio = parseInt(partes[2], 10);
                if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
                    return new Date(anio, mes, dia);
                }
            }
        }

        // Formato ISO YYYY-MM-DD
        const isoDate = new Date(str);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
    }

    return null;
}

/**
 * Determina los días vencidos de una factura:
 * 1. Si la factura tiene el campo explícito 'diasVencidos' o 'dias_vencidos', lo respeta.
 * 2. Si no tiene ese campo estático, lo calcula dinámicamente comparando la fecha de emisión
 *    (o de vencimiento) contra la fecha actual en días calendario.
 */
function obtenerDiasVencidos(fac) {
    // 1. Campo explícito en la base de datos
    if (fac.diasVencidos !== undefined && fac.diasVencidos !== null && fac.diasVencidos !== '') {
        const val = Number(fac.diasVencidos);
        if (!isNaN(val)) return val;
    }
    if (fac.dias_vencidos !== undefined && fac.dias_vencidos !== null && fac.dias_vencidos !== '') {
        const val = Number(fac.dias_vencidos);
        if (!isNaN(val)) return val;
    }

    // 2. Cálculo dinámico basado en la fecha de la factura
    const fechaEmision = parsearFecha(fac.fechaVencimiento || fac.fecha);
    if (!fechaEmision) return 0;

    const hoy = new Date();
    // Normalizar ambas fechas a medianoche para cálculo exacto de días calendario
    const fechaA = new Date(fechaEmision.getFullYear(), fechaEmision.getMonth(), fechaEmision.getDate());
    const fechaB = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const diffTiempo = fechaB.getTime() - fechaA.getTime();
    const diasTranscurridos = Math.floor(diffTiempo / (1000 * 60 * 60 * 24));

    // Si tiene plazo de crédito específico (ej. 7 días, 15 días), se descuenta
    const plazoCredito = parseInt(fac.plazoCredito || fac.plazo || fac.diasCredito || 0, 10);
    const diasEfectivos = diasTranscurridos - plazoCredito;

    return Math.max(0, diasEfectivos);
}

/**
 * Calcula el saldo pendiente considerando abonos parciales
 */
function calcularSaldoPendiente(fac) {
    const total = parseFloat(fac.total) || 0;
    let abonado = 0;

    if (fac.abonos && Array.isArray(fac.abonos)) {
        fac.abonos.forEach(ab => {
            abonado += (parseFloat(ab.monto) || 0);
        });
    }

    return Math.max(0, total - abonado);
}

// ==============================================================================
// 5. CONSULTA Y COMPILACIÓN DE FACTURAS EN MORA
// ==============================================================================
async function obtenerFacturasMorosas(db) {
    console.log(`🔍 [Firestore] Consultando colección 'facturas'...`);
    const snapshot = await db.collection('facturas').get();

    if (snapshot.empty) {
        console.log(`ℹ️ [Firestore] No se encontraron documentos en la colección 'facturas'.`);
        return [];
    }

    const morosos = [];

    snapshot.forEach(docSnap => {
        const fac = docSnap.data();
        const docId = docSnap.id;
        const estatus = (fac.estatusComercial || fac.estado || '').toString().trim();

        // Descartar facturas ya pagadas o anuladas
        if (
            estatus === 'Anulada' ||
            estatus === 'Cobrada' ||
            estatus === 'Crédito Pagado' ||
            estatus === 'Pagada' ||
            estatus === 'Liquidado'
        ) {
            return;
        }

        const saldoPendiente = calcularSaldoPendiente(fac);
        // Si el saldo ya está completamente en 0, no es moroso
        if (saldoPendiente <= 0.01) {
            return;
        }

        const diasVencidos = obtenerDiasVencidos(fac);

        // CONDICIÓN REQUERIDA: diasVencidos sea mayor a 1
        if (diasVencidos > CONFIG.diasVencidosMinimo) {
            // Limpieza y formateo de teléfono para link directo a WhatsApp
            const rawTelefono = (fac.telefono || '').toString();
            const tlfNumeros = rawTelefono.replace(/\D/g, '');
            let linkWhatsApp = null;

            if (tlfNumeros.length >= 10) {
                // Formato internacional Venezuela: si empieza por 0, reemplazar por 58
                let tlfInternacional = tlfNumeros;
                if (tlfInternacional.startsWith('0')) {
                    tlfInternacional = '58' + tlfInternacional.substring(1);
                } else if (!tlfInternacional.startsWith('58')) {
                    tlfInternacional = '58' + tlfInternacional;
                }

                const mensajeCobro = encodeURIComponent(
                    `Hola ${fac.cliente || 'estimado cliente'}, te saludamos de Inversiones F&B Parts. Le escribimos cordialmente para consultar el estatus de pago de la factura #${fac.nro || ''} por monto pendiente de ${fac.simbolo || '$'}${saldoPendiente.toFixed(2)} emitida el ${fac.fecha || ''}. Quedamos atentos para apoyarle. ¡Muchas gracias!`
                );
                linkWhatsApp = `https://wa.me/${tlfInternacional}?text=${mensajeCobro}`;
            }

            morosos.push({
                docId: docId,
                nro: fac.nro || 'S/N',
                cliente: fac.cliente || 'Cliente sin nombre',
                rif: fac.rif || 'N/A',
                telefono: rawTelefono || 'Sin teléfono',
                linkWhatsApp: linkWhatsApp,
                fechaEmision: fac.fecha || 'N/D',
                estatusComercial: estatus || 'Pendiente',
                moneda: fac.moneda || 'USD',
                simbolo: fac.simbolo || '$',
                total: parseFloat(fac.total) || 0,
                saldoPendiente: saldoPendiente,
                diasVencidos: diasVencidos,
                notaInterna: fac.notaInterna || ''
            });
        }
    });

    // Ordenar de mayor a menor número de días vencidos (los más urgentes primero)
    morosos.sort((a, b) => b.diasVencidos - a.diasVencidos);

    return morosos;
}

// ==============================================================================
// 6. GENERACIÓN DE PLANTILLA DE CORREO (HTML Y TEXTO PLANO)
// ==============================================================================
function construirPlantillaCorreo(morosos) {
    const fechaReporte = new Date().toLocaleDateString('es-VE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Totales acumulados
    let totalDeudaUSD = 0;
    let totalDeudaVES = 0;
    let totalDeudaEUR = 0;

    morosos.forEach(m => {
        if (m.moneda === 'VES' || m.simbolo === 'Bs') {
            totalDeudaVES += m.saldoPendiente;
        } else if (m.moneda === 'EUR' || m.simbolo === '€') {
            totalDeudaEUR += m.saldoPendiente;
        } else {
            totalDeudaUSD += m.saldoPendiente;
        }
    });

    // Construcción de filas de la tabla HTML
    const filasHTML = morosos.map((m, index) => {
        const bgFila = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        const urgenciaColor = m.diasVencidos >= 15 ? '#b71c1c' : (m.diasVencidos >= 7 ? '#d32f2f' : '#e65100');
        const urgenciaTexto = m.diasVencidos >= 15 ? 'CRÍTICO' : (m.diasVencidos >= 7 ? 'URGENTE' : 'ATENCIÓN');

        const botonWhatsApp = m.linkWhatsApp
            ? `<a href="${m.linkWhatsApp}" target="_blank" style="background-color: #25D366; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 12px; display: inline-block;">💬 WhatsApp</a>`
            : `<span style="color: #888; font-size: 11px;">(Sin teléfono válido)</span>`;

        return `
            <tr style="background-color: ${bgFila}; border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px; font-weight: bold; color: #1d6fa5;">#${m.nro}</td>
                <td style="padding: 12px;">
                    <div style="font-weight: bold; color: #333; font-size: 14px;">${m.cliente}</div>
                    <div style="font-size: 11px; color: #666;">RIF: ${m.rif}</div>
                    ${m.notaInterna ? `<div style="font-size: 11px; color: #856404; background: #fff3cd; padding: 2px 6px; border-radius: 3px; margin-top: 4px; display: inline-block;">📌 ${m.notaInterna}</div>` : ''}
                </td>
                <td style="padding: 12px; color: #444; font-size: 13px;">
                    <div>${m.telefono}</div>
                    <div style="margin-top: 6px;">${botonWhatsApp}</div>
                </td>
                <td style="padding: 12px; font-size: 13px; color: #555;">${m.fechaEmision}</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background-color: ${urgenciaColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; display: inline-block;">
                        ${m.diasVencidos} días (${urgenciaTexto})
                    </span>
                </td>
                <td style="padding: 12px; text-align: right;">
                    <div style="font-size: 11px; color: #888;">Total: ${m.simbolo}${m.total.toFixed(2)}</div>
                    <div style="font-size: 15px; font-weight: bold; color: #d9534f; margin-top: 2px;">
                        ${m.simbolo}${m.saldoPendiente.toFixed(2)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Versión HTML
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Reporte Diario de Morosidad - F&B Parts</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 850px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
            <!-- HEADER -->
            <tr>
                <td style="background-color: #385723; padding: 25px 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.5px;">INVERSIONES F&amp;B PARTS, C.A.</h1>
                    <p style="margin: 6px 0 0 0; font-size: 16px; opacity: 0.9;">🚨 Reporte Diario de Morosidad y Cuentas por Cobrar</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.75; text-transform: capitalize;">${fechaReporte}</p>
                </td>
            </tr>

            <!-- RESUMEN EN TARJETAS -->
            <tr>
                <td style="padding: 25px 30px 15px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td width="32%" style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; border-radius: 4px;">
                                <div style="font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold;">Facturas en Mora (> 1 día)</div>
                                <div style="font-size: 24px; font-weight: bold; color: #b71c1c; margin-top: 4px;">${morosos.length}</div>
                            </td>
                            <td width="2%"></td>
                            <td width="32%" style="background-color: #e8f5e9; border-left: 4px solid #385723; padding: 15px; border-radius: 4px;">
                                <div style="font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold;">Total en Mora (USD)</div>
                                <div style="font-size: 24px; font-weight: bold; color: #2e7d32; margin-top: 4px;">$${totalDeudaUSD.toFixed(2)}</div>
                            </td>
                            <td width="2%"></td>
                            <td width="32%" style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; border-radius: 4px;">
                                <div style="font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold;">Otras Divisas</div>
                                <div style="font-size: 14px; font-weight: bold; color: #0d47a1; margin-top: 6px;">
                                    ${totalDeudaVES > 0 ? `Bs ${totalDeudaVES.toFixed(2)}` : ''} 
                                    ${totalDeudaEUR > 0 ? `€${totalDeudaEUR.toFixed(2)}` : ''}
                                    ${totalDeudaVES === 0 && totalDeudaEUR === 0 ? '$0.00' : ''}
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- INSTRUCCIONES DE GESTIÓN -->
            <tr>
                <td style="padding: 0 30px 15px 30px;">
                    <div style="background-color: #fff9db; border: 1px solid #ffe066; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #73510d;">
                        <strong>🎯 Plan de Acción de Hoy:</strong> Contacta prioritariamente a los clientes de la parte superior de la lista (los de mayor antigüedad). Puedes pulsar directamente el botón <strong>"WhatsApp"</strong> al lado de cada teléfono para enviarles el recordatorio pre-redactado.
                    </div>
                </td>
            </tr>

            <!-- TABLA DE MOROSOS -->
            <tr>
                <td style="padding: 0 30px 25px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #263238; color: #ffffff; text-align: left;">
                                <th style="padding: 10px 12px;">Factura</th>
                                <th style="padding: 10px 12px;">Cliente / RIF</th>
                                <th style="padding: 10px 12px;">Contacto</th>
                                <th style="padding: 10px 12px;">Emisión</th>
                                <th style="padding: 10px 12px; text-align: center;">Retraso</th>
                                <th style="padding: 10px 12px; text-align: right;">Saldo Pendiente</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHTML}
                        </tbody>
                    </table>
                </td>
            </tr>

            <!-- FOOTER -->
            <tr>
                <td style="background-color: #f1f3f5; padding: 15px 30px; text-align: center; font-size: 11px; color: #777; border-top: 1px solid #e0e0e0;">
                    Este reporte fue generado automáticamente a las 8:00 AM por el Microservicio <strong>F&amp;B Parts Cobranza-Bot</strong>.<br>
                    Para revisar o registrar abonos, ingresa al panel en <a href="http://localhost:5500/admin.html" style="color: #385723; font-weight: bold; text-decoration: underline;">admin.html</a>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Versión en texto plano para clientes de correo sin HTML
    let text = `=======================================================\n`;
    text += `INVERSIONES F&B PARTS, C.A. - REPORTE DIARIO DE MOROSIDAD\n`;
    text += `Fecha: ${fechaReporte}\n`;
    text += `=======================================================\n\n`;
    text += `Total facturas en mora (> 1 día): ${morosos.length}\n`;
    text += `Total pendiente (USD): $${totalDeudaUSD.toFixed(2)}\n\n`;
    text += `LISTA DE CLIENTES A GESTIONAR HOY:\n`;
    text += `-------------------------------------------------------\n`;

    morosos.forEach((m, idx) => {
        text += `${idx + 1}. Factura #${m.nro} | ${m.cliente} (RIF: ${m.rif})\n`;
        text += `   - Días vencidos: ${m.diasVencidos} días\n`;
        text += `   - Saldo pendiente: ${m.simbolo}${m.saldoPendiente.toFixed(2)} (Total: ${m.simbolo}${m.total.toFixed(2)})\n`;
        text += `   - Fecha de emisión: ${m.fechaEmision}\n`;
        text += `   - Teléfono: ${m.telefono}\n`;
        if (m.linkWhatsApp) text += `   - WhatsApp: ${m.linkWhatsApp}\n`;
        if (m.notaInterna) text += `   - Nota: ${m.notaInterna}\n`;
        text += `\n`;
    });

    text += `-------------------------------------------------------\n`;
    text += `Fin del reporte automático.\n`;

    return { html, text };
}

// ==============================================================================
// 7. EJECUCIÓN DEL CICLO DE COBRANZA Y ENVÍO DE CORREO
// ==============================================================================
async function ejecutarCicloCobranza() {
    const timestampInicio = new Date().toLocaleString('es-VE');
    console.log(`\n=======================================================`);
    console.log(`🚀 [Cobranza-Bot] Iniciando ciclo de cobranza (${timestampInicio})`);
    console.log(`=======================================================`);

    let db;
    try {
        db = inicializarFirebase();
    } catch (err) {
        console.error(`❌ [Cobranza-Bot] No se pudo conectar a Firestore. Abortando ciclo.`);
        return;
    }

    try {
        const morosos = await obtenerFacturasMorosas(db);

        if (morosos.length === 0) {
            console.log(`🎉 [Cobranza-Bot] ¡Excelente! No se encontraron facturas con más de ${CONFIG.diasVencidosMinimo} día(s) de vencimiento.`);
            console.log(`   No es necesario enviar reporte hoy.`);
            return;
        }

        console.log(`⚠️ [Cobranza-Bot] Se encontraron ${morosos.length} factura(s) morosa(s).`);
        morosos.forEach(m => {
            console.log(`   - Factura #${m.nro}: ${m.cliente} (${m.diasVencidos} días vencida, debe: ${m.simbolo}${m.saldoPendiente.toFixed(2)})`);
        });

        const { html, text } = construirPlantillaCorreo(morosos);
        const transporter = crearTransportadorCorreo();

        const mailOptions = {
            from: `"F&B Parts - Sistema de Cobranzas" <${CONFIG.senderEmail}>`,
            to: CONFIG.reportEmail,
            subject: 'Reporte Diario de Morosidad',
            text: text,
            html: html
        };

        console.log(`📧 [Nodemailer] Enviando correo a: ${CONFIG.reportEmail}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [Nodemailer] Reporte enviado con éxito. MessageId: ${info.messageId}`);

    } catch (error) {
        console.error(`❌ [Cobranza-Bot] Error durante el ciclo de cobranza:`, error);
    }
}

// ==============================================================================
// 8. PROGRAMACIÓN AUTOMÁTICA CON NODE-CRON
// ==============================================================================
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          F&B PARTS - SERVICIO DE COBRANZA EN SEGUNDO PLANO    ║
╠═══════════════════════════════════════════════════════════════╣
║  Cron:        ${CONFIG.cronSchedule.padEnd(46)}║
║  Horario:     Todos los días a las 8:00 AM                    ║
║  Zona horaria: ${CONFIG.timezone.padEnd(45)}║
║  Destino:     ${CONFIG.reportEmail.padEnd(46)}║
║  Condición:   diasVencidos > ${CONFIG.diasVencidosMinimo.toString().padEnd(33)}║
╚═══════════════════════════════════════════════════════════════╝
`);

// Configurar el cron programado
cron.schedule(CONFIG.cronSchedule, async () => {
    console.log(`⏰ [Cron Trigger] Ejecutando tarea programada de las 8:00 AM...`);
    await ejecutarCicloCobranza();
}, {
    scheduled: true,
    timezone: CONFIG.timezone
});

console.log(`⏳ [Cobranza-Bot] El cron está activo y esperando las 8:00 AM para la próxima ejecución.`);

// Si se pasa el argumento --run-now o --now en la terminal, ejecuta una prueba de inmediato
if (process.argv.includes('--run-now') || process.argv.includes('--now')) {
    console.log(`⚡ [CLI] Detectado flag '--run-now'. Ejecutando análisis inmediatamente...`);
    ejecutarCicloCobranza();
}

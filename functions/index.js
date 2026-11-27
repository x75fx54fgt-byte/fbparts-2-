const functionsV1 = require("firebase-functions/v1");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ============================================================================
// 🔔 HELPER: ENVÍO DE NOTIFICACIONES WEB PUSH MULTICAST (FCM v10 / iOS PWA)
// ============================================================================
/**
 * Envía notificación Web Push a los administradores registrados en fcm_tokens
 * respetando las preferencias por categoría y limpiando tokens obsoletos.
 *
 * @param {Object} params
 * @param {string} params.titulo - Título de la notificación
 * @param {string} params.cuerpo - Cuerpo/mensaje de la notificación
 * @param {string} params.categoria - 'pedidos' | 'guias' | 'cobros' | 'stock' | 'tasaBCV'
 * @param {string} [params.link] - URL de destino al hacer tap (por defecto https://www.fybparts.com/admin.html)
 * @param {Object} [params.datosExtra] - Metadatos adicionales para el payload
 */
async function enviarPushAdmin({ titulo, cuerpo, categoria, link = "https://www.fybparts.com/admin.html", datosExtra = {} }) {
  try {
    const tokensSnap = await db.collection("fcm_tokens").get();
    if (tokensSnap.empty) {
      console.log(`[FCM] No hay tokens registrados en la colección 'fcm_tokens'.`);
      return { total: 0, enviados: 0 };
    }

    const tokensDestino = [];
    tokensSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const token = data.token || docSnap.id;
      if (!token || typeof token !== "string" || token.length < 20) return;

      // Filtrar según preferencias de usuario (si la preferencia está explícitamente en false, se omite)
      if (categoria && data.preferencias && data.preferencias[categoria] === false) {
        console.log(`[FCM] Token ${token.substring(0, 8)}... tiene desactivada la categoría '${categoria}'. Omitiendo.`);
        return;
      }

      tokensDestino.push(token);
    });

    if (tokensDestino.length === 0) {
      console.log(`[FCM] Ningún dispositivo tiene activa la categoría '${categoria}'.`);
      return { total: 0, enviados: 0 };
    }

    // FCM Multicast soporta hasta 500 tokens por llamada
    const lotes = [];
    for (let i = 0; i < tokensDestino.length; i += 500) {
      lotes.push(tokensDestino.slice(i, i + 500));
    }

    let totalEnviados = 0;
    const tokensInvalidos = [];

    for (const lote of lotes) {
      const payloadMulticast = {
        tokens: lote,
        notification: {
          title: titulo,
          body: cuerpo
        },
        data: {
          categoria: categoria || "general",
          url: link,
          timestamp: String(Date.now()),
          ...datosExtra
        },
        webpush: {
          headers: {
            Urgency: "high"
          },
          fcmOptions: {
            link: link
          },
          notification: {
            title: titulo,
            body: cuerpo,
            icon: "https://www.fybparts.com/logo-fb-parts.png",
            badge: "https://www.fybparts.com/logo-fb-parts.png",
            vibrate: [200, 100, 200]
          }
        }
      };

      const respuesta = await admin.messaging().sendEachForMulticast(payloadMulticast);
      totalEnviados += respuesta.successCount;

      respuesta.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.warn(`[FCM] Error en token ${lote[idx].substring(0, 8)}...:`, errorCode);
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            tokensInvalidos.push(lote[idx]);
          }
        }
      });
    }

    // Limpieza automática de tokens revocados o desinstalados en Firestore
    if (tokensInvalidos.length > 0) {
      console.log(`[FCM] Eliminando ${tokensInvalidos.length} token(s) obsoletos de 'fcm_tokens'...`);
      const batch = db.batch();
      for (const t of tokensInvalidos) {
        batch.delete(db.collection("fcm_tokens").doc(t));
      }
      await batch.commit();
      console.log(`[FCM] Limpieza de tokens completada.`);
    }

    console.log(`[FCM] Notificación '${categoria}' enviada con éxito (${totalEnviados}/${tokensDestino.length} entregados).`);
    return { total: tokensDestino.length, enviados: totalEnviados };
  } catch (error) {
    console.error("[FCM] Error crítico en enviarPushAdmin:", error);
    throw error;
  }
}

// ============================================================================
// 🛒 TRIGGER V2: NUEVO PEDIDO REGISTRADO (onDocumentCreated)
// ============================================================================
exports.notificarNuevoPedido = onDocumentCreated("pedidos/{pedidoId}", async (event) => {
  try {
    const snap = event.data;
    if (!snap) return;
    const pedido = snap.data() || {};
    const pedidoId = event.params.pedidoId;

    const cliente = pedido.cliente || pedido.nombreCliente || pedido.email || "Cliente Web";
    const numero = pedido.nroPedido || pedido.numero || pedido.numOrden || pedidoId;
    
    let montoTexto = "0.00";
    if (typeof pedido.total === "number") {
      montoTexto = pedido.total.toFixed(2);
    } else if (pedido.total) {
      const num = parseFloat(pedido.total);
      montoTexto = !isNaN(num) ? num.toFixed(2) : String(pedido.total);
    }

    console.log(`[TRIGGER: notificarNuevoPedido] Pedido #${numero} recibido de ${cliente} por $${montoTexto}`);

    await enviarPushAdmin({
      titulo: `🛒 Nuevo Pedido #${numero}`,
      cuerpo: `${cliente} • $${montoTexto}`,
      categoria: "pedidos",
      link: "https://www.fybparts.com/admin.html",
      datosExtra: {
        pedidoId: pedidoId,
        tipo: "nuevo_pedido"
      }
    });
  } catch (error) {
    console.error("❌ [TRIGGER: notificarNuevoPedido] Error:", error);
  }
});

// ============================================================================
// 📦 TRIGGER V2: CAMBIO DE ESTADO DE ENVÍO / GUÍA (onDocumentUpdated)
// ============================================================================
exports.notificarCambioGuia = onDocumentUpdated("pedidos/{pedidoId}", async (event) => {
  try {
    const antes = event.data?.before?.data() || {};
    const despues = event.data?.after?.data() || {};
    const pedidoId = event.params.pedidoId;

    const estadoAntes = (antes.estado || antes.estadoEnvio || antes.estatus || "").trim();
    const estadoDespues = (despues.estado || despues.estadoEnvio || despues.estatus || "").trim();

    // Si el estado no cambió o está vacío, no disparar notificación
    if (estadoAntes === estadoDespues || !estadoDespues) return;

    // Palabras clave requeridas para notificar cambios relevantes de logística
    const estadoLower = estadoDespues.toLowerCase();
    const palabrasClave = [
      "despachado",
      "despach",
      "listo",
      "retiro",
      "entregado",
      "novedad",
      "devuelto",
      "camino",
      "transito",
      "tránsito",
      "ruta"
    ];

    const esEstadoRelevante = palabrasClave.some(palabra => estadoLower.includes(palabra));
    if (!esEstadoRelevante) return;

    const cliente = despues.cliente || despues.nombreCliente || despues.email || "Cliente";
    const numero = despues.nroPedido || despues.numero || despues.numOrden || pedidoId;

    console.log(`[TRIGGER: notificarCambioGuia] Pedido #${numero} cambió de '${estadoAntes}' a '${estadoDespues}'`);

    await enviarPushAdmin({
      titulo: `📦 Pedido #${numero}: ${estadoDespues}`,
      cuerpo: `Cliente: ${cliente}. Toca para ver el detalle.`,
      categoria: "guias",
      link: "https://www.fybparts.com/admin.html",
      datosExtra: {
        pedidoId: pedidoId,
        estado: estadoDespues,
        tipo: "cambio_guia"
      }
    });
  } catch (error) {
    console.error("❌ [TRIGGER: notificarCambioGuia] Error:", error);
  }
});

// ============================================================================
// 📉 TRIGGER V2: ALERTA DE STOCK CRÍTICO (onDocumentUpdated)
// ============================================================================
exports.notificarStockCritico = onDocumentUpdated("productos/{productoId}", async (event) => {
  try {
    const antes = event.data?.before?.data() || {};
    const despues = event.data?.after?.data() || {};
    const productoId = event.params.productoId;

    const stockAntes = antes.stock !== undefined ? Number(antes.stock) : (antes.cantidad !== undefined ? Number(antes.cantidad) : null);
    const stockDespues = despues.stock !== undefined ? Number(despues.stock) : (despues.cantidad !== undefined ? Number(despues.cantidad) : null);

    if (stockAntes === null || stockDespues === null || isNaN(stockAntes) || isNaN(stockDespues)) return;

    // Disparar solo cuando el stock cae a <= 2 y antes era > 2
    if (stockDespues <= 2 && stockAntes > 2) {
      const nombreProducto = despues.nombre || despues.titulo || despues.codigo || "Producto";
      const textoStock = stockDespues <= 0 ? "Agotado (0 unidades)" : `Quedan solo ${stockDespues} unidad(es)`;

      console.log(`[TRIGGER: notificarStockCritico] Stock de '${nombreProducto}' bajó de ${stockAntes} a ${stockDespues}`);

      await enviarPushAdmin({
        titulo: `📉 Stock bajo: ${nombreProducto}`,
        cuerpo: `${textoStock}. Revisa el inventario en el panel.`,
        categoria: "stock",
        link: "https://www.fybparts.com/admin.html",
        datosExtra: {
          productoId: productoId,
          stock: String(stockDespues),
          tipo: "stock_critico"
        }
      });
    }
  } catch (error) {
    console.error("❌ [TRIGGER: notificarStockCritico] Error:", error);
  }
});

// ============================================================================
// 🤖 BOT V1 PROGRAMADO: REPORTE DIARIO DE COBRANZAS (Conserva compatibilidad)
// ============================================================================
exports.botCobranzaDiario = functionsV1.pubsub.schedule("0 8 * * *")
  .timeZone("America/Caracas")
  .onRun(async (context) => {
    try {
      console.log("Iniciando revisión de facturas vencidas...");
      const snap = await db.collection("facturas").get();
      let morosos = [];
      const hoy = new Date();

      snap.forEach(doc => {
        const fac = doc.data();
        const estatus = fac.estatusComercial || "";

        if (estatus.includes("Crédito") && !estatus.includes("Pagado") && estatus !== "Anulada") {
          let totalAbonado = 0;
          if (fac.abonos) fac.abonos.forEach(ab => totalAbonado += (parseFloat(ab.monto) || 0));
          const saldoPendiente = (parseFloat(fac.total) || 0) - totalAbonado;

          const partesFecha = (fac.fecha || "").split("/");
          if (partesFecha.length === 3) {
            let fechaEmision = new Date(`${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}T00:00:00`);
            let diasCredito = estatus.includes("15") ? 15 : (estatus.includes("30") ? 30 : 0);
            
            if (diasCredito > 0) {
              let fechaVenc = new Date(fechaEmision);
              fechaVenc.setDate(fechaVenc.getDate() + diasCredito);
              
              const diffTime = hoy.getTime() - fechaVenc.getTime();
              const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));

              if (diasVencidos > 0 && saldoPendiente > 0) {
                morosos.push(`- Cliente: ${fac.cliente} | Factura: #${fac.nro || doc.id} | Deuda: $${saldoPendiente.toFixed(2)} | Atraso: ${diasVencidos} días`);
              }
            }
          }
        }
      });

      if (morosos.length > 0) {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.warn("Credenciales de email no configuradas. Omitiendo envío de correo.");
          return null;
        }

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: process.env.REPORT_EMAIL || process.env.EMAIL_USER,
          subject: "🚨 Reporte de Morosidad - F&B Parts",
          text: `Se detectaron las siguientes facturas vencidas:\n\n${morosos.join('\n')}\n\n🤖 Bot F&B Parts`
        };

        await transporter.sendMail(mailOptions);
        console.log("Correo enviado. Facturas vencidas:", morosos.length);
      } else {
        console.log("No hay facturas vencidas hoy.");
      }
    } catch (error) {
      console.error("Error en bot de cobranzas:", error);
    }
    return null;
  });

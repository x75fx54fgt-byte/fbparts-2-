const functions = require("firebase-functions/v1"); // ¡Esta es la línea mágica que faltaba!
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
require("dotenv").config();

admin.initializeApp();
const db = admin.firestore();

exports.botCobranzaDiario = functions.pubsub.schedule("0 8 * * *")
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

          const partesFecha = fac.fecha.split("/");
          if (partesFecha.length === 3) {
            let fechaEmision = new Date(`${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}T00:00:00`);
            let diasCredito = estatus.includes("15") ? 15 : (estatus.includes("30") ? 30 : 0);
            
            if (diasCredito > 0) {
              let fechaVenc = new Date(fechaEmision);
              fechaVenc.setDate(fechaVenc.getDate() + diasCredito);
              
              const diffTime = hoy.getTime() - fechaVenc.getTime();
              const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));

              if (diasVencidos > 0 && saldoPendiente > 0) {
                morosos.push(`- Cliente: ${fac.cliente} | Factura: #${fac.nro} | Deuda: $${saldoPendiente.toFixed(2)} | Atraso: ${diasVencidos} días`);
              }
            }
          }
        }
      });

      if (morosos.length > 0) {
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

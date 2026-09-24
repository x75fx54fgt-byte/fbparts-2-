const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

const startImprimir = html.indexOf('window.imprimirCierreMensual = function(formato) {');
const endImprimir = html.indexOf('window.cargarHistorialReventas = async function() {');

if (startImprimir === -1 || endImprimir === -1) throw new Error("Could not find function");

const replacement = `
        window.imprimirCierreMensual = function(formato) {
            if (!window.datosCierreMensual || !window.datosCierreMensual.operaciones) {
                alert("Primero debes generar el cierre haciendo clic en 'Generar Cierre'.");
                return;
            }
            
            const data = window.datosCierreMensual;
            if (data.operaciones.length === 0) {
                alert("No hay operaciones para imprimir en este periodo.");
                return;
            }

            const isTermico = formato === 'termico';
            const numes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mesNombre = numes[parseInt(data.mes, 10)];
            const fechaReporte = new Date().toLocaleDateString('es-VE');

            let filasHtml = '';
            data.operaciones.forEach(op => {
                const ganancia = parseFloat(op.gananciaNetaUSD) || 0;
                if (isTermico) {
                    filasHtml += "<tr><td colspan='2' style='font-weight:bold; padding-top:4px;'>" + op.descripcion + "</td></tr>" +
                                 "<tr><td style='border-bottom:1px dashed #ccc; padding-bottom:4px;'>" + op.fecha + " | Neta:</td>" +
                                 "<td style='border-bottom:1px dashed #ccc; padding-bottom:4px; text-align:right;'>$" + ganancia.toFixed(2) + "</td></tr>";
                } else {
                    filasHtml += "<tr><td style='padding: 8px; border-bottom: 1px solid #eee;'>" + op.fecha + "</td>" +
                                 "<td style='padding: 8px; border-bottom: 1px solid #eee;'>" + op.descripcion + "</td>" +
                                 "<td style='padding: 8px; border-bottom: 1px solid #eee;'>$" + ((parseFloat(op.costoUSD)||0) + (parseFloat(op.gastosUSD)||0)).toFixed(2) + "</td>" +
                                 "<td style='padding: 8px; border-bottom: 1px solid #eee;'>$" + (parseFloat(op.ventaUSD)||0).toFixed(2) + "</td>" +
                                 "<td style='padding: 8px; border-bottom: 1px solid #eee; color:#d9534f;'>$" + (parseFloat(op.comisionTerceroUSD)||0).toFixed(2) + "</td>" +
                                 "<td style='padding: 8px; border-bottom: 1px solid #eee; font-weight:bold; color:#385723;'>$" + ganancia.toFixed(2) + "</td></tr>";
                }
            });

            const htmlContent = isTermico ? "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>@page { size: 58mm 180mm; margin: 0 !important; } html, body { width: 48mm !important; max-width: 48mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; font-family: monospace; font-size: 11px; color: #000; } .ticket-container { padding: 10px 5px; } h3 { font-size: 14px; margin-bottom: 2px; text-align: center; } p { margin: 2px 0; text-align: center; } .line { border-top: 1px dashed #000; margin: 8px 0; } table { width: 100%; font-size: 11px; border-collapse: collapse; color: #000; } td { padding: 2px 0; } .right { text-align: right; } .bold { font-weight: bold; } .no-print { display: none !important; }</style></head><body><div class='ticket-container'><h3>INVERSIONES FB PARTS, C.A.</h3><p>RIF: J-50478082-4</p><p>Urb. La Candelaria, Caracas</p><div class='line'></div><p class='bold'>CIERRE MENS. " + mesNombre.toUpperCase() + " " + data.anio + "</p><p>Generado: " + fechaReporte + "</p><div class='line'></div><p style='text-align:left;'>Inv. Total: <span style='float:right;'>$" + (parseFloat(data.totInvertido)||0).toFixed(2) + "</span></p><p style='text-align:left;'>Ventas Total: <span style='float:right;'>$" + (parseFloat(data.totIngresos)||0).toFixed(2) + "</span></p><p style='text-align:left;'>Comisiones: <span style='float:right;'>-$" + (parseFloat(data.totComisiones)||0).toFixed(2) + "</span></p><div class='line'></div><p style='text-align:left;' class='bold'>GANANCIA NETA: <span style='float:right;'>$" + (parseFloat(data.totNeta)||0).toFixed(2) + "</span></p><div class='line'></div><table>" + filasHtml + "</table><div class='line' style='margin-top:15px;'></div><p style='margin-top:20px;'>Firma Resp.</p><p style='margin-top:30px;'>__________________</p><p style='margin-top:10px;font-weight:bold;'>¡FIN DEL CIERRE!</p></div></body></html>" 
            : "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; padding: 40px; color: #333; } h2 { color: #385723; margin-bottom: 5px; text-transform: uppercase; } p { margin: 3px 0; color: #666; } .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #385723; padding-bottom: 20px; margin-bottom: 20px; } .summary-grid { display: flex; gap: 20px; margin-bottom: 30px; } .summary-card { background: #f9f9f9; padding: 15px; border-radius: 8px; flex: 1; border: 1px solid #eee; text-align: center; } .summary-card h3 { margin: 5px 0; font-size: 22px; color: #333; } .summary-card p { font-size: 12px; margin:0; } table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size:13px; } th { background: #385723; color: white; padding: 10px 8px; text-align: left; } td { padding: 8px; border-bottom: 1px solid #eee; } .signatures { display: flex; justify-content: space-around; margin-top: 60px; } .sig-box { text-align: center; width: 250px; border-top: 1px solid #333; padding-top: 10px; } @media print { body { padding: 0; margin: 20mm; } .no-print { display: none !important; } }</style></head><body><div class='header'><div><h2>INVERSIONES FB PARTS, C.A.</h2><p>RIF: J-50478082-4</p><p>Urb. La Candelaria, Caracas</p></div><div style='text-align: right;'><h3 style='margin:0; color:#385723;'>CIERRE DE MES</h3><p>Período: <strong>" + mesNombre + " " + data.anio + "</strong></p><p>Generado: " + fechaReporte + "</p></div></div><div class='summary-grid'><div class='summary-card'><p>Inversión Total</p><h3>$" + (parseFloat(data.totInvertido)||0).toFixed(2) + "</h3></div><div class='summary-card'><p>Ingresos Brutos</p><h3>$" + (parseFloat(data.totIngresos)||0).toFixed(2) + "</h3></div><div class='summary-card'><p>Comisiones a Terceros</p><h3 style='color:#d9534f;'>-$" + (parseFloat(data.totComisiones)||0).toFixed(2) + "</h3></div><div class='summary-card' style='background:#e8f4ed; border-color:#385723;'><p style='color:#385723;font-weight:bold;'>GANANCIA NETA</p><h3 style='color:#385723;'>$" + (parseFloat(data.totNeta)||0).toFixed(2) + "</h3></div></div><div><p style='text-align:left; font-weight:bold; margin-top:10px;'>Desglose Operaciones:</p><table><tr><th>Fecha</th><th>Descripción</th><th>Costo (Ref)</th><th>Venta (Ref)</th><th>Comisión (Ref)</th><th>Ganancia Neta</th></tr>" + filasHtml + "</table><div class='signatures'><div class='sig-box'><p>Elaborado por</p></div><div class='sig-box'><p>Revisado por</p></div></div></div></body></html>";

            // Print using a hidden iframe to avoid popup blocker issues and Safari source code dumps
            let iframe = document.getElementById('printFrameCierre');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'printFrameCierre';
                iframe.style.position = 'absolute';
                iframe.style.width = '0px';
                iframe.style.height = '0px';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }
            
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 500);
        };

`;

html = html.substring(0, startImprimir) + replacement + html.substring(endImprimir);
html = html.replace(/console\.error\("Error al ejecutar " \+ fnName \+ ":", e\);/g, 
    'console.error("Error al ejecutar " + fnName + ":", e); alert("Error en " + fnName + ": " + e.message);');

fs.writeFileSync('admin.html', html);
console.log("Fixed imprimir and added alerts");

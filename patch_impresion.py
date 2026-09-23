import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Button Text
btn_target = '<button class="refresh-btn" style="background:#333; margin-left:5px;" onclick="imprimirCierreMensual(\'termico\')"><i class="fas fa-receipt"></i> Formato Térmico (80mm)</button>'
btn_replacement = '<button class="refresh-btn" style="background:#333; margin-left:5px;" onclick="imprimirCierreMensual(\'termico\')"><i class="fas fa-receipt"></i> Formato Térmico (58mm)</button>'
if btn_target in content:
    content = content.replace(btn_target, btn_replacement)
    print("Button fixed")

# Fix HTML generation for thermal
termico_target = """            const htmlTermico = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 10px; width: 80mm; color: #000; }
                        h2, h3, h4, p { margin: 2px 0; text-align: center; }
                        .line { border-top: 1px dashed #000; margin: 8px 0; }
                        table { width: 100%; font-size: 12px; border-collapse: collapse; color: #000; }
                        td { padding: 2px 0; }
                        .right { text-align: right; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">
                    <h3>INVERSIONES FB PARTS, C.A.</h3>
                    <p>RIF: J-50478082-4</p>
                    <p>Cierre Mensual</p>
                    <p>Período: ${mesNombre} ${data.anio}</p>
                    <p>Fecha Impresión: ${fechaReporte}</p>
                    <div class="line"></div>
                    <table style="margin-bottom: 10px;">
                        <tr><td>Tasa BCV:</td><td class="right">Bs. ${data.tasaVES.toFixed(2)}</td></tr>
                        <tr><td>Tasa EUR:</td><td class="right">€ ${data.tasaEUR.toFixed(2)}</td></tr>
                    </table>
                    <div class="line"></div>
                    <table>
                        <tr><td>Inversión:</td><td class="right">$${data.totInvertido.toFixed(2)}</td></tr>
                        <tr><td>Ingresos:</td><td class="right">$${data.totIngresos.toFixed(2)}</td></tr>
                        <tr><td>Comisiones:</td><td class="right">-$${data.totComisiones.toFixed(2)}</td></tr>
                        <tr><td class="bold">NETA (USD):</td><td class="right bold" style="font-size:14px;">$${data.totNeta.toFixed(2)}</td></tr>
                        <tr><td>Neta (VES):</td><td class="right">Bs. ${(data.totNeta * data.tasaVES).toFixed(2)}</td></tr>
                    </table>
                    <div class="line"></div>
                    <p style="text-align:left; font-weight:bold; margin-top:10px;">Desglose Neta:</p>
                    <table>
                        ${filasHtml}
                    </table>
                    <div class="line" style="margin-top:15px;"></div>
                    <p style="margin-top:20px;">Firma Resp.</p>
                    <p style="margin-top:30px;">__________________</p>
                </body>
                </html>
            `;"""

termico_replacement = """            const htmlTermico = `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        @page {
                            size: 48mm 210mm;
                            margin: 0 !important;
                        }
                        *, *:before, *:after {
                            box-sizing: border-box !important;
                        }
                        html, body {
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 11px;
                            color: #000;
                        }
                        .ticket-container {
                            width: 100%;
                            padding: 10px 5px;
                        }
                        @media print {
                            @page {
                                size: 58mm auto;
                                margin: 0 !important;
                            }
                            html, body {
                                width: 48mm !important;
                                max-width: 48mm !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                        }
                        h2, h3, h4, p { margin: 2px 0; text-align: center; }
                        .line { border-top: 1px dashed #000; margin: 8px 0; }
                        table { width: 100%; font-size: 11px; border-collapse: collapse; color: #000; }
                        td { padding: 2px 0; }
                        .right { text-align: right; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">
                    <div class="ticket-container">
                        <h3>INVERSIONES FB PARTS, C.A.</h3>
                        <p>RIF: J-50478082-4</p>
                        <p>Cierre Mensual</p>
                        <p>Período: ${mesNombre} ${data.anio}</p>
                        <p>Fecha Impresión: ${fechaReporte}</p>
                        <div class="line"></div>
                        <table style="margin-bottom: 10px;">
                            <tr><td>Tasa BCV:</td><td class="right">Bs. ${data.tasaVES.toFixed(2)}</td></tr>
                            <tr><td>Tasa EUR:</td><td class="right">€ ${data.tasaEUR.toFixed(2)}</td></tr>
                        </table>
                        <div class="line"></div>
                        <table>
                            <tr><td>Inversión:</td><td class="right">$${data.totInvertido.toFixed(2)}</td></tr>
                            <tr><td>Ingresos:</td><td class="right">$${data.totIngresos.toFixed(2)}</td></tr>
                            <tr><td>Comis.:</td><td class="right">-$${data.totComisiones.toFixed(2)}</td></tr>
                            <tr><td class="bold">NETA(USD):</td><td class="right bold" style="font-size:13px;">$${data.totNeta.toFixed(2)}</td></tr>
                            <tr><td>Neta(VES):</td><td class="right">Bs. ${(data.totNeta * data.tasaVES).toFixed(2)}</td></tr>
                        </table>
                        <div class="line"></div>
                        <p style="text-align:left; font-weight:bold; margin-top:10px;">Desglose Neta:</p>
                        <table>
                            ${filasHtml}
                        </table>
                        <div class="line" style="margin-top:15px;"></div>
                        <p style="margin-top:20px;">Firma Resp.</p>
                        <p style="margin-top:30px;">__________________</p>
                    </div>
                </body>
                </html>
            `;"""

if termico_target in content:
    content = content.replace(termico_target, termico_replacement)
    print("Thermal HTML fixed")
else:
    print("Could not find Thermal target")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


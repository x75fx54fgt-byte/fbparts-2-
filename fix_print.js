const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf-8');

// Replace template literals in filasHtml with normal strings
html = html.replace(/filasHtml \+= isTermico \? `[\s\S]*?` : `[\s\S]*?`;/g, `
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
`);

fs.writeFileSync('admin.html', html);
console.log("Fixed filasHtml");

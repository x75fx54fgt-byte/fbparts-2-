import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replace_safe(target, replacement, desc):
    global content
    if target in content:
        content = content.replace(target, replacement)
        print(f"Patched: {desc}")
    else:
        print(f"FAILED to patch: {desc}")

# 1. Menu Button
target_menu = """<button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('reventas', this)"><i class="fas fa-calculator w-5 text-gray-400"></i> Control de Reventas</button>"""

replacement_menu = """<button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('reventas', this)"><i class="fas fa-calculator w-5 text-gray-400"></i> Control de Reventas</button>
                <button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('cierre-mensual', this)"><i class="fas fa-file-invoice-dollar w-5 text-gray-400"></i> Cierre Mensual</button>"""

replace_safe(target_menu, replacement_menu, "Botón Menu Lateral")

# 2. HTML Tab Content (insert after tab-reventas ends)
# Since tab-reventas is long, I will find the start of the next section, which might be another tab or closing div.
# Let's just find `<div id="tab-reventas" class="tab-content">` and insert our block right BEFORE it so it sits nicely in the DOM.
target_tab = """<div id="tab-reventas" class="tab-content">"""
replacement_tab = """
            <div id="tab-cierre-mensual" class="tab-content" style="display: none;">
                <div class="admin-header">
                    <h2>Cierre Mensual - Salud Financiera</h2>
                    <div>
                        <button class="refresh-btn" style="background:#555;" onclick="imprimirCierreMensual('carta')"><i class="fas fa-print"></i> Formato Carta</button>
                        <button class="refresh-btn" style="background:#333; margin-left:5px;" onclick="imprimirCierreMensual('termico')"><i class="fas fa-receipt"></i> Formato Térmico (80mm)</button>
                    </div>
                </div>

                <div class="card-form" style="margin-bottom:20px; display:flex; gap:15px; align-items:flex-end; flex-wrap: wrap;">
                    <div style="flex:1; min-width: 150px;">
                        <label style="font-size:12px; font-weight:bold;">Seleccione el Mes</label>
                        <select id="cierre-mes" class="w-full p-2 border rounded" style="font-size:14px; padding:8px;">
                            <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                            <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                            <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                            <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                        </select>
                    </div>
                    <div style="flex:1; min-width: 100px;">
                        <label style="font-size:12px; font-weight:bold;">Año</label>
                        <input type="number" id="cierre-anio" value="2024" class="w-full p-2 border rounded" style="font-size:14px; padding:8px;">
                    </div>
                    <div>
                        <button onclick="generarCierreMensual()" style="background:#385723; color:white; padding:9px 15px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;"><i class="fas fa-search"></i> Generar Cierre</button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;" id="cierre-tarjetas">
                    <div style="background:white; padding:15px; border-radius:8px; border-left:4px solid #f0ad4e; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <p style="font-size:12px; color:#666; margin:0;">Total Invertido</p>
                        <h3 id="cierre-invertido" style="margin:5px 0; color:#333;">$0.00</h3>
                        <p id="cierre-invertido-alt" style="font-size:11px; color:#999; margin:0;">Bs. 0.00 | €0.00</p>
                    </div>
                    <div style="background:white; padding:15px; border-radius:8px; border-left:4px solid #28a745; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <p style="font-size:12px; color:#666; margin:0;">Total Ingresos (Ventas)</p>
                        <h3 id="cierre-ingresos" style="margin:5px 0; color:#333;">$0.00</h3>
                        <p id="cierre-ingresos-alt" style="font-size:11px; color:#999; margin:0;">Bs. 0.00 | €0.00</p>
                    </div>
                    <div style="background:white; padding:15px; border-radius:8px; border-left:4px solid #d9534f; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <p style="font-size:12px; color:#666; margin:0;">Total Comisiones</p>
                        <h3 id="cierre-comisiones" style="margin:5px 0; color:#333;">$0.00</h3>
                        <p id="cierre-comisiones-alt" style="font-size:11px; color:#999; margin:0;">Bs. 0.00 | €0.00</p>
                    </div>
                    <div style="background:white; padding:15px; border-radius:8px; border-left:4px solid #1d6fa5; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <p style="font-size:12px; color:#666; margin:0;">Ganancia Neta Empresa</p>
                        <h3 id="cierre-neta" style="margin:5px 0; color:#385723; font-weight:bold;">$0.00</h3>
                        <p id="cierre-neta-alt" style="font-size:11px; color:#999; margin:0;">Bs. 0.00 | €0.00</p>
                    </div>
                </div>

                <div class="card-form">
                    <h3><i class="fas fa-list"></i> Detalle de Operaciones del Mes</h3>
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Descripción</th>
                                    <th>Inversión</th>
                                    <th>Ingreso</th>
                                    <th>Comisión</th>
                                    <th>Ganancia Neta</th>
                                </tr>
                            </thead>
                            <tbody id="cierre-table-body">
                                <tr><td colspan="6" style="text-align: center;">Seleccione un mes y año para generar el reporte.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="tab-reventas" class="tab-content">"""
replace_safe(target_tab, replacement_tab, "Tab Content (HTML)")

# 3. Add JS Functions
# Find a good place, for example right before `window.cargarHistorialReventas = async function() {`
target_js = """        window.cargarHistorialReventas = async function() {"""

replacement_js = """        window.generarCierreMensual = async function() {
            const mes = document.getElementById('cierre-mes').value;
            const anio = document.getElementById('cierre-anio').value;
            const btn = document.querySelector('button[onclick="generarCierreMensual()"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;

            try {
                if (typeof window.cargarHistorialReventas === 'function') {
                    try {
                        const bcvSnap = await getDoc(doc(db, "configuracion", "tasa_bcv"));
                        if(bcvSnap.exists()) window.tasaReventaBCV = parseFloat(bcvSnap.data().Valor) || parseFloat(bcvSnap.data().valor) || window.tasaReventaBCV || 1;
                        const eurSnap = await getDoc(doc(db, "configuracion", "tasa_euro"));
                        if(eurSnap.exists()) window.tasaReventaEUR = parseFloat(eurSnap.data().Valor) || parseFloat(eurSnap.data().valor) || window.tasaReventaEUR || 1;
                    } catch(e) {}
                }

                const snap = await getDocs(collection(db, "reventas_gastos"));
                const operaciones = [];
                let totInvertido = 0;
                let totIngresos = 0;
                let totComisiones = 0;
                let totNeta = 0;

                const targetSuffix = `/${mes}/${anio}`; 

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.fecha && data.fecha.endsWith(targetSuffix)) {
                        operaciones.push(data);
                        let costo = parseFloat(data.costoUSD) || 0;
                        let gasto = parseFloat(data.gastosUSD) || 0;
                        totInvertido += (costo + gasto);
                        totIngresos += parseFloat(data.ventaUSD) || 0;
                        totComisiones += parseFloat(data.comisionTerceroUSD) || 0;
                        totNeta += parseFloat(data.gananciaNetaUSD) || 0;
                    }
                });

                const tasaVES = window.tasaReventaBCV || 1;
                const tasaEUR = window.tasaReventaEUR || 1;

                const formatCur = (val, cur, rate) => {
                    return `${cur} ` + (val * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                };

                document.getElementById('cierre-invertido').innerText = `$${totInvertido.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-invertido-alt').innerText = `${formatCur(totInvertido, 'Bs.', tasaVES)} | ${formatCur(totInvertido, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-ingresos').innerText = `$${totIngresos.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-ingresos-alt').innerText = `${formatCur(totIngresos, 'Bs.', tasaVES)} | ${formatCur(totIngresos, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-comisiones').innerText = `$${totComisiones.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-comisiones-alt').innerText = `${formatCur(totComisiones, 'Bs.', tasaVES)} | ${formatCur(totComisiones, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-neta').innerText = `$${totNeta.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-neta-alt').innerText = `${formatCur(totNeta, 'Bs.', tasaVES)} | ${formatCur(totNeta, '€', 1/tasaEUR)}`;

                const tbody = document.getElementById('cierre-table-body');
                if (operaciones.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay operaciones registradas en ${mes}/${anio}.</td></tr>`;
                } else {
                    operaciones.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
                    
                    let html = '';
                    operaciones.forEach(op => {
                        let costoTotal = (parseFloat(op.costoUSD)||0) + (parseFloat(op.gastosUSD)||0);
                        html += `
                            <tr>
                                <td>${op.fecha}</td>
                                <td><strong>${op.descripcion}</strong><br><span style="font-size:11px; color:#555;">${op.cliente || ''}</span></td>
                                <td>$${costoTotal.toFixed(2)}</td>
                                <td>$${(parseFloat(op.ventaUSD) || 0).toFixed(2)}</td>
                                <td><span style="color:#d9534f;">$${(parseFloat(op.comisionTerceroUSD) || 0).toFixed(2)}</span><br><span style="font-size:10px;">${op.intermediario || ''}</span></td>
                                <td><strong style="color:#385723;">$${(parseFloat(op.gananciaNetaUSD) || 0).toFixed(2)}</strong></td>
                            </tr>
                        `;
                    });
                    tbody.innerHTML = html;
                }

                window.datosCierreMensual = {
                    mes, anio,
                    totInvertido, totIngresos, totComisiones, totNeta,
                    operaciones,
                    tasaVES, tasaEUR
                };

            } catch (error) {
                console.error(error);
                alert("Error al generar el cierre mensual.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

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

            const w = window.open('', '_blank');
            const isTermico = formato === 'termico';
            
            const numes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mesNombre = numes[parseInt(data.mes, 10)];
            const fechaReporte = new Date().toLocaleDateString('es-VE');

            let filasHtml = '';
            data.operaciones.forEach(op => {
                const ganancia = parseFloat(op.gananciaNetaUSD) || 0;
                filasHtml += isTermico ? `
                    <tr><td colspan="2" style="font-weight:bold; padding-top:4px;">${op.descripcion}</td></tr>
                    <tr>
                        <td style="border-bottom:1px dashed #ccc; padding-bottom:4px;">${op.fecha} | Neta:</td>
                        <td style="border-bottom:1px dashed #ccc; padding-bottom:4px; text-align:right;">$${ganancia.toFixed(2)}</td>
                    </tr>
                ` : `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${op.fecha}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${op.descripcion}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">$${((parseFloat(op.costoUSD)||0) + (parseFloat(op.gastosUSD)||0)).toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">$${(parseFloat(op.ventaUSD)||0).toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; color:#d9534f;">$${(parseFloat(op.comisionTerceroUSD)||0).toFixed(2)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight:bold; color:#385723;">$${ganancia.toFixed(2)}</td>
                    </tr>
                `;
            });

            const htmlTermico = `
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
            `;

            const htmlCarta = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; padding: 40px; color: #333; }
                        h2 { color: #385723; margin-bottom: 5px; text-transform: uppercase; }
                        p { margin: 3px 0; color: #666; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #385723; padding-bottom: 20px; margin-bottom: 20px; }
                        .summary-grid { display: flex; gap: 20px; margin-bottom: 30px; }
                        .summary-card { background: #f9f9f9; padding: 15px; border-radius: 8px; flex: 1; border: 1px solid #eee; text-align: center; }
                        .summary-card h3 { margin: 5px 0; font-size: 22px; color: #333; }
                        .summary-card p { font-size: 12px; margin:0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size:13px; }
                        th { background: #385723; color: white; padding: 10px 8px; text-align: left; }
                        td { padding: 8px; border-bottom: 1px solid #eee; }
                        .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
                        .sig-box { text-align: center; width: 250px; border-top: 1px solid #333; padding-top: 10px; }
                        @media print {
                            body { padding: 0; margin: 20mm; }
                        }
                    </style>
                </head>
                <body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">
                    <div class="header">
                        <div>
                            <h2>INVERSIONES FB PARTS, C.A.</h2>
                            <p><strong>Reporte de Cierre Financiero (Reventas)</strong></p>
                            <p>Período: ${mesNombre} ${data.anio}</p>
                        </div>
                        <div style="text-align:right;">
                            <p>Fecha Generación: ${fechaReporte}</p>
                            <p>Tasa BCV: Bs. ${data.tasaVES.toFixed(2)}</p>
                            <p>Tasa EUR: € ${data.tasaEUR.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div class="summary-grid">
                        <div class="summary-card" style="border-top: 4px solid #f0ad4e;">
                            <p>Total Invertido</p>
                            <h3>$${data.totInvertido.toLocaleString('en-US', {minimumFractionDigits:2})}</h3>
                        </div>
                        <div class="summary-card" style="border-top: 4px solid #28a745;">
                            <p>Total Ingresos</p>
                            <h3>$${data.totIngresos.toLocaleString('en-US', {minimumFractionDigits:2})}</h3>
                        </div>
                        <div class="summary-card" style="border-top: 4px solid #d9534f;">
                            <p>Comisiones</p>
                            <h3>$${data.totComisiones.toLocaleString('en-US', {minimumFractionDigits:2})}</h3>
                        </div>
                        <div class="summary-card" style="border-top: 4px solid #1d6fa5; background:#e8f4f8;">
                            <p style="color:#1d6fa5; font-weight:bold;">Ganancia Neta Empresa</p>
                            <h3 style="color:#1d6fa5;">$${data.totNeta.toLocaleString('en-US', {minimumFractionDigits:2})}</h3>
                            <p>Bs. ${(data.totNeta * data.tasaVES).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                        </div>
                    </div>

                    <h4 style="margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:5px;">Detalle de Operaciones</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>Inversión</th>
                                <th>Ingreso</th>
                                <th>Comisión</th>
                                <th>Ganancia Neta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHtml}
                        </tbody>
                    </table>

                    <div class="signatures">
                        <div class="sig-box">
                            <strong>Preparado por</strong><br>
                            Firma y Sello
                        </div>
                        <div class="sig-box">
                            <strong>Revisado / Aprobado por</strong><br>
                            Dirección General
                        </div>
                    </div>
                </body>
                </html>
            `;

            w.document.write(isTermico ? htmlTermico : htmlCarta);
            w.document.close();
        };

        window.cargarHistorialReventas = async function() {"""

replace_safe(target_js, replacement_js, "Funciones de JS Cierre Mensual")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


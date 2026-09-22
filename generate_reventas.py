import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Sidebar Button
btn_reventas = """                <button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('reventas', this)"><i class="fas fa-calculator w-5 text-gray-400"></i> Control de Reventas</button>"""
content = re.sub(
    r'(<button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana\(\'importacion\', this\)"><i class="fas fa-calculator w-5 text-gray-400"></i> Landed Cost</button>)',
    r'\1\n' + btn_reventas,
    content
)

# 2. Add HTML Tab Container
html_tab = """
            <!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->
            <div id="tab-reventas" class="tab-content">
                <div class="admin-header">
                    <h2>Control de Reventas y Comisiones</h2>
                    <button class="refresh-btn" onclick="cargarHistorialReventas()"><i class="fas fa-sync-alt"></i> Actualizar Historial</button>
                </div>

                <div class="admin-grid">
                    <!-- Formulario de Ingreso -->
                    <div class="card-form">
                        <h3><i class="fas fa-plus-circle"></i> Registrar Nueva Reventa</h3>
                        <div class="form-group">
                            <label>Descripción de la Operación</label>
                            <input type="text" id="rev-desc" placeholder="Ej: Venta de Motor Cummins" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div class="form-group">
                            <label>Precio de Venta en $</label>
                            <input type="number" id="rev-venta" placeholder="Ej: 1000" step="0.01" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div class="form-group">
                            <label>Costo de Compra al Proveedor en $</label>
                            <input type="number" id="rev-costo" placeholder="Ej: 600" step="0.01" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div class="form-group">
                            <label>Gastos Operativos (envío, banco) en $</label>
                            <input type="number" id="rev-gastos" placeholder="Ej: 50" step="0.01" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div class="form-group">
                            <label>% de Comisión para el Intermediario</label>
                            <input type="number" id="rev-porcentaje" value="50" step="0.1" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>

                        <div style="background: #eef4f8; border: 1px solid #b8daff; border-radius: 6px; padding: 15px; margin-top: 15px;">
                            <h4 style="margin-top: 0; color: #1d6fa5; font-family: 'Oswald', sans-serif;"><i class="fas fa-chart-line"></i> Resumen de Ganancias</h4>
                            
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">
                                <strong>Ganancia Bruta:</strong>
                                <span id="rev-res-bruta">$0.00 | Bs.0.00 | €0.00</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">
                                <strong>Comisión Tercero:</strong>
                                <span id="rev-res-tercero" style="color: #d9534f;">$0.00 | Bs.0.00 | €0.00</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 16px;">
                                <strong style="color: #28a745;">Neta Empresa:</strong>
                                <strong id="rev-res-neta" style="color: #28a745;">$0.00 | Bs.0.00 | €0.00</strong>
                            </div>
                        </div>

                        <button type="button" class="btn-confirm-order" onclick="guardarReventa()" style="width: 100%; margin-top: 20px; background: #385723; color: white; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                            <i class="fas fa-save"></i> Guardar Operación
                        </button>
                    </div>

                    <!-- Tabla de Historial -->
                    <div class="card-form" style="grid-column: 2 / 3;">
                        <h3><i class="fas fa-list-alt"></i> Historial de Reventas</h3>
                        <div style="overflow-x: auto;">
                            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Descripción</th>
                                        <th>Ingreso</th>
                                        <th>Costo Total</th>
                                        <th>Intermediario</th>
                                        <th>Neta Empresa</th>
                                    </tr>
                                </thead>
                                <tbody id="reventas-table-body">
                                    <tr><td colspan="6" style="text-align: center;">Cargando historial...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
"""

# Find injection point: after </div> of tab-rutas. It's before <!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->
content = content.replace("    <!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->", html_tab + "\n    <!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->")

# 3. Add to Startup Sequence
content = content.replace("await runSafe('cargarHistorialImportaciones');", "await runSafe('cargarHistorialImportaciones');\n            await runSafe('cargarHistorialReventas');")

# 4. Add JS Functions
js_functions = """
        // ==========================================
        // 🚀 MÓDULO DE REVENTAS Y COMISIONES
        // ==========================================
        
        // Variables globales para las tasas de reventa (se actualizan al cargar el historial)
        window.tasaReventaBCV = 42.00;
        window.tasaReventaEUR = 1.08;

        window.calcularReventa = function() {
            const venta = parseFloat(document.getElementById('rev-venta').value) || 0;
            const costo = parseFloat(document.getElementById('rev-costo').value) || 0;
            const gastos = parseFloat(document.getElementById('rev-gastos').value) || 0;
            const porcentaje = parseFloat(document.getElementById('rev-porcentaje').value) || 0;

            const gananciaBruta = venta - costo - gastos;
            const comisionTercero = gananciaBruta * (porcentaje / 100);
            const gananciaNeta = gananciaBruta - comisionTercero;

            // Reutilizamos la lógica y variables de tasas BCV y EUR leídas del sistema
            const tasaVES = window.tasaReventaBCV;
            const tasaEUR = window.tasaReventaEUR;
            
            const renderMonedas = (montoUSD) => {
                const ves = (montoUSD * tasaVES).toFixed(2);
                const eur = (montoUSD / tasaEUR).toFixed(2);
                return `$${montoUSD.toFixed(2)} | Bs.${ves} | €${eur}`;
            };

            document.getElementById('rev-res-bruta').textContent = renderMonedas(gananciaBruta);
            document.getElementById('rev-res-tercero').textContent = renderMonedas(comisionTercero);
            document.getElementById('rev-res-neta').textContent = renderMonedas(gananciaNeta);
            
            return {
                venta, costo, gastos, porcentaje,
                gananciaBruta, comisionTercero, gananciaNeta,
                tasaVES, tasaEUR
            };
        };

        window.guardarReventa = async function() {
            const desc = document.getElementById('rev-desc').value.trim();
            if (!desc) { alert("Por favor ingresa una descripción para la operación."); return; }
            
            const calc = window.calcularReventa();
            
            try {
                await addDoc(collection(db, "reventas_gastos"), {
                    descripcion: desc,
                    fecha: new Date().toLocaleDateString("es-VE"),
                    timestamp: new Date().getTime(),
                    ventaUSD: calc.venta,
                    costoUSD: calc.costo,
                    gastosUSD: calc.gastos,
                    porcentajeComision: calc.porcentaje,
                    gananciaBrutaUSD: calc.gananciaBruta,
                    comisionTerceroUSD: calc.comisionTercero,
                    gananciaNetaUSD: calc.gananciaNeta,
                    tasaCambioVES: calc.tasaVES,
                    tasaCambioEUR: calc.tasaEUR
                });
                
                alert("Operación de reventa registrada con éxito.");
                document.getElementById('rev-desc').value = "";
                document.getElementById('rev-venta').value = "";
                document.getElementById('rev-costo').value = "";
                document.getElementById('rev-gastos').value = "";
                window.calcularReventa();
                window.cargarHistorialReventas();
                
            } catch (error) {
                console.error("Error guardando reventa:", error);
                alert("Hubo un error al guardar la reventa.");
            }
        };

        window.cargarHistorialReventas = async function() {
            // Reutilizando la lógica de extracción de tasas de Firebase (igual al Dashboard)
            try {
                const bcvSnap = await getDoc(doc(db, "configuracion", "tasa_bcv"));
                if(bcvSnap.exists()) {
                    window.tasaReventaBCV = parseFloat(bcvSnap.data().Valor) || parseFloat(bcvSnap.data().valor) || window.tasaReventaBCV;
                }
                const eurSnap = await getDoc(doc(db, "configuracion", "tasa_euro"));
                if(eurSnap.exists()) {
                    window.tasaReventaEUR = parseFloat(eurSnap.data().Valor) || parseFloat(eurSnap.data().valor) || window.tasaReventaEUR;
                }
                // Refrescar cálculos visuales con las nuevas tasas
                window.calcularReventa();
            } catch(e) { console.warn("Error leyendo tasas para reventas"); }

            const tbody = document.getElementById('reventas-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando historial de reventas...</td></tr>';
            
            try {
                const snap = await getDocs(collection(db, "reventas_gastos"));
                if (snap.empty) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay operaciones registradas.</td></tr>';
                    return;
                }
                
                let html = '';
                let totalNeta = 0;
                
                const reventas = [];
                snap.forEach(docSnap => reventas.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Ordenar por timestamp (más recientes primero)
                reventas.sort((a, b) => b.timestamp - a.timestamp);
                
                reventas.forEach(rev => {
                    const costoTotal = (rev.costoUSD || 0) + (rev.gastosUSD || 0);
                    // Usa la tasa histórica grabada, sino usa la global actual
                    const tasaUsoVES = rev.tasaCambioVES || window.tasaReventaBCV;
                    const ventaVES = ((rev.ventaUSD || 0) * tasaUsoVES).toFixed(2);
                    const netaVES = ((rev.gananciaNetaUSD || 0) * tasaUsoVES).toFixed(2);
                    
                    totalNeta += (rev.gananciaNetaUSD || 0);
                    
                    html += `
                        <tr>
                            <td>${rev.fecha}</td>
                            <td><strong>${rev.descripcion}</strong></td>
                            <td>$${(rev.ventaUSD || 0).toFixed(2)}<br><span style="font-size:10px; color:#666;">Bs.${ventaVES}</span></td>
                            <td>$${costoTotal.toFixed(2)}</td>
                            <td><span style="color: #d9534f; font-weight: bold;">$${(rev.comisionTerceroUSD || 0).toFixed(2)}</span></td>
                            <td><span style="color: #28a745; font-weight: bold;">$${(rev.gananciaNetaUSD || 0).toFixed(2)}</span><br><span style="font-size:10px; color:#666;">Bs.${netaVES}</span></td>
                        </tr>
                    `;
                });
                
                // Añadir fila de totales
                html += `
                    <tr style="background: #eef4f8; font-weight: bold; border-top: 2px solid #b8daff;">
                        <td colspan="4" style="text-align: right;">TOTAL GANANCIA NETA GLOBAL:</td>
                        <td colspan="2" style="color: #28a745; font-size: 16px;">$${totalNeta.toFixed(2)}</td>
                    </tr>
                `;
                
                tbody.innerHTML = html;
                
            } catch (error) {
                console.error("Error cargando reventas:", error);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar el historial.</td></tr>';
            }
        };
"""

content = content.replace("    </script>\n</body>", js_functions + "\n    </script>\n</body>")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Script injected!")

import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update HTML Form
old_form_1 = """                        <div class="form-group">
                            <label>Descripción de la Operación</label>
                            <input type="text" id="rev-desc" placeholder="Ej: Venta de Motor Cummins" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>"""

new_form_1 = """                        <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label>Descripción / Repuesto</label>
                                <input type="text" id="rev-desc" placeholder="Ej: Venta de Motor Cummins" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                            <div>
                                <label>Cliente Final</label>
                                <input type="text" id="rev-cliente" placeholder="Ej: Transporte ABC" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                        </div>"""

content = content.replace(old_form_1, new_form_1)

old_form_2 = """                        <div class="form-group">
                            <label>% de Comisión para el Intermediario</label>
                            <input type="number" id="rev-porcentaje" value="50" step="0.1" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>"""

new_form_2 = """                        <div class="form-group" style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                            <div>
                                <label>Nombre del Intermediario</label>
                                <input type="text" id="rev-intermediario" placeholder="Ej: Pedro Pérez" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                            <div>
                                <label>% Comisión</label>
                                <input type="number" id="rev-porcentaje" value="50" step="0.1" oninput="calcularReventa()" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                        </div>"""

content = content.replace(old_form_2, new_form_2)


# 2. Update guardarReventa
old_guardar = """        window.guardarReventa = async function() {
            const desc = document.getElementById('rev-desc').value.trim();
            if (!desc) { alert("Por favor ingresa una descripción para la operación."); return; }
            
            const calc = window.calcularReventa();
            
            try {
                await addDoc(collection(db, "reventas_gastos"), {
                    descripcion: desc,
                    fecha: new Date().toLocaleDateString("es-VE"),"""

new_guardar = """        window.guardarReventa = async function() {
            const desc = document.getElementById('rev-desc').value.trim();
            const cliente = document.getElementById('rev-cliente').value.trim();
            const intermediario = document.getElementById('rev-intermediario').value.trim();
            if (!desc) { alert("Por favor ingresa una descripción para la operación."); return; }
            
            const calc = window.calcularReventa();
            
            try {
                await addDoc(collection(db, "reventas_gastos"), {
                    descripcion: desc,
                    cliente: cliente,
                    intermediario: intermediario,
                    fecha: new Date().toLocaleDateString("es-VE"),"""

content = content.replace(old_guardar, new_guardar)

old_clear = """                document.getElementById('rev-desc').value = "";
                document.getElementById('rev-venta').value = "";
                document.getElementById('rev-costo').value = "";
                document.getElementById('rev-gastos').value = "";"""

new_clear = """                document.getElementById('rev-desc').value = "";
                document.getElementById('rev-cliente').value = "";
                document.getElementById('rev-intermediario').value = "";
                document.getElementById('rev-venta').value = "";
                document.getElementById('rev-costo').value = "";
                document.getElementById('rev-gastos').value = "";"""

content = content.replace(old_clear, new_clear)

# 3. Update Tabla Rendering
old_row = """                            <td><strong>${rev.descripcion}</strong></td>
                            <td>$${(rev.ventaUSD || 0).toFixed(2)}<br><span style="font-size:10px; color:#666;">Bs.${ventaVES}</span></td>
                            <td>$${costoTotal.toFixed(2)}</td>
                            <td><span style="color: #d9534f; font-weight: bold;">$${(rev.comisionTerceroUSD || 0).toFixed(2)}</span></td>"""

new_row = """                            <td><strong>${rev.descripcion}</strong><br><span style="font-size:11px; color:#555;">Cliente: ${rev.cliente || 'N/A'}</span></td>
                            <td>$${(rev.ventaUSD || 0).toFixed(2)}<br><span style="font-size:10px; color:#666;">Bs.${ventaVES}</span></td>
                            <td>$${costoTotal.toFixed(2)}</td>
                            <td>${rev.intermediario || 'N/A'}<br><span style="color: #d9534f; font-weight: bold;">$${(rev.comisionTerceroUSD || 0).toFixed(2)}</span></td>"""

content = content.replace(old_row, new_row)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

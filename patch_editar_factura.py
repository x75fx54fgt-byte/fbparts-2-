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
        # Try to find exactly what's wrong by showing a snippet
        # Not strictly needed since this runs sequentially, but good for debug

# 1. Update the HTML Modal
target_html = """    <div id="modal-editar-factura" class="modal-overlay">
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="color: #6c757d;"><i class="fas fa-edit"></i> Corregir Factura</h3>
            <p style="font-size: 13px; color: #666; margin-top: -10px; margin-bottom: 15px;">Corrige el número de control o la fecha de emisión.</p>
            <input type="hidden" id="edit-fac-id">
            
            <div class="form-group">
                <label>Nro. de Factura / Control</label>
                <input type="text" id="edit-fac-nro" style="font-weight: bold; color: #385723;" placeholder="Ej: 00000617">
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="text" id="edit-fac-fecha" placeholder="DD/MM/YYYY">
            </div>
            
            <div class="modal-actions">"""

replacement_html = """    <div id="modal-editar-factura" class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
            <h3 style="color: #6c757d;"><i class="fas fa-edit"></i> Corregir Factura</h3>
            <p style="font-size: 13px; color: #666; margin-top: -10px; margin-bottom: 15px;">Corrige logística y detalles de los repuestos.</p>
            <input type="hidden" id="edit-fac-id">
            
            <div style="display: flex; gap: 10px;">
                <div class="form-group" style="flex: 1;">
                    <label>Nro. de Factura / Control</label>
                    <input type="text" id="edit-fac-nro" style="font-weight: bold; color: #385723;" placeholder="Ej: 00000617">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Fecha</label>
                    <input type="text" id="edit-fac-fecha" placeholder="DD/MM/YYYY">
                </div>
            </div>

            <h4 style="font-size: 14px; margin-bottom: 10px; color: #444; border-bottom: 1px solid #eee; padding-bottom: 5px;">Detalles de Productos</h4>
            <div id="edit-fac-items-container" style="max-height: 250px; overflow-y: auto; margin-bottom: 15px;">
                <!-- items rendered here -->
            </div>
            
            <div class="modal-actions">"""
replace_safe(target_html, replacement_html, "HTML Modal")

# 2. Update abrirModalEditarFactura
target_abrir = """        window.abrirModalEditarFactura = function(docId) {
            const fac = window.facturasDBLocal[docId];
            if(!fac) return;
            document.getElementById('edit-fac-id').value = docId;
            document.getElementById('edit-fac-nro').value = fac.nro || '';
            document.getElementById('edit-fac-fecha').value = fac.fecha || '';
            document.getElementById('modal-editar-factura').style.display = 'flex';
        };"""

replacement_abrir = """        window.abrirModalEditarFactura = function(docId) {
            const fac = window.facturasDBLocal[docId];
            if(!fac) return;
            document.getElementById('edit-fac-id').value = docId;
            document.getElementById('edit-fac-nro').value = fac.nro || '';
            document.getElementById('edit-fac-fecha').value = fac.fecha || '';
            
            const container = document.getElementById('edit-fac-items-container');
            container.innerHTML = '';
            
            if (fac.items && fac.items.length > 0) {
                fac.items.forEach((item, index) => {
                    const cant = parseFloat(item.cantidad) || 1;
                    const preU = parseFloat(item.precioUnitario) || 0;
                    const preTotal = (cant * preU).toFixed(2);
                    
                    const div = document.createElement('div');
                    div.style = "background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 10px;";
                    div.innerHTML = `
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px;">Descripción del Repuesto</label>
                            <input type="text" class="edit-item-desc" value="${item.descripcion || ''}">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Cantidad</label>
                                <input type="number" step="0.01" class="edit-item-cant" value="${cant}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Precio Total ($)</label>
                                <input type="number" step="0.01" class="edit-item-preciototal" value="${preTotal}">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="font-size: 12px; color: #999;">Esta factura no tiene productos detallados.</p>';
            }

            document.getElementById('modal-editar-factura').style.display = 'flex';
        };"""
replace_safe(target_abrir, replacement_abrir, "Abrir Modal")

# 3. Update guardarEdicionFactura
target_guardar = """        window.guardarEdicionFactura = async function() {
            const docId = document.getElementById('edit-fac-id').value;
            const nuevoNro = document.getElementById('edit-fac-nro').value.trim();
            const nuevaFecha = document.getElementById('edit-fac-fecha').value.trim();
            
            if(!nuevoNro) { alert("El número de factura no puede estar vacío."); return; }

            try {
                await updateDoc(doc(db, "facturas", docId), {
                    nro: nuevoNro,
                    fecha: nuevaFecha
                });
                document.getElementById('modal-editar-factura').style.display = 'none';
                window.cargarHistorialFacturas();
                window.cargarFinanzas(); // Actualizar finanzas por si estaba pendiente
            } catch (error) {
                console.error("Error editando factura:", error);
                alert("Hubo un error al guardar los cambios.");
            }
        };"""

replacement_guardar = """        window.guardarEdicionFactura = async function() {
            const docId = document.getElementById('edit-fac-id').value;
            const nuevoNro = document.getElementById('edit-fac-nro').value.trim();
            const nuevaFecha = document.getElementById('edit-fac-fecha').value.trim();
            
            if(!nuevoNro) { alert("El número de factura no puede estar vacío."); return; }

            const fac = window.facturasDBLocal[docId];
            if(!fac) return;

            let updatedItems = [];
            let newSubtotal = 0;
            
            // Reconstruir items si existen
            if (fac.items && fac.items.length > 0) {
                const descInputs = document.querySelectorAll('.edit-item-desc');
                const cantInputs = document.querySelectorAll('.edit-item-cant');
                const precioTotalInputs = document.querySelectorAll('.edit-item-preciototal');
                
                for(let i = 0; i < fac.items.length; i++) {
                    let oldItem = fac.items[i];
                    let desc = descInputs[i] ? descInputs[i].value.trim() : oldItem.descripcion;
                    let cant = cantInputs[i] ? parseFloat(cantInputs[i].value) : parseFloat(oldItem.cantidad);
                    let oldCant = parseFloat(oldItem.cantidad) || 1;
                    let oldPreU = parseFloat(oldItem.precioUnitario) || 0;
                    let preTotal = precioTotalInputs[i] ? parseFloat(precioTotalInputs[i].value) : (oldCant * oldPreU);
                    
                    if(isNaN(cant) || cant <= 0) cant = 1;
                    if(isNaN(preTotal) || preTotal < 0) preTotal = 0;
                    
                    let precioUnitario = preTotal / cant;
                    
                    updatedItems.push({
                        ...oldItem,
                        descripcion: desc,
                        cantidad: cant,
                        precioUnitario: precioUnitario
                    });
                    newSubtotal += preTotal;
                }
            } else {
                updatedItems = fac.items || [];
                newSubtotal = parseFloat(fac.subtotal) || 0;
            }

            // Recalcular Total e IVA (respetando los descuentos existentes)
            let descuento = parseFloat(fac.descuento) || 0;
            let baseImp = newSubtotal - descuento;
            let currentIva = parseFloat(fac.iva) || 0;
            let iva = 0;
            if (currentIva > 0 && parseFloat(fac.subtotal) > 0) {
                // Hay IVA, calculamos el % original
                let ivaPorcentaje = currentIva / (parseFloat(fac.subtotal) - descuento);
                iva = baseImp * ivaPorcentaje;
            }
            let newTotal = baseImp + iva;

            try {
                let updateData = {
                    nro: nuevoNro,
                    fecha: nuevaFecha,
                    items: updatedItems,
                    subtotal: newSubtotal.toFixed(2),
                    total: newTotal.toFixed(2)
                };
                if(currentIva > 0) { updateData.iva = iva.toFixed(2); }

                await updateDoc(doc(db, "facturas", docId), updateData);
                
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("EDITAR DETALLE DE FACTURA", "Se modificó el producto/precio de la factura #" + nuevoNro);
                }

                document.getElementById('modal-editar-factura').style.display = 'none';
                window.cargarHistorialFacturas();
                window.cargarFinanzas();
            } catch (error) {
                console.error("Error editando factura:", error);
                alert("Hubo un error al guardar los cambios.");
            }
        };"""
replace_safe(target_guardar, replacement_guardar, "Guardar Factura")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


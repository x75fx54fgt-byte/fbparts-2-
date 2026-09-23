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

# 1. HTML Modal Pedido
target_html = """            <div class="form-group">
                <label>Estado del Pedido</label>
                <select id="edit-pedido-estado"><option value="Pendiente">Pendiente</option><option value="Procesando">Procesando</option><option value="Enviado">Enviado</option><option value="Entregado">Entregado</option></select>
            </div>
            <div class="modal-actions">"""

replacement_html = """            <div class="form-group">
                <label>Estado del Pedido</label>
                <select id="edit-pedido-estado"><option value="Pendiente">Pendiente</option><option value="Procesando">Procesando</option><option value="Enviado">Enviado</option><option value="Entregado">Entregado</option></select>
            </div>

            <!-- NUEVA ZONA: DETALLES DEL PRODUCTO -->
            <h4 style="font-size: 14px; margin-top: 15px; margin-bottom: 10px; color: #444; border-bottom: 1px solid #eee; padding-bottom: 5px;"><i class="fas fa-box"></i> Detalles del Producto</h4>
            <div id="edit-pedido-productos-container" style="max-height: 200px; overflow-y: auto; margin-bottom: 15px; border-radius: 6px;">
                <!-- items rendered here -->
            </div>

            <div class="modal-actions">"""
replace_safe(target_html, replacement_html, "HTML Modal Pedido")

# 2. abrirModalPedido (last one around 6668)
target_abrir = """            document.getElementById('edit-pedido-motorizado').value = ped.motorizado || '';
            document.getElementById('edit-pedido-tarifa').value = ped.tarifaMotorizado || '';
            document.getElementById('edit-pedido-ruta').value = ped.rutasMotorizado || '';
            
            window.mostrarOpcionesMotorizado();
            document.getElementById('modal-pedido').style.display = 'flex';
        };"""

replacement_abrir = """            document.getElementById('edit-pedido-motorizado').value = ped.motorizado || '';
            document.getElementById('edit-pedido-tarifa').value = ped.tarifaMotorizado || '';
            document.getElementById('edit-pedido-ruta').value = ped.rutasMotorizado || '';
            
            window.mostrarOpcionesMotorizado();

            const container = document.getElementById('edit-pedido-productos-container');
            container.innerHTML = '';
            
            let productosList = [];
            if (ped.productos && Array.isArray(ped.productos)) {
                productosList = ped.productos;
            } else if (ped.producto) {
                // Formato antiguo
                let preUni = (parseFloat(ped.total) || 0) / (parseFloat(ped.cantidad) || 1);
                productosList = [{ nombre: ped.producto, cantidad: ped.cantidad, precio: preUni }];
            }

            if (productosList.length > 0) {
                productosList.forEach((prod, index) => {
                    const cant = parseFloat(prod.cantidad) || 1;
                    const preUnitario = parseFloat(prod.precio) || 0;
                    const preTotal = (cant * preUnitario).toFixed(2);
                    
                    const div = document.createElement('div');
                    div.style = "background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 10px;";
                    div.innerHTML = `
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px;">Descripción del Repuesto</label>
                            <input type="text" class="edit-ped-item-desc" value="${prod.nombre || ''}">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Cantidad</label>
                                <input type="number" step="0.01" class="edit-ped-item-cant" value="${cant}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Precio Total ($)</label>
                                <input type="number" step="0.01" class="edit-ped-item-preciototal" value="${preTotal}">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="font-size: 12px; color: #999;">Este pedido no tiene productos registrados.</p>';
            }

            document.getElementById('modal-pedido').style.display = 'flex';
        };"""
replace_safe(target_abrir, replacement_abrir, "Abrir Modal Pedido")

# 3. guardarCambiosPedido
target_guardar = """            const datosActualizados = {
                email: document.getElementById('edit-pedido-email').value.trim(),
                cliente: document.getElementById('edit-pedido-cliente').value.trim(),
                envio: envioVal,
                tracking: trackingVal,
                trackingMotorizado: trackingMotVal,
                estado: document.getElementById('edit-pedido-estado').value,
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? (pedOriginal.pagoMotorizadoEstatus || 'Pendiente') : '',
                rutasMotorizado: document.getElementById('edit-pedido-ruta').value.trim()
            };

            try {
                await updateDoc(doc(db, "pedidos", docId), datosActualizados);
                window.cerrarModalPedido();
                window.cargarPedidos();
            } catch (error) { """

replacement_guardar = """            let updatedProductos = [];
            let newTotal = 0;
            const descInputs = document.querySelectorAll('.edit-ped-item-desc');
            const cantInputs = document.querySelectorAll('.edit-ped-item-cant');
            const precioTotalInputs = document.querySelectorAll('.edit-ped-item-preciototal');
            
            for(let i = 0; i < descInputs.length; i++) {
                let desc = descInputs[i].value.trim();
                let cant = parseFloat(cantInputs[i].value) || 1;
                let preTotal = parseFloat(precioTotalInputs[i].value) || 0;
                
                if(cant <= 0) cant = 1;
                let precioUnitario = preTotal / cant;
                
                updatedProductos.push({
                    nombre: desc,
                    cantidad: cant,
                    precio: precioUnitario
                });
                newTotal += preTotal;
            }

            const datosActualizados = {
                email: document.getElementById('edit-pedido-email').value.trim(),
                cliente: document.getElementById('edit-pedido-cliente').value.trim(),
                envio: envioVal,
                tracking: trackingVal,
                trackingMotorizado: trackingMotVal,
                estado: document.getElementById('edit-pedido-estado').value,
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? (pedOriginal.pagoMotorizadoEstatus || 'Pendiente') : '',
                rutasMotorizado: document.getElementById('edit-pedido-ruta').value.trim(),
                productos: updatedProductos.length > 0 ? updatedProductos : pedOriginal.productos,
                total: updatedProductos.length > 0 ? newTotal.toFixed(2) : pedOriginal.total
            };

            // Remover campos legacy para no causar ruido si existian
            datosActualizados.producto = null;
            datosActualizados.cantidad = null;

            try {
                // Se limpian los nulls
                for (let key in datosActualizados) {
                    if (datosActualizados[key] === null) delete datosActualizados[key];
                }
                
                await updateDoc(doc(db, "pedidos", docId), datosActualizados);
                
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("EDITAR DETALLE DE PEDIDO", "Se modificó logística/producto del pedido: " + datosActualizados.cliente);
                }
                
                window.cerrarModalPedido();
                window.cargarPedidos();
                window.cargarDashboard();
            } catch (error) { """
replace_safe(target_guardar, replacement_guardar, "Guardar Modal Pedido")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


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

# 1. Login
target_login = """                    try {
                        localStorage.setItem('fyb_admin_session', JSON.stringify({
                            email: userEmail,
                            localId: user.uid,
                            timestamp: Date.now()
                        }));
                    } catch(e) {}
                    desbloquearPanelAdmin("BAPA", "Administrador Maestro");"""
replacement_login = """                    try {
                        localStorage.setItem('fyb_admin_session', JSON.stringify({
                            email: userEmail,
                            localId: user.uid,
                            timestamp: Date.now()
                        }));
                    } catch(e) {}
                    
                    if (!sessionStorage.getItem('audit_login_done')) {
                        sessionStorage.setItem('audit_login_done', 'true');
                        setTimeout(() => { if(window.registrarAuditoria) window.registrarAuditoria("LOGIN", "El usuario inició sesión en el panel."); }, 2000);
                    }
                    
                    desbloquearPanelAdmin("BAPA", "Administrador Maestro");"""
replace_safe(target_login, replacement_login, "Login")

# 2. Logout
target_logout = """        window.cerrarSesion = function() {
            if(confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                try {"""
replacement_logout = """        window.cerrarSesion = function() {
            if(confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                if(window.registrarAuditoria) window.registrarAuditoria("LOGOUT", "El usuario cerró sesión en el panel.");
                try {"""
replace_safe(target_logout, replacement_logout, "Logout")

# 3. Eliminar Reventa
target_reventa = """        window.cargarHistorialReventas = async function() {"""
replacement_reventa = """        window.eliminarReventa = async function(docId) {
            if(!confirm("¿Eliminar esta operación de reventa?")) return;
            try {
                await deleteDoc(doc(db, "reventas_gastos", docId));
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR REVENTA", "Se eliminó la reventa con ID: " + docId);
                window.cargarHistorialReventas();
                if(window.cargarDashboard) window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error al eliminar la reventa."); }
        };

        window.cargarHistorialReventas = async function() {"""
replace_safe(target_reventa, replacement_reventa, "Eliminar Reventa")

# 4. Cambiar Estatus Factura
target_estatus = """            try {
                await updateDoc(doc(db, tipoDocumento, docId), dataUpdate);
                if (tipoDocumento === 'facturas') {"""
replacement_estatus = """            try {
                await updateDoc(doc(db, tipoDocumento, docId), dataUpdate);
                if(window.registrarAuditoria) {
                    if (tipoDocumento === 'facturas') {
                        let fac = window.facturasDBLocal ? window.facturasDBLocal[docId] : null;
                        let nro = fac ? fac.nro : docId;
                        window.registrarAuditoria("CAMBIO DE ESTATUS FACTURA", "Factura #" + nro + " cambiada a: " + nuevoEstatus);
                    } else if (tipoDocumento === 'cotizaciones') {
                        window.registrarAuditoria("CAMBIO ESTATUS COTIZACIÓN", "Cotización ID " + docId + " cambiada a: " + nuevoEstatus);
                    }
                }
                if (tipoDocumento === 'facturas') {"""
replace_safe(target_estatus, replacement_estatus, "Cambio Estatus Factura")

# 5. Eliminar Factura
target_del_fac = """                    btnEliminar.addEventListener('click', async () => {
                        if(!confirm("¿Eliminar esta factura del historial?")) return;
                        try { await deleteDoc(doc(db, "facturas", docId)); window.cargarHistorialFacturas(); window.cargarDashboard(); window.cargarFinanzas(); } catch (e) { alert("Error al eliminar."); }
                    });"""
replacement_del_fac = """                    btnEliminar.addEventListener('click', async () => {
                        if(!confirm("¿Eliminar esta factura del historial?")) return;
                        try { 
                            await deleteDoc(doc(db, "facturas", docId)); 
                            if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR FACTURA", "Se eliminó la factura número: " + fac.nro);
                            window.cargarHistorialFacturas(); window.cargarDashboard(); window.cargarFinanzas(); 
                        } catch (e) { alert("Error al eliminar."); }
                    });"""
replace_safe(target_del_fac, replacement_del_fac, "Eliminar Factura")

# 6. Guardar / Editar Cliente
target_save_cli = """                if(docId) {
                    await updateDoc(doc(db, "clientes", docId), dataCliente);
                    alert("¡Cliente actualizado con éxito!");
                } else {
                    await addDoc(collection(db, "clientes"), dataCliente);
                    alert("¡Cliente registrado en la base de datos con éxito!");
                }"""
replacement_save_cli = """                if(docId) {
                    await updateDoc(doc(db, "clientes", docId), dataCliente);
                    if(window.registrarAuditoria) window.registrarAuditoria("EDITAR CLIENTE", "Se modificó el cliente: " + dataCliente.nombre + " (" + dataCliente.rif + ")");
                    alert("¡Cliente actualizado con éxito!");
                } else {
                    await addDoc(collection(db, "clientes"), dataCliente);
                    if(window.registrarAuditoria) window.registrarAuditoria("CREAR CLIENTE", "Se registró el cliente: " + dataCliente.nombre + " (" + dataCliente.rif + ")");
                    alert("¡Cliente registrado en la base de datos con éxito!");
                }"""
replace_safe(target_save_cli, replacement_save_cli, "Guardar Cliente")

# 7. Eliminar Cliente
target_del_cli = """        window.eliminarClienteDB = async function(docId) {
            if(!confirm("¿Eliminar este cliente de la base de datos?")) return;
            try { await deleteDoc(doc(db, "clientes", docId)); window.cargarBaseClientes(); } catch (error) { console.error(error); }
        };"""
replacement_del_cli = """        window.eliminarClienteDB = async function(docId) {
            if(!confirm("¿Eliminar este cliente de la base de datos?")) return;
            try { 
                let c = window.clientesDBLocal ? window.clientesDBLocal[docId] : null;
                let cname = c ? c.nombre : docId;
                await deleteDoc(doc(db, "clientes", docId)); 
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR CLIENTE", "Se eliminó el cliente: " + cname);
                window.cargarBaseClientes(); 
            } catch (error) { console.error(error); }
        };"""
replace_safe(target_del_cli, replacement_del_cli, "Eliminar Cliente")

# 8. Guardar/Editar Producto
target_save_prod = """            try {
                await updateDoc(doc(db, "productos", docId), datosActualizados);
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Ocurrió un error al guardar los cambios."); }"""
replacement_save_prod = """            try {
                await updateDoc(doc(db, "productos", docId), datosActualizados);
                if(window.registrarAuditoria) window.registrarAuditoria("EDITAR PRODUCTO", "Se modificó el producto: " + datosActualizados.nombre);
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Ocurrió un error al guardar los cambios."); }"""
replace_safe(target_save_prod, replacement_save_prod, "Guardar Producto")

# 9. Eliminar Producto
target_del_prod = """        window.eliminarProducto = async function() {
            const docId = document.getElementById('edit-id').value;
            if(!confirm("¿Estás seguro de eliminar permanentemente este repuesto?")) return;
            try {
                await deleteDoc(doc(db, "productos", docId));
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin(); 
                window.cargarDashboard();
                alert("Repuesto eliminado con éxito.");
            } catch (error) { console.error(error); alert("No se pudo eliminar el repuesto."); }
        };"""
replacement_del_prod = """        window.eliminarProducto = async function() {
            const docId = document.getElementById('edit-id').value;
            const nombreProd = document.getElementById('edit-nombre').value;
            if(!confirm("¿Estás seguro de eliminar permanentemente este repuesto?")) return;
            try {
                await deleteDoc(doc(db, "productos", docId));
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR PRODUCTO", "Se eliminó el producto: " + nombreProd);
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin(); 
                window.cargarDashboard();
                alert("Repuesto eliminado con éxito.");
            } catch (error) { console.error(error); alert("No se pudo eliminar el repuesto."); }
        };"""
replace_safe(target_del_prod, replacement_del_prod, "Eliminar Producto")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


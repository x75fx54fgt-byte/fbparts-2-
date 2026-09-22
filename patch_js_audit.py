import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = "        window.guardarReventa = async function() {"

replacement = """        // ==========================================
        // 🛡️ MÓDULO DE AUDITORÍA INTERNA
        // ==========================================
        window.registrarAuditoria = async function(accion, detalles) {
            try {
                const elNombre = document.getElementById('admin-nombre-txt');
                const usuario = (elNombre && elNombre.textContent && elNombre.textContent !== 'Cargando...') ? elNombre.textContent.trim() : "Administrador";
                
                await addDoc(collection(db, 'auditoria_logs'), {
                    fecha: new Date().toLocaleString("es-VE"),
                    usuario: usuario,
                    accion: accion,
                    detalles: detalles,
                    timestamp: new Date().getTime()
                });
            } catch (error) {
                console.error("Error registrando auditoría:", error);
            }
        };

        window.cargarHistorialAuditoria = async function() {
            const tbody = document.getElementById('auditoria-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando historial de auditoría...</td></tr>';
            
            try {
                const snap = await getDocs(collection(db, "auditoria_logs"));
                if (snap.empty) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay registros de auditoría.</td></tr>';
                    return;
                }
                
                let logs = [];
                snap.forEach(docSnap => logs.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Ordenar más recientes primero
                logs.sort((a, b) => b.timestamp - a.timestamp);
                
                let html = '';
                logs.forEach(log => {
                    let colorAccion = "color: #333;";
                    if (log.accion.includes("CREAR")) colorAccion = "color: #28a745;";
                    if (log.accion.includes("EDITAR") || log.accion.includes("ACTUALIZAR")) colorAccion = "color: #1d6fa5;";
                    if (log.accion.includes("ELIMINAR") || log.accion.includes("BORRAR")) colorAccion = "color: #d9534f;";
                    
                    html += `
                        <tr>
                            <td style="font-size: 12px; color: #555;">${log.fecha}</td>
                            <td><strong><i class="fas fa-user-circle" style="color:#ccc;"></i> ${log.usuario}</strong></td>
                            <td><span style="font-weight: bold; ${colorAccion}">${log.accion}</span></td>
                            <td style="font-size: 13px;">${log.detalles}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
                
            } catch (error) {
                console.error("Error al cargar auditoría:", error);
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error cargando registros.</td></tr>';
            }
        };

        window.guardarReventa = async function() {"""

if target in content:
    content = content.replace(target, replacement)
    print("Injected JS functions.")

# Now patch guardarReventa
target_guardar1 = """                    await updateDoc(docRef, dataToSave);
                    alert("Operación de reventa actualizada con éxito.");"""

replacement_guardar1 = """                    await updateDoc(docRef, dataToSave);
                    window.registrarAuditoria("EDITAR REVENTA", "Se actualizó la reventa: " + desc);
                    alert("Operación de reventa actualizada con éxito.");"""

if target_guardar1 in content:
    content = content.replace(target_guardar1, replacement_guardar1)
    print("Patched guardarReventa (edit).")

target_guardar2 = """                    await addDoc(collection(db, "reventas_gastos"), dataToSave);
                    alert("Operación de reventa registrada con éxito.");"""

replacement_guardar2 = """                    await addDoc(collection(db, "reventas_gastos"), dataToSave);
                    window.registrarAuditoria("CREAR REVENTA", "Se registró la reventa: " + desc);
                    alert("Operación de reventa registrada con éxito.");"""

if target_guardar2 in content:
    content = content.replace(target_guardar2, replacement_guardar2)
    print("Patched guardarReventa (add).")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


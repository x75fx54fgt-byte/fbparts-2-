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

# 1. Update the table row HTML
target_html = """                                <td style="text-align: center; display: flex; gap: 5px; justify-content: center; align-items: center; height:100%;">
                                    <button type="button" onclick="editarRutaMaestra('${ruta.rutaId}')" style="background:#f0ad4e; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Editar Ruta"><i class="fas fa-edit"></i> Editar</button>
                                    <button type="button" onclick="eliminarRutaMaestra('${ruta.rutaId}')" style="background:#d9534f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Borrar Toda la Ruta"><i class="fas fa-times"></i> Borrar</button>
                                </td>"""

replacement_html = """                                <td style="text-align: center; display: flex; gap: 5px; justify-content: center; align-items: center; height:100%;">
                                    ${!todasCompletadas ? `<button type="button" onclick="marcarRutaTerminada('${ruta.rutaId}')" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Marcar Terminada"><i class="fas fa-check-circle"></i></button>` : ''}
                                    <button type="button" onclick="editarRutaMaestra('${ruta.rutaId}')" style="background:#f0ad4e; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Editar Ruta"><i class="fas fa-edit"></i> Editar</button>
                                    <button type="button" onclick="eliminarRutaMaestra('${ruta.rutaId}')" style="background:#d9534f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Borrar Toda la Ruta"><i class="fas fa-times"></i> Borrar</button>
                                </td>"""
replace_safe(target_html, replacement_html, "HTML Row (Botón Rápido)")

# 2. Add function marcarRutaTerminada after eliminarRutaMaestra
target_func = """        window.eliminarRutaMaestra = async function(rutaId) {"""

replacement_func = """        window.marcarRutaTerminada = async function(rutaId) {
            if(!confirm("¿Marcar toda la ruta y sus paradas como Terminadas?")) return;
            try {
                const qPuntos = query(collection(db, "rutas_puntos"), where("rutaId", "==", rutaId));
                const snapPuntos = await getDocs(qPuntos);
                
                let promesasUpdate = [];
                snapPuntos.forEach((d) => {
                    promesasUpdate.push(updateDoc(d.ref, { estado: "Completada" }));
                });
                
                await Promise.all(promesasUpdate);

                if (window.registrarAuditoria) {
                    window.registrarAuditoria("CAMBIO ESTATUS RUTA", "Se marcó la ruta como Terminada (Acción Rápida).");
                }
                
                window.cargarPuntosRuta(); // Repintar instantáneamente
            } catch (error) {
                console.error("Error al marcar ruta terminada:", error);
                alert("Ocurrió un error al procesar la ruta.");
            }
        };

        window.eliminarRutaMaestra = async function(rutaId) {"""
replace_safe(target_func, replacement_func, "Función marcarRutaTerminada")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


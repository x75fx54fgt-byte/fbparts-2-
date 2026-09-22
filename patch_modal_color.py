import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the modal header color to match the main header (#5B8266)
target_header = """<div style="background: #385723; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">"""
replacement_header = """<div style="background: #5B8266; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">"""
content = content.replace(target_header, replacement_header)

# Fix the table headers text color / background issue
target_th1 = """<th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Fecha / Hora</th>"""
replacement_th1 = """<th>Fecha / Hora</th>"""
content = content.replace(target_th1, replacement_th1)

target_th2 = """<th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Usuario</th>"""
replacement_th2 = """<th>Usuario</th>"""
content = content.replace(target_th2, replacement_th2)

target_th3 = """<th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Acción</th>"""
replacement_th3 = """<th>Acción</th>"""
content = content.replace(target_th3, replacement_th3)

target_th4 = """<th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Detalles del Cambio</th>"""
replacement_th4 = """<th>Detalles del Cambio</th>"""
content = content.replace(target_th4, replacement_th4)

# Fix the robustness of JS just in case
target_js = """                logs.forEach(log => {
                    let colorAccion = "color: #333;";
                    if (log.accion.includes("CREAR")) colorAccion = "color: #28a745;";
                    if (log.accion.includes("EDITAR") || log.accion.includes("ACTUALIZAR")) colorAccion = "color: #1d6fa5;";
                    if (log.accion.includes("ELIMINAR") || log.accion.includes("BORRAR")) colorAccion = "color: #d9534f;";"""

replacement_js = """                logs.forEach(log => {
                    let colorAccion = "color: #333;";
                    let accionTexto = log.accion || "";
                    if (accionTexto.includes("CREAR")) colorAccion = "color: #28a745;";
                    if (accionTexto.includes("EDITAR") || accionTexto.includes("ACTUALIZAR")) colorAccion = "color: #1d6fa5;";
                    if (accionTexto.includes("ELIMINAR") || accionTexto.includes("BORRAR")) colorAccion = "color: #d9534f;";"""
content = content.replace(target_js, replacement_js)

# Print out the error so the user can actually see it instead of just a generic red text
target_err = """                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error cargando registros.</td></tr>';"""
replacement_err = """                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error cargando registros: ${error.message}</td></tr>`;"""
content = content.replace(target_err, replacement_err)


with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

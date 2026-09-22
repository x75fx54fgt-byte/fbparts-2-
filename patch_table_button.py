import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """<button type="button" onclick="eliminarReventa('${rev.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>"""

replacement = """<button type="button" onclick="editarReventa('${rev.id}')" style="background:#0275d8; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right: 5px;" title="Editar"><i class="fas fa-edit"></i></button>
                                <button type="button" onclick="eliminarReventa('${rev.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>"""

if target in content:
    content = content.replace(target, replacement)
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Target not found!")

import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                            <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 90px; border-bottom: none; height: 100%;">
                                <button type="button" onclick="editarReventa('${rev.id}')" style="background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Editar"><i class="fas fa-edit"></i></button>
                                <button type="button" onclick="eliminarReventa('${rev.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>
                            </td>"""

replacement = """                            <td style="text-align: center; vertical-align: middle;">
                                <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                                    <button type="button" onclick="editarReventa('${rev.id}')" style="background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Editar"><i class="fas fa-edit"></i></button>
                                    <button type="button" onclick="eliminarReventa('${rev.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>"""

if target in content:
    content = content.replace(target, replacement)
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found! Let's check what is there.")

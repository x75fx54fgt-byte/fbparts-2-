with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align: center; color: red;\">Error al cargar el historial.</td></tr>';",
    "tbody.innerHTML = `<tr><td colspan=\"7\" style=\"text-align: center; color: red;\">Error al cargar el historial: ${error.message}</td></tr>`;"
)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

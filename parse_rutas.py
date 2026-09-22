with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<!-- PESTAÑA: CONTROL DE RUTAS GPS -->')
end = content.find('<!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->')
block = content[start:end]

opens = block.count('<div')
closes = block.count('</div')

print(f"rutas opens: {opens}, closes: {closes}")

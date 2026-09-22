with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->')
end = content.find('    <!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->')
block = content[start:end]

opens = block.count('<div')
closes = block.count('</div')

print(f"opens: {opens}, closes: {closes}")

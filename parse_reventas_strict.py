with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->')
end = content.find('    </div> <!-- Cierre App Wrapper -->') - 17 # exclude the two closing divs
block = content[start:end]

opens = block.count('<div')
closes = block.count('</div')

print(f"Strict reventas opens: {opens}, closes: {closes}")

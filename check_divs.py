with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->')
end = content.find('<!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->')

tab_content = content[start:end]

open_divs = tab_content.count('<div')
close_divs = tab_content.count('</div')

print(f"Open divs: {open_divs}")
print(f"Close divs: {close_divs}")

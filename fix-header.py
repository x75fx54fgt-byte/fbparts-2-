import os

files = ['index.html', 'tienda.html', 'producto.html']

for f in files:
    if os.path.exists(f):
        with open(f, 'r') as file:
            content = file.read()
        
        content = content.replace("header .header-wrap, header nav { flex-wrap: wrap !important; }", "header .header-wrap { flex-direction: row !important; justify-content: space-between !important; align-items: center !important; flex-wrap: nowrap !important; } .header-right { display: none !important; } .mobile-menu { margin: 0 !important; margin-left: auto !important; }")
        
        with open(f, 'w') as file:
            file.write(content)
        print(f"Updated {f}")


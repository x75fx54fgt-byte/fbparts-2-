import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Update script type="module" to have defer (for Firebase scripts)
if '<script type="module">' in html:
    html = html.replace('<script type="module">', '<script type="module" defer>')

# Add width and height to category images
images_to_update = {
    'img/freno.jpg': ('440', '430'),
    'img/bomba-gasolina.jpg': ('440', '430'),
    'img/filtro-aire.jpg': ('440', '430'),
    'img/faros.jpg': ('440', '430'),
    'img/bomba-agua.jpg': ('440', '430'),
    'img/bomba-aceite.jpg': ('440', '430'),
    'img/multiple-admision.jpg': ('440', '430'),
    'img/carroceria.jpg': ('440', '430'),
    'img/otras-categorias.jpg': ('1024', '672'),
}

for img_src, (w, h) in images_to_update.items():
    # Looking for: src="img/freno.jpg" alt="..." loading="lazy"
    # We want to add width="w" height="h"
    # A simple regex to find the img tag with this src and insert the dimensions
    pattern = rf'(<img\s+src="{img_src}"[^>]*?)(>)'
    
    def repl(m):
        tag = m.group(1)
        if 'width=' not in tag:
            tag += f' width="{w}" height="{h}"'
        return tag + m.group(2)
        
    html = re.sub(pattern, repl, html)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Updated index.html")

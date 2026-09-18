with open('index.html', 'r') as file:
    content = file.read()

# Add ID to nav
content = content.replace("<nav>", "<nav id=\"nav-principal\">")

# Add onclick to links
content = content.replace("<a href=\"#inicio\">Inicio</a>", "<a href=\"#inicio\" onclick=\"toggleMenuMobile()\">Inicio</a>")
content = content.replace("<a href=\"tienda.html\">Repuestos</a>", "<a href=\"tienda.html\" onclick=\"toggleMenuMobile()\">Repuestos</a>")
content = content.replace("<a href=\"#nosotros\">Quienes somos</a>", "<a href=\"#nosotros\" onclick=\"toggleMenuMobile()\">Quienes somos</a>")
content = content.replace("<a href=\"#mercadolibre\">Mercado Libre</a>", "<a href=\"#mercadolibre\" onclick=\"toggleMenuMobile()\">Mercado Libre</a>")
content = content.replace("<a href=\"#contacto\">Contacto</a>", "<a href=\"#contacto\" onclick=\"toggleMenuMobile()\">Contacto</a>")

# Add onclick to button
content = content.replace('<button class="mobile-menu" aria-label="Menú">', '<button class="mobile-menu" aria-label="Menú" onclick="toggleMenuMobile()">')

# Add JS function
js_func = """
    <script>
        function toggleMenuMobile() {
            const nav = document.getElementById('nav-principal');
            if(nav) nav.classList.toggle('menu-activo');
        }
    </script>
"""
if "function toggleMenuMobile()" not in content:
    content = content.replace("</body>", f"{js_func}\n</body>")

with open('index.html', 'w') as file:
    file.write(content)


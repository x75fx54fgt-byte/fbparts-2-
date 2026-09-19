import re

files = ['mi-cuenta.html', 'login.html', 'register.html', 'mis-pedidos.html']

js_html = """
<script>
    function toggleMenuMobile() {
        const nav = document.getElementById('nav-principal');
        if(nav) nav.classList.toggle('menu-activo');
    }
</script>
"""

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if the function definition is actually there
    if 'function toggleMenuMobile()' not in content:
        content = content.replace('</body>', js_html + '</body>')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed JS in {file}")

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Fix the margin issue for the mobile menu
css = css.replace('margin: 8px auto !important;', 'margin: 0 !important; margin-left: auto !important;')

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("Fixed CSS for mobile menu.")

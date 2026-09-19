import re

files = ['mi-cuenta.html', 'login.html', 'register.html', 'mis-pedidos.html']

header_html = """    <header style="background: white; border-bottom: 1px solid #eee; position: relative;">
        <div class="container header-wrap" style="padding: 15px 20px; max-width: 1350px; display: flex; justify-content: space-between; align-items: center;">
            <a class="logo" href="index.html" style="display: flex; align-items: center;">
                <img src="https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png" alt="Logotipo F&B PARTS" decoding="async" style="height: 60px;">
            </a>
            
            <nav id="nav-principal">
                <a href="index.html" onclick="toggleMenuMobile()">Inicio</a>
                <a href="tienda.html" onclick="toggleMenuMobile()">Repuestos</a>
                <a href="quienes-somos.html" onclick="toggleMenuMobile()">Quienes somos</a>
                <a href="index.html#mercadolibre" onclick="toggleMenuMobile()">Mercado Libre</a>
                <a href="index.html#contacto" onclick="toggleMenuMobile()">Contacto</a>
                <a href="login.html" id="nav-cuenta-btn" style="color: var(--green); font-weight: bold; border-bottom: 2px solid var(--green); padding-bottom: 5px;"><i class="fas fa-user"></i> Mi Cuenta</a>
            </nav>

            <button class="mobile-menu" aria-label="Menú" onclick="toggleMenuMobile()" style="margin: 0; margin-left: auto;">
                <i class="fas fa-bars"></i>
            </button>
        </div>
    </header>"""

js_html = """
    <script>
        function toggleMenuMobile() {
            const nav = document.getElementById('nav-principal');
            if(nav) nav.classList.toggle('menu-activo');
        }
    </script>
"""

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace the <header>...</header> block
        content = re.sub(r'<header.*?>.*?</header>', header_html, content, flags=re.DOTALL)
        
        # Inject script if missing
        if 'toggleMenuMobile' not in content:
            content = content.replace('</body>', js_html + '\n</body>')
            
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
    except Exception as e:
        print(f"Failed {file}: {e}")

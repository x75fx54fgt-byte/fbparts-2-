import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Extract external scripts from head/body
puter = '<script defer src="https://js.puter.com/v2/"></script>'
vercel1 = '<script defer src="/_vercel/insights/script.js"></script>'
vercel2 = '<script defer src="/_vercel/speed-insights/script.js"></script>'

# Clean them out of the current document
html = html.replace(puter, '')
html = html.replace(vercel1, '')
html = html.replace(vercel2, '')
# Also remove the Vercel comment
html = html.replace('<!-- Vercel Analytics & Speed Insights -->', '')

# Remove extra empty lines left behind
html = re.sub(r'\n\s*\n</head>', '\n</head>', html)

# 2. Extract Firebase script block to move it to the absolute bottom
firebase_pattern = r'<!-- Script de Firebase, Destacados y Carrusel -->\s*<script type="module" defer>[\s\S]*?window\.addEventListener\(\'DOMContentLoaded\', cargarDestacados\);\s*</script>'
firebase_match = re.search(firebase_pattern, html)

if firebase_match:
    firebase_block = firebase_match.group(0)
    html = html.replace(firebase_block, '')
else:
    firebase_block = ""
    print("Firebase block not found with regex, maybe slightly different formatting.")

# 3. Assemble the bottom block
bottom_scripts = f"""
    <!-- ========================================== -->
    <!-- SCRIPTS DIFERIDOS (Rendimiento y Lógica) -->
    {firebase_block}
    
    <!-- Librerías de Terceros (Diferidas) -->
    <script defer src="https://js.puter.com/v2/"></script>
    <script defer src="/_vercel/insights/script.js"></script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
</body>"""

html = html.replace('</body>', bottom_scripts)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Scripts safely moved to the bottom.")

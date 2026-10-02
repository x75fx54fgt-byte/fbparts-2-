import re

# 1. REMOVE @IMPORT FROM STYLES.CSS
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

font_url = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap'

if '@import' in css and font_url in css:
    css = re.sub(r"@import url\('https://fonts\.googleapis\.com/css2[^']+'\);\n?", '', css)
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)

# 2. INJECT ASYNC FONTS INTO INDEX.HTML
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace preconnect block (it's already correct, but just to satisfy "reemplaza exactamente")
old_preconnects = """    <!-- PRECONNECTS PARA MEJORAR LCP -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fb-parts-app.firebaseapp.com" crossorigin>
    <link rel="preconnect" href="https://apis.google.com" crossorigin>"""

new_preconnects = """    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fb-parts-app.firebaseapp.com" crossorigin>
    <link rel="preconnect" href="https://apis.google.com" crossorigin>"""

html = html.replace(old_preconnects, new_preconnects)

# Insert async Google fonts right before styles.css if not already there
async_fonts = f"""    <link rel="preload" as="style" href="{font_url}" />
    <link rel="stylesheet" href="{font_url}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="{font_url}" /></noscript>
    <link rel="stylesheet" href="styles.css">"""

if "preload" not in html or font_url not in html:
    html = html.replace('    <link rel="stylesheet" href="styles.css">', async_fonts)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done")

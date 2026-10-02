import os

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

old_preconnects = """    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://firestore.googleapis.com">"""

new_preconnects = """    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fb-parts-app.firebaseapp.com" crossorigin>
    <link rel="preconnect" href="https://apis.google.com" crossorigin>"""

if old_preconnects in html:
    html = html.replace(old_preconnects, new_preconnects)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Preconnects successfully updated.")
else:
    print("Old preconnects block not found.")

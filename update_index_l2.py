import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Task 1: Insert preconnect tags right below the viewport meta tag
preconnects = """
    <!-- PRECONNECTS PARA MEJORAR LCP -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://firestore.googleapis.com">
"""
meta_viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
if meta_viewport in html and "https://fonts.googleapis.com" not in html:
    html = html.replace(meta_viewport, meta_viewport + "\n" + preconnects)

# Task 2: Async FontAwesome
old_fa = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">'
new_fa = """<link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"></noscript>"""
if old_fa in html:
    html = html.replace(old_fa, new_fa)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Updated index.html level 2")

import os

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Update <section id="inicio" class="hero">
old_section = '<section id="inicio" class="hero">'
new_section = '<section id="inicio" class="hero" style="min-height: 80vh; position: relative; overflow: hidden;">'
if old_section in html:
    html = html.replace(old_section, new_section, 1)

# 2. Update the active hero slide
old_slide = """                <div class="hero-slide active" style="background-image: linear-gradient(rgba(0,0,0,.32), rgba(0,0,0,.32)), url('img/fotoportada.png');" role="img" aria-label="Almacén de repuestos automotrices originales en Caracas">
                    <div class="hero-overlay">"""

new_slide = """                <div class="hero-slide active" role="img" aria-label="Almacén de repuestos automotrices originales en Caracas">
                    <img src="img/fotoportada.png" fetchpriority="high" loading="eager" alt="Repuestos originales en Caracas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.32); z-index: 1;"></div>
                    <div class="hero-overlay" style="position: relative; z-index: 2;">"""

if old_slide in html:
    html = html.replace(old_slide, new_slide, 1)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Hero CLS and LCP modifications applied.")

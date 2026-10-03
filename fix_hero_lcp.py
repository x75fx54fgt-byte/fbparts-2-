import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

old_block_pattern = r'<div class="hero-slide active"[^>]*>[\s\S]*?<div class="hero-overlay"[^>]*>'

new_block = """<div class="hero-slide active" role="img" aria-label="Almacén de repuestos automotrices originales en Caracas">
                    <img src="img/fotoportada.webp" fetchpriority="high" loading="eager" alt="Repuestos originales en Caracas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.32); z-index: 1;"></div>
                    <div class="hero-overlay" style="position: relative; z-index: 2;">"""

html = re.sub(old_block_pattern, new_block, html)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Verified and enforced LCP optimization.")

import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                        <div style="background: #eef4f8; border: 1px solid #b8daff; border-radius: 6px; padding: 15px; margin-top: 15px;">
                            <h4 style="margin-top: 0; color: #1d6fa5; font-family: 'Oswald', sans-serif;"><i class="fas fa-chart-line"></i> Resumen de Ganancias</h4>"""

replacement = """                        <div style="background: #f4f8f5; border: 1px solid #e2f0d9; border-radius: 6px; padding: 15px; margin-top: 15px;">
                            <h4 style="margin-top: 0; color: #385723; font-family: 'Oswald', sans-serif;"><i class="fas fa-chart-line"></i> Resumen de Ganancias</h4>"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced Resumen Box!")
else:
    print("Target not found!")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                            <div style="display: flex; justify-content: space-between; font-size: 16px;">
                                <strong style="color: #28a745;">Neta Empresa:</strong>
                                <strong id="rev-res-neta" style="color: #28a745;">$0.00 | Bs.0.00 | €0.00</strong>
                            </div>"""

replacement1 = """                            <div style="display: flex; justify-content: space-between; font-size: 16px;">
                                <strong style="color: #385723;">Neta Empresa:</strong>
                                <strong id="rev-res-neta" style="color: #385723;">$0.00 | Bs.0.00 | €0.00</strong>
                            </div>"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced Form text colors!")

target2 = """                        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #cce5ff; margin-bottom: 20px;">"""
replacement2 = """                        <div style="background: #f9fdfa; padding: 15px; border-radius: 6px; border: 1px solid #e2f0d9; margin-bottom: 20px;">"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced Form background/border!")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

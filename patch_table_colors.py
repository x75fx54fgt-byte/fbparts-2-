import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                            <td><span style="color: #28a745; font-weight: bold;">$${(rev.gananciaNetaUSD || 0).toFixed(2)}</span><br><span style="font-size:10px; color:#666;">Bs.${netaVES}</span></td>"""
replacement1 = """                            <td><span style="color: #385723; font-weight: bold;">$${(rev.gananciaNetaUSD || 0).toFixed(2)}</span><br><span style="font-size:10px; color:#666;">Bs.${netaVES}</span></td>"""

target2 = """                    <tr style="background: #eef4f8; font-weight: bold; border-top: 2px solid #b8daff;">
                        <td colspan="5" style="text-align: right;">TOTAL GANANCIA NETA GLOBAL:</td>
                        <td colspan="2" style="color: #28a745; font-size: 16px;">$${totalNeta.toFixed(2)}</td>
                    </tr>"""
replacement2 = """                    <tr style="background: #f4f8f5; font-weight: bold; border-top: 2px solid #385723;">
                        <td colspan="5" style="text-align: right; color: #385723;">TOTAL GANANCIA NETA GLOBAL:</td>
                        <td colspan="2" style="color: #385723; font-size: 16px;">$${totalNeta.toFixed(2)}</td>
                    </tr>"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced 1!")
if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced 2!")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

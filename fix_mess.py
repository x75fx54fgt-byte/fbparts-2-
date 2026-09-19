with open('producto.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if i == 559: # Line 560 (0-indexed 559)
        new_lines.append("""                const safeName = prod.nombre.replace(/'/g, "\\\\\\'").replace(/"/g, '&quot;');
                const stockTxt = prod.stock > 0 ? `<span style="color: #27ae60; font-weight: bold;">En Stock (${prod.stock} disponibles)</span>` : `<span style="color: #c0392b; font-weight: bold;">Agotado</span>`;
                const numParteTxt = prod.numero_parte ? `<p style="margin: 5px 0;"><strong>Número de Parte / OEM:</strong> ${prod.numero_parte}</p>` : '';
                const descTxt = prod.descripcion ? `<div style="margin: 15px 0; color: #444; font-size: 14px; line-height: 1.6; white-space: pre-wrap; font-family: inherit;">${prod.descripcion}</div>` : '<p style="margin: 10px 0; color: #888; font-size: 13px;">Sin descripción detallada para este repuesto. Contáctanos para mayor información de compatibilidad.</p>';
                const catSubtitle = prod.categoria ? `F&B PARTS • ${prod.categoria.toUpperCase()}` : `F&B PARTS • AUTOPARTES ORIGINALES`;

                container.innerHTML = `
                    <div class="product-img-box">
                        <img src="${prod.imagen}" alt="Repuesto original ${prod.nombre} en Caracas - F&B Parts" loading="lazy" decoding="async" onerror="this.src='https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png'">
                    </div>
                    <div class="product-details">
                        <span style="font-size: 12px; color: #888; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${catSubtitle}</span>
""")
        skip = True
    elif i == 581: # Line 582
        skip = False
    
    if not skip:
        new_lines.append(line)

with open('producto.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Fixed!")

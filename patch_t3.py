import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                        const badgeEstado = prod.estado === 'activo' ? `<span class="badge-status-activo">Activo</span>` : `<span class="badge-status-inactivo">Inactivo</span>`;
                        
                        // 🚀 LIMPIEZA DE TEXTOS (Evita que saltos de línea y comillas de la IA rompan el botón)
                        const safeNombre = (prod.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeImg = (prod.imagen || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeNumParte = (prod.numero_parte || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeDesc = (prod.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\\n/g, '\\\\n').replace(/\\r/g, '');

                        tablaProd.innerHTML += `
                            <tr class="admin-prod-row" data-category="${prod.categoria}">
                                <td><img src="${prod.imagen}" width="60" style="border-radius:4px; border:1px solid #eee; background:#f0f0f0; object-fit:cover;" onerror="this.src='img/logo.png'"></td>
                                <td class="prod-nombre-col"><strong>${prod.nombre}</strong><br>${badgeEstado}</td>
                                <td><span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;">${prod.categoria}</span></td>"""

# Let's just find `const badgeEstado` inside `prodSnap.forEach` and replace until `</td>` of category

match = re.search(r"const badgeEstado = prod\.estado === 'activo'.*?<td><span style=\"background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;\">\$\{prod\.categoria\}</span></td>", content, re.DOTALL)

if match:
    rep = """const badgeEstado = prod.estado === 'activo' ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Activo</span>` : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Inactivo</span>`;
                        
                        let bMarca = '';
                        if(prod.marca && prod.marca !== "Universal/Multi-marca" && prod.marca !== "") {
                            bMarca = `<span class="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-car-side"></i> ${prod.marca}</span>`;
                        }
                        
                        let bPos = '';
                        if(prod.posicion && prod.posicion !== "N/A" && prod.posicion !== "") {
                            bPos = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-arrows-alt-h"></i> ${prod.posicion}</span>`;
                        }
                        
                        let bMod = '';
                        if(prod.modalidad && prod.modalidad.toLowerCase().includes("importación")) {
                            bMod = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-plane-arrival"></i> ${prod.modalidad}</span>`;
                        } else if(prod.modalidad) {
                            bMod = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-box"></i> ${prod.modalidad}</span>`;
                        }

                        // 🚀 LIMPIEZA DE TEXTOS
                        const safeNombre = (prod.nombre || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
                        const safeImg = (prod.imagen || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
                        const safeNumParte = (prod.numero_parte || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
                        const safeDesc = (prod.descripcion || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;').replace(/\\n/g, '\\\\n').replace(/\\r/g, '');

                        tablaProd.innerHTML += `
                            <tr class="admin-prod-row" data-category="${prod.categoria}">
                                <td style="vertical-align: top; padding-top: 12px;"><img src="${prod.imagen}" width="60" style="border-radius:4px; border:1px solid #eee; background:#f0f0f0; object-fit:cover;" onerror="this.src='img/logo.png'"></td>
                                <td class="prod-nombre-col" style="vertical-align: top; padding-top: 12px;">
                                    <div style="margin-bottom:3px; line-height: 1.2;"><strong>${prod.nombre}</strong> <br>${badgeEstado}</div>
                                    <div class="flex flex-wrap gap-1 mt-2 mb-1">
                                        ${bMarca}
                                        ${bPos}
                                    </div>
                                    ${bMod}
                                    ${prod.modelo ? `<div class="text-[11px] text-gray-500 mt-2"><i class="fas fa-cogs"></i> Mod/Motor: ${prod.modelo}</div>` : ''}
                                </td>
                                <td style="vertical-align: top; padding-top: 12px;"><span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${prod.categoria}</span>${prod.subcategoria ? `<br><span style="font-size:10px; color:#777; display:block; margin-top:4px;">↳ ${prod.subcategoria}</span>` : ''}</td>"""
    
    content = content.replace(match.group(0), rep)
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched table HTML")
else:
    print("Regex match failed")


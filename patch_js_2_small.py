import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """            if(selectCat) selectCat.innerHTML = '<option value="">Seleccionar...</option>';
            if(selectEditCat) selectEditCat.innerHTML = '';
            if(selectFiltroAdmin) selectFiltroAdmin.innerHTML = '<option value="todos">Todas las Categorías</option>';"""

rep1 = """            const datalistCats = document.getElementById('lista-categorias');
            if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML = '<option value="">Seleccionar...</option>';
            if(datalistCats) datalistCats.innerHTML = '';
            if(selectEditCat) selectEditCat.innerHTML = '';
            if(selectFiltroAdmin) selectFiltroAdmin.innerHTML = '<option value="todos">Todas las Categorías</option>';"""

target2 = """                    window.mapaCategorias[cat.id] = cat.nombre;
                    const opt = `<option value="${cat.id}">${cat.nombre}</option>`;
                    if(selectCat) selectCat.innerHTML += opt;
                    if(selectEditCat) selectEditCat.innerHTML += opt;"""

rep2 = """                    window.mapaCategorias[cat.id] = cat.nombre;
                    const opt = `<option value="${cat.id}">${cat.nombre}</option>`;
                    if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML += opt;
                    if(datalistCats) datalistCats.innerHTML += `<option value="${cat.nombre}"></option>`;
                    if(selectEditCat) selectEditCat.innerHTML += opt;"""

target3 = """                        const badgeEstado = prod.estado === 'activo' ? `<span class="badge-status-activo">Activo</span>` : `<span class="badge-status-inactivo">Inactivo</span>`;
                        
                        // 🚀 LIMPIEZA DE TEXTOS (Evita que saltos de línea y comillas de la IA rompan el botón)
                        const safeNombre = (prod.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeImg = (prod.imagen || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeNumParte = (prod.numero_parte || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeDesc = (prod.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');

                        tablaProd.innerHTML += `
                            <tr class="admin-prod-row" data-category="${prod.categoria}">
                                <td><img src="${prod.imagen}" width="60" style="border-radius:4px; border:1px solid #eee; background:#f0f0f0; object-fit:cover;" onerror="this.src='img/logo.png'"></td>
                                <td class="prod-nombre-col"><strong>${prod.nombre}</strong><br>${badgeEstado}</td>
                                <td><span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;">${prod.categoria}</span></td>"""

rep3 = """                        const badgeEstado = prod.estado === 'activo' ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Activo</span>` : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Inactivo</span>`;
                        
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
                            bMod = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1 block w-max"><i class="fas fa-plane-arrival"></i> ${prod.modalidad}</span>`;
                        } else if(prod.modalidad) {
                            bMod = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1 block w-max"><i class="fas fa-box"></i> ${prod.modalidad}</span>`;
                        }

                        // 🚀 LIMPIEZA DE TEXTOS
                        const safeNombre = (prod.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeImg = (prod.imagen || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeNumParte = (prod.numero_parte || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeDesc = (prod.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');

                        tablaProd.innerHTML += `
                            <tr class="admin-prod-row" data-category="${prod.categoria}">
                                <td><img src="${prod.imagen}" width="60" style="border-radius:4px; border:1px solid #eee; background:#f0f0f0; object-fit:cover;" onerror="this.src='img/logo.png'"></td>
                                <td class="prod-nombre-col">
                                    <div style="margin-bottom:3px;"><strong>${prod.nombre}</strong> ${badgeEstado}</div>
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        ${bMarca}
                                        ${bPos}
                                    </div>
                                    ${bMod}
                                    ${prod.modelo ? `<div class="text-[11px] text-gray-500 mt-1"><i class="fas fa-cogs"></i> Motor/Mod: ${prod.modelo}</div>` : ''}
                                </td>
                                <td><span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${prod.categoria}</span>${prod.subcategoria ? `<br><span style="font-size:10px; color:#777;">↳ ${prod.subcategoria}</span>` : ''}</td>"""

content = content.replace(target1, rep1)
content = content.replace(target2, rep2)
content = content.replace(target3, rep3)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


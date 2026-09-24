import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target_form = """                                <div class="form-group">
                                    <label>Nombre, Marca, Modelo y Año</label>
                                    <input type="text" id="prod-nombre" placeholder="Ej: Bomba de Agua Yaris 2008" required>
                                </div>
                                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div><label>Precio ($)</label><input type="number" step="0.01" id="prod-precio" placeholder="Ej: 45.00" required></div>
                                    <div><label>Stock</label><input type="number" id="prod-stock" value="1" min="0" required></div>
                                </div>
                                <div class="form-group">
                                    <label>Categoría</label>
                                    <select id="prod-categoria" required><option value="">Cargando...</option></select>
                                </div>"""

replacement_form = """                                <div class="form-group">
                                    <label>Nombre del Repuesto</label>
                                    <input type="text" id="prod-nombre" placeholder="Ej: Bomba de Agua Yaris 2008" required>
                                </div>
                                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div>
                                        <label>Marca del Vehículo</label>
                                        <select id="prod-marca" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="">Seleccione...</option>
                                            <option value="Toyota">Toyota</option>
                                            <option value="Dongfeng">Dongfeng</option>
                                            <option value="Ford">Ford</option>
                                            <option value="Mitsubishi">Mitsubishi</option>
                                            <option value="Isuzu">Isuzu</option>
                                            <option value="Chevrolet">Chevrolet</option>
                                            <option value="Universal/Multi-marca">Universal/Multi-marca</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Modelo / Motorización</label>
                                        <input type="text" id="prod-modelo" placeholder="Ej: Hilux 2.7L, Duolika 5t" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                    </div>
                                </div>
                                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div>
                                        <label>Categoría</label>
                                        <input type="text" id="prod-categoria" list="lista-categorias" placeholder="Seleccione o escriba..." required autocomplete="off" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                        <datalist id="lista-categorias"></datalist>
                                    </div>
                                    <div>
                                        <label>Subcategoría</label>
                                        <select id="prod-subcategoria" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="">Seleccione...</option>
                                            <option value="Correas">Correas</option>
                                            <option value="Frenos">Frenos</option>
                                            <option value="Suspensión">Suspensión</option>
                                            <option value="Filtros">Filtros</option>
                                            <option value="Sensores">Sensores</option>
                                            <option value="Juntas/Empacaduras">Juntas/Empacaduras</option>
                                            <option value="Motor">Motor</option>
                                            <option value="Eléctrico">Eléctrico</option>
                                            <option value="Carrocería">Carrocería</option>
                                            <option value="Otros">Otros</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div>
                                        <label>Lado / Posición</label>
                                        <select id="prod-posicion" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="N/A">N/A (Universal / Central)</option>
                                            <option value="RH">RH (Derecho)</option>
                                            <option value="LH">LH (Izquierdo)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Disponibilidad / Importación</label>
                                        <select id="prod-modalidad" required onchange="const c = document.getElementById('prod-modalidad-custom'); if(this.value==='custom') { c.style.display='block'; c.required=true; } else { c.style.display='none'; c.required=false; }" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="Entrega Inmediata">Entrega Inmediata (Stock Local)</option>
                                            <option value="Bajo Importación - China (45-90 días)">Bajo Importación - China (45-90 días)</option>
                                            <option value="Bajo Importación - Brasil (30 días)">Bajo Importación - Brasil (30 días)</option>
                                            <option value="Bajo Importación - USA (20 días)">Bajo Importación - USA (20 días)</option>
                                            <option value="custom">Otra modalidad (Especificar)...</option>
                                        </select>
                                        <input type="text" id="prod-modalidad-custom" placeholder="Especificar modalidad..." style="display:none; margin-top:5px; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                    </div>
                                </div>
                                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div><label>Precio ($)</label><input type="number" step="0.01" id="prod-precio" placeholder="Ej: 45.00" required></div>
                                    <div><label>Stock</label><input type="number" id="prod-stock" value="1" min="0" required></div>
                                </div>"""

if target_form in content:
    content = content.replace(target_form, replacement_form)
    print("Patched form HTML")
else:
    print("Could not find HTML form target")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

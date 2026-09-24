import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target_js_1 = """        window.guardarNuevoRepuesto = async function(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            const nuevoProducto = {
                nombre: SecuritySanitizer.cleanText(document.getElementById('prod-nombre').value, 150),
                precio: SecuritySanitizer.sanitizeAmount(document.getElementById('prod-precio').value),
                stock: SecuritySanitizer.sanitizeInt(document.getElementById('prod-stock').value, 0),
                categoria: SecuritySanitizer.cleanText(document.getElementById('prod-categoria').value, 50),
                imagen: SecuritySanitizer.cleanText(document.getElementById('prod-imagen').value, 500),
                numero_parte: SecuritySanitizer.cleanText(document.getElementById('prod-numero-parte').value, 50),
                descripcion: SecuritySanitizer.cleanNote(document.getElementById('prod-descripcion').value, 1000),
                estado: "activo",
                ml_id: ""
            };

            try {
                await addDoc(collection(db, "productos"), nuevoProducto);
                alert("¡Repuesto guardado con éxito!");
                e.target.reset();
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error al guardar el repuesto."); }
            btn.innerHTML = "Guardar Repuesto"; btn.disabled = false;
        };"""

replacement_js_1 = """        window.guardarNuevoRepuesto = async function(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            const catInput = SecuritySanitizer.cleanText(document.getElementById('prod-categoria').value, 50);
            let catId = catInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
            if (catId === "") catId = "otros";

            try {
                if (!window.mapaCategorias[catId]) {
                    await addDoc(collection(db, "categorias"), { nombre: catInput, id: catId });
                    window.mapaCategorias[catId] = catInput;
                }
            } catch(err) { console.error("Error guardando categoría", err); }

            let modalidadVal = document.getElementById('prod-modalidad').value;
            if (modalidadVal === 'custom') {
                modalidadVal = SecuritySanitizer.cleanText(document.getElementById('prod-modalidad-custom').value, 100) || 'Importación Personalizada';
            }

            const nuevoProducto = {
                nombre: SecuritySanitizer.cleanText(document.getElementById('prod-nombre').value, 150),
                precio: SecuritySanitizer.sanitizeAmount(document.getElementById('prod-precio').value),
                stock: SecuritySanitizer.sanitizeInt(document.getElementById('prod-stock').value, 0),
                categoria: catId,
                imagen: SecuritySanitizer.cleanText(document.getElementById('prod-imagen').value, 500),
                numero_parte: SecuritySanitizer.cleanText(document.getElementById('prod-numero-parte').value, 50),
                descripcion: SecuritySanitizer.cleanNote(document.getElementById('prod-descripcion').value, 1000),
                marca: SecuritySanitizer.cleanText(document.getElementById('prod-marca').value, 50),
                modelo: SecuritySanitizer.cleanText(document.getElementById('prod-modelo').value, 100),
                subcategoria: SecuritySanitizer.cleanText(document.getElementById('prod-subcategoria').value, 50),
                posicion: SecuritySanitizer.cleanText(document.getElementById('prod-posicion').value, 20),
                modalidad: modalidadVal,
                estado: "activo",
                ml_id: ""
            };

            try {
                await addDoc(collection(db, "productos"), nuevoProducto);
                alert("¡Repuesto guardado con éxito!");
                e.target.reset();
                const cust = document.getElementById('prod-modalidad-custom');
                if(cust) { cust.style.display = 'none'; cust.required = false; }
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error al guardar el repuesto."); }
            btn.innerHTML = "Guardar Repuesto"; btn.disabled = false;
        };"""

if target_js_1 in content:
    content = content.replace(target_js_1, replacement_js_1)
    print("Patched guardarNuevoRepuesto HTML")
else:
    print("Could not find guardarNuevoRepuesto target")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

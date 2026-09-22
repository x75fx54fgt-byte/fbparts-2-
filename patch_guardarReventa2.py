import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'window\.guardarReventa = async function\(\) \{.*?\n        \};', re.DOTALL)

match = pattern.search(content)
if match:
    old_func = match.group(0)
    print("Found old function!")
    
    replacement = """        window.editarReventa = async function(id) {
            try {
                const docRef = doc(db, "reventas_gastos", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const rev = docSnap.data();
                    document.getElementById('rev-desc').value = rev.descripcion || "";
                    document.getElementById('rev-cliente').value = rev.cliente || "";
                    document.getElementById('rev-intermediario').value = rev.intermediario || "";
                    document.getElementById('rev-venta').value = rev.ventaUSD || "";
                    document.getElementById('rev-costo').value = rev.costoUSD || "";
                    document.getElementById('rev-gastos').value = rev.gastosUSD || "";
                    document.getElementById('rev-porcentaje').value = rev.porcentajeComision || 50;
                    
                    window.calcularReventa();
                    window.idReventaEditando = id;
                    
                    const btnGuardar = document.querySelector('#tab-reventas .btn-confirm-order');
                    if (btnGuardar) {
                        btnGuardar.style.background = "#0275d8";
                        btnGuardar.innerHTML = '<i class="fas fa-edit"></i> Actualizar Operación';
                    }
                    
                    document.querySelector('#tab-reventas').scrollIntoView({ behavior: 'smooth' });
                }
            } catch (error) {
                console.error("Error al cargar la reventa para editar:", error);
                alert("Hubo un error cargando los datos.");
            }
        };

        window.guardarReventa = async function() {
            const desc = document.getElementById('rev-desc').value.trim();
            const cliente = document.getElementById('rev-cliente').value.trim();
            const intermediario = document.getElementById('rev-intermediario').value.trim();
            if (!desc) { alert("Por favor ingresa una descripción para la operación."); return; }
            
            const calc = window.calcularReventa();
            
            const dataToSave = {
                descripcion: desc,
                cliente: cliente,
                intermediario: intermediario,
                ventaUSD: calc.venta,
                costoUSD: calc.costo,
                gastosUSD: calc.gastos,
                porcentajeComision: calc.porcentaje,
                gananciaBrutaUSD: calc.gananciaBruta,
                comisionTerceroUSD: calc.comisionTercero,
                gananciaNetaUSD: calc.gananciaNeta,
                tasaCambioVES: calc.tasaVES,
                tasaCambioEUR: calc.tasaEUR
            };
            
            try {
                if (window.idReventaEditando) {
                    const docRef = doc(db, "reventas_gastos", window.idReventaEditando);
                    await updateDoc(docRef, dataToSave);
                    alert("Operación de reventa actualizada con éxito.");
                    
                    window.idReventaEditando = null;
                    const btnGuardar = document.querySelector('#tab-reventas .btn-confirm-order');
                    if (btnGuardar) {
                        btnGuardar.style.background = "#385723";
                        btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Operación';
                    }
                } else {
                    dataToSave.fecha = new Date().toLocaleDateString("es-VE");
                    dataToSave.timestamp = new Date().getTime();
                    await addDoc(collection(db, "reventas_gastos"), dataToSave);
                    alert("Operación de reventa registrada con éxito.");
                }
                
                document.getElementById('rev-desc').value = "";
                document.getElementById('rev-cliente').value = "";
                document.getElementById('rev-intermediario').value = "";
                document.getElementById('rev-venta').value = "";
                document.getElementById('rev-costo').value = "";
                document.getElementById('rev-gastos').value = "";
                document.getElementById('rev-porcentaje').value = "50";
                
                window.calcularReventa();
                window.cargarHistorialReventas();
                
                if (window.calcularGananciaNetaDashboard) {
                    await window.calcularGananciaNetaDashboard(window.tasaVivaBCV || 42.00, window.tasaVivaEUR || 1.08);
                }

            } catch (e) {
                console.error(e);
                alert("Error al guardar la operación.");
            }
        };"""
    content = content.replace(old_func, replacement)
    
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced and saved!")
else:
    print("Could not find window.guardarReventa!")

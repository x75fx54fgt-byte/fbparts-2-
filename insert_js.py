import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """        // ==========================================
        // 🚀 MOTOR DE ARRANQUE INICIAL
        // =========================================="""

replacement1 = """        // ==========================================
        // 🔔 NOTIFICACIONES DE COBRANZA
        // ==========================================
        window.toggleNotificaciones = function() {
            const dropdown = document.getElementById('dropdown-notificaciones');
            if (dropdown) dropdown.classList.toggle('hidden');
        };

        // Cerrar dropdown si hace clic afuera
        document.addEventListener('click', function(event) {
            const container = document.getElementById('bell-container');
            const dropdown = document.getElementById('dropdown-notificaciones');
            if (container && dropdown && !container.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });

        window.actualizarNotificacionesCobranza = async function() {
            try {
                const snap = await getDocs(collection(db, "facturas"));
                let pendientes = [];
                const hoy = new Date();
                hoy.setHours(0,0,0,0);

                snap.forEach(docSnap => {
                    const fac = docSnap.data();
                    const estatus = fac.estatus || "";
                    
                    // Factura a crédito que NO está pagada
                    if (estatus.toLowerCase().includes("crédito") && !estatus.toLowerCase().includes("pagado")) {
                        
                        let diasTranscurridos = 0;
                        if (fac.fecha) {
                            const partes = fac.fecha.split('/');
                            if (partes.length === 3) {
                                // formato DD/MM/YYYY
                                const fechaFac = new Date(partes[2], partes[1] - 1, partes[0]);
                                const difTime = Math.abs(hoy - fechaFac);
                                diasTranscurridos = Math.floor(difTime / (1000 * 60 * 60 * 24));
                            }
                        }
                        
                        pendientes.push({
                            nro: fac.nro || "S/N",
                            cliente: fac.cliente || "Sin Nombre",
                            dias: diasTranscurridos,
                            id: docSnap.id
                        });
                    }
                });

                const badge = document.getElementById('badge-notificaciones');
                const lista = document.getElementById('lista-notificaciones');
                
                if (!badge || !lista) return;

                if (pendientes.length > 0) {
                    badge.textContent = pendientes.length;
                    badge.classList.remove('hidden');
                    
                    // Ordenar: Las más viejas primero (mayor cantidad de días)
                    pendientes.sort((a, b) => b.dias - a.dias);
                    
                    let html = '';
                    pendientes.forEach(p => {
                        let colorDias = p.dias > 15 ? 'text-red-500' : 'text-orange-500';
                        // Al hacer clic, enviarlo a la pestaña de finanzas (CxC)
                        html += `
                            <li class="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" onclick="mostrarPestana('finanzas', document.querySelector('.tab-btn:nth-child(2)')); window.toggleNotificaciones();">
                                <div class="flex justify-between items-start mb-1">
                                    <strong class="text-brandDark text-sm">Factura #${p.nro}</strong>
                                    <span class="text-xs font-bold ${colorDias}">${p.dias} días</span>
                                </div>
                                <div class="text-gray-500 text-xs truncate" title="${p.cliente}"><i class="fas fa-user mr-1"></i> ${p.cliente}</div>
                            </li>
                        `;
                    });
                    lista.innerHTML = html;
                } else {
                    badge.classList.add('hidden');
                    lista.innerHTML = `<li class="p-4 text-center text-gray-500 text-sm"><i class="fas fa-check-circle text-green-500 text-2xl mb-2 block"></i><br>No hay cobros pendientes</li>`;
                }
            } catch (error) {
                console.error("Error al actualizar notificaciones de cobranza:", error);
            }
        };

        // ==========================================
        // 🚀 MOTOR DE ARRANQUE INICIAL
        // =========================================="""

target2 = """            await runSafe('cargarHistorialReventas');
            
            await runSafe('cargarTasaBCV');"""

replacement2 = """            await runSafe('cargarHistorialReventas');
            
            await runSafe('cargarTasaBCV');
            await runSafe('actualizarNotificacionesCobranza');"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced JS Block 1!")
else:
    print("Failed to replace Block 1!")

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced JS Block 2!")
else:
    print("Failed to replace Block 2!")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

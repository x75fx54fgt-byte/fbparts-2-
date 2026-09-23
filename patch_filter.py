import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HTML modification
target_html = """                        <h3><i class="fas fa-list-alt"></i> Historial de Reventas</h3>
                        <div style="overflow-x: auto;">"""

replacement_html = """                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;"><i class="fas fa-list-alt"></i> Historial de Reventas</h3>
                            <div style="display: flex; gap: 8px;">
                                <select id="historial-rev-mes" class="p-1 border rounded" style="font-size: 13px;" onchange="window.cargarHistorialReventas()">
                                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                                    <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                                    <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                                </select>
                                <input type="number" id="historial-rev-anio" class="p-1 border rounded" style="width: 80px; font-size: 13px;" value="2026" onchange="window.cargarHistorialReventas()">
                            </div>
                        </div>
                        <div style="overflow-x: auto;">"""

if target_html in content:
    content = content.replace(target_html, replacement_html)
    print("Patched HTML selectors")
else:
    print("Could not find HTML target")

# 2. JS Modification
target_js = """                let html = '';
                let totalNeta = 0;
                
                const reventas = [];
                snap.forEach(docSnap => reventas.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Ordenar por timestamp (más recientes primero)
                reventas.sort((a, b) => b.timestamp - a.timestamp);
                
                reventas.forEach(rev => {"""

replacement_js = """                // Inicializar selectores si no tienen valor o es primera carga
                const elMes = document.getElementById('historial-rev-mes');
                const elAnio = document.getElementById('historial-rev-anio');
                const hoy = new Date();
                
                if (elMes && !window._reventasFiltroInicializado) {
                    elMes.value = (hoy.getMonth() + 1).toString();
                    elAnio.value = hoy.getFullYear().toString();
                    window._reventasFiltroInicializado = true;
                }

                const targetMes = elMes ? parseInt(elMes.value, 10) : (hoy.getMonth() + 1);
                const targetAnio = elAnio ? parseInt(elAnio.value, 10) : hoy.getFullYear();

                let html = '';
                let totalNeta = 0;
                
                let reventas = [];
                snap.forEach(docSnap => reventas.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Filtrar por fecha
                reventas = reventas.filter(rev => {
                    if (!rev.fecha) return false;
                    const parts = rev.fecha.split('/');
                    if (parts.length >= 3) {
                        return parseInt(parts[1], 10) === targetMes && parseInt(parts[2], 10) === targetAnio;
                    }
                    return false;
                });

                // Ordenar por timestamp (más recientes primero)
                reventas.sort((a, b) => b.timestamp - a.timestamp);
                
                if (reventas.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No hay operaciones registradas en el mes seleccionado.</td></tr>`;
                    return;
                }

                reventas.forEach(rev => {"""

if target_js in content:
    content = content.replace(target_js, replacement_js)
    print("Patched JS Logic")
else:
    print("Could not find JS target")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


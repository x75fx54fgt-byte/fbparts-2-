import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find the old block
pattern = re.compile(
    r'window\.actualizarNotificacionesCobranza\s*=\s*async\s*function\(\)\s*\{.*?\};\n',
    re.DOTALL
)

replacement = """window.actualizarNotificacionesCobranza = function() {
    const filas = document.querySelectorAll('#facturas-table-body tr');
    const lista = document.getElementById('lista-notificaciones'); // Asegúrate de que este ID coincida con tu HTML
    
    let notificacionesHTML = '';
    let contadorVencidas = 0;
    const hoy = new Date();

    filas.forEach(fila => {
        if (fila.cells.length < 5) return; // Omitir filas de carga o vacías

        // 1. Obtener número y cliente limpiando saltos de línea
        const nroFila = fila.cells[0].textContent.trim().split('\\n')[0];
        const fechaStr = fila.cells[1].textContent.trim();
        const clienteStr = fila.cells[2].textContent.trim().split('\\n')[0];

        // 2. Obtener el valor REAL seleccionado en el menú desplegable (NO el textContent de la celda)
        const selectEstatus = fila.querySelector('td:nth-child(4) select');
        if (!selectEstatus) return;
        const estatusActivo = selectEstatus.options[selectEstatus.selectedIndex].text.toUpperCase();

        // 3. Evaluar si es un crédito no pagado
        if (estatusActivo.includes('CRÉDITO') && !estatusActivo.includes('PAGADO')) {
            
            // 4. Parsear fecha DD/MM/YYYY a un objeto Date válido
            const partesFecha = fechaStr.split('/');
            if (partesFecha.length === 3) {
                // new Date(Año, Mes (0-11), Día)
                const fechaFactura = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
                
                // Calcular diferencia en días exactos
                const diferenciaTiempo = hoy.getTime() - fechaFactura.getTime();
                const diasTranscurridos = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));
                
                if (diasTranscurridos > 15) {
                    contadorVencidas++;
                    notificacionesHTML += `
                        <li class="p-3 border-b border-gray-100 hover:bg-red-50 transition-colors cursor-default">
                            <div class="text-sm">
                                <strong class="text-red-600">${nroFila}</strong> - <span class="text-gray-800">${clienteStr}</span>
                            </div>
                            <div class="text-xs text-red-500 mt-1 font-semibold">
                                <i class="fas fa-exclamation-triangle mr-1"></i> Vencida hace ${diasTranscurridos - 15} días (${diasTranscurridos} días desde emisión)
                            </div>
                        </li>`;
                }
            }
        }
    });

    // 5. Inyectar notificaciones en el menú desplegable
    if (lista) {
        lista.innerHTML = contadorVencidas > 0 ? notificacionesHTML : '<li class="p-4 text-gray-500 text-sm text-center">No hay cobros pendientes</li>';
    }

    // 6. Actualizar o crear el circulito rojo (badge) en la campana
    const iconoCampana = document.querySelector('.fa-bell');
    if (iconoCampana) {
        const botonCampana = iconoCampana.parentElement;
        let badge = botonCampana.querySelector('.badge-campana');
        
        if (!badge) {
            // Crear el badge si no existe en el HTML
            badge = document.createElement('span');
            badge.className = 'badge-campana absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full';
            botonCampana.appendChild(badge);
        }
        
        if (contadorVencidas > 0) {
            badge.textContent = contadorVencidas;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

// Asegurar que la función se ejecute al terminar de cargar la tabla
const originalCargarHistorial = window.cargarHistorialFacturas;
window.cargarHistorialFacturas = async function() {
    await originalCargarHistorial();
    window.actualizarNotificacionesCobranza();
};\n"""

if pattern.search(content):
    new_content = pattern.sub(replacement, content)
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced successfully.")
else:
    print("Pattern not found.")


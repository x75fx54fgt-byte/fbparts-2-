import re

with open("admin.html", "r", encoding="utf-8") as f:
    content = f.read()

new_func = """window.filtrarTipoFactura = function() {
    const filtro = document.getElementById('filtro-tipo-factura').value;
    const filas = document.querySelectorAll('#facturas-table-body tr');
    
    filas.forEach(fila => {
        // Evitar filtrar la fila vacía o de carga
        if (fila.cells.length < 2) return; 
        
        const tdNro = fila.querySelector('td:first-child');
        if (!tdNro) return;
        
        // REGLA CLAVE: Leer solo el texto de la PRIMERA columna para evitar leer el <select>
        const textoCeldaNro = tdNro.textContent.toUpperCase();
        
        // Aislar SOLO el número de control (Ej: #00000625N o #00000615)
        const coincidencia = textoCeldaNro.match(/#[0-9]+[A-Z]?/);
        const numeroPrincipal = coincidencia ? coincidencia[0] : "";
        
        // Lógica estricta aplicada solo a la primera columna
        const esNotaEntrega = numeroPrincipal.endsWith('N');
        const esAnuladaONC = textoCeldaNro.includes('N/C') || textoCeldaNro.includes('ANULADA');
        
        let mostrar = false;
        
        if (filtro === 'todas') {
            mostrar = true;
        } else if (filtro === 'fiscales') {
            // Es fiscal activa si NO es nota de entrega y NO está anulada ni tiene N/C
            mostrar = !esNotaEntrega && !esAnuladaONC;
        } else if (filtro === 'nofiscales') {
            // Solo notas de entrega puras
            mostrar = esNotaEntrega && !esAnuladaONC;
        } else if (filtro === 'anuladas') {
            // Solo anuladas o con Nota de Crédito
            mostrar = esAnuladaONC;
        }
        
        // Usar un string vacío en lugar de 'table-row' previene que se rompan las clases de Tailwind (Responsive)
        fila.style.display = mostrar ? '' : 'none';
    });
};"""

old_func_pattern = r"window\.filtrarTipoFactura = function\(\) \{.*?\n\};"
content = re.sub(old_func_pattern, new_func, content, flags=re.DOTALL)

with open("admin.html", "w", encoding="utf-8") as f:
    f.write(content)

with open("admin.html", "r", encoding="utf-8") as f:
    content = f.read()

import re

old_func = r"window\.filtrarTipoFactura = function\(\) \{.*?\}\;"
new_func = """window.filtrarTipoFactura = function() {
    const filtro = document.getElementById('filtro-tipo-factura').value;
    const filas = document.querySelectorAll('#facturas-table-body tr');
    
    filas.forEach(fila => {
        // Evitar filtrar la fila vacía o de carga
        if (fila.cells.length < 2) return; 
        
        const tdNro = fila.querySelector('td:first-child');
        if (!tdNro) return;
        
        const textoCeldaNro = tdNro.textContent.toUpperCase();
        const textoFilaCompleta = fila.textContent.toUpperCase();
        
        // Aislar SOLO el número (Ej: #00000625N o #00000615) usando Regex
        const coincidencia = textoCeldaNro.match(/#[0-9]+[A-Z]?/);
        const numeroPrincipal = coincidencia ? coincidencia[0] : "";
        
        // Lógica estricta
        const esNotaEntrega = numeroPrincipal.endsWith('N');
        const esAnuladaONC = textoFilaCompleta.includes('N/C') || textoFilaCompleta.includes('ANULADA');
        
        let mostrar = false;
        
        if (filtro === 'todas') {
            mostrar = true;
        } else if (filtro === 'fiscales') {
            // Es fiscal activa si NO es nota de entrega y NO está anulada ni tiene N/C
            mostrar = !esNotaEntrega && !esAnuladaONC;
        } else if (filtro === 'nofiscales') {
            // Solo notas de entrega puras
            mostrar = esNotaEntrega;
        } else if (filtro === 'anuladas') {
            // Solo anuladas o con Nota de Crédito
            mostrar = esAnuladaONC;
        }
        
        fila.style.display = mostrar ? 'table-row' : 'none';
    });
};"""

content = re.sub(old_func, new_func, content, flags=re.DOTALL)

with open("admin.html", "w", encoding="utf-8") as f:
    f.write(content)

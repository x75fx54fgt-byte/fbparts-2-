with open("admin.html", "r", encoding="utf-8") as f:
    content = f.read()

func = """        window.filtrarTipoFactura = function() {
            const filtro = document.getElementById('filtro-tipo-factura').value;
            const filas = document.querySelectorAll('#facturas-table-body tr');
            
            filas.forEach(fila => {
                // Evitar filtrar la fila de "Cargando..."
                if (fila.cells.length < 2) return; 
                
                const tdNro = fila.querySelector('td:first-child');
                if (!tdNro) return;
                
                const textoNro = tdNro.textContent.trim().toUpperCase();
                const tieneN = textoNro.includes('N');
                
                if (filtro === 'todas') {
                    fila.style.display = 'table-row';
                } else if (filtro === 'fiscales') {
                    // Mostrar si NO tiene N
                    fila.style.display = tieneN ? 'none' : 'table-row';
                } else if (filtro === 'nofiscales') {
                    // Mostrar si SÍ tiene N
                    fila.style.display = tieneN ? 'table-row' : 'none';
                }
            });
        };
"""

content = content.replace("    </script>\n</body>", func + "    </script>\n</body>")
with open("admin.html", "w", encoding="utf-8") as f:
    f.write(content)


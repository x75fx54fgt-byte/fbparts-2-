import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Shield Icon
target_bell = "<!-- 🔔 Notificaciones de Cobranza -->"
replacement_bell = """<!-- 🛡️ Botón Auditoría Interna -->
                    <button onclick="abrirModalAuditoria()" class="relative hover:opacity-80 transition-opacity p-2 text-white mr-2" title="Auditoría Interna">
                        <i class="fas fa-shield-alt text-xl"></i>
                    </button>
                    
                    <!-- 🔔 Notificaciones de Cobranza -->"""

if target_bell in content:
    content = content.replace(target_bell, replacement_bell)
    print("Shield button inserted.")

# 2. Inject Modal HTML (at the end before </body> or near other modals)
target_body_end = "</body>"
modal_html = """
    <!-- MODAL AUDITORIA INTERNA -->
    <div id="modal-auditoria" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="background: #385723; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 22px;"><i class="fas fa-shield-alt"></i> Trazabilidad y Auditoría</h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="cargarHistorialAuditoria()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s;"><i class="fas fa-sync-alt"></i> Actualizar</button>
                    <button onclick="cerrarModalAuditoria()" style="background: transparent; border: none; color: white; font-size: 24px; line-height: 1; cursor: pointer;">&times;</button>
                </div>
            </div>
            
            <div style="padding: 20px; overflow-y: auto; flex: 1; background: #f4f8f5;">
                <div style="background: white; border-radius: 8px; border: 1px solid #eee; overflow: hidden;">
                    <div style="overflow-x: auto;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr>
                                    <th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Fecha / Hora</th>
                                    <th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Usuario</th>
                                    <th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Acción</th>
                                    <th style="padding: 10px; background: #f9fafb; border-bottom: 2px solid #eee; text-align: left;">Detalles del Cambio</th>
                                </tr>
                            </thead>
                            <tbody id="auditoria-table-body">
                                <tr><td colspan="4" style="text-align: center; padding: 20px;">Cargando historial...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>"""

if target_body_end in content:
    content = content.replace(target_body_end, modal_html)
    print("Modal HTML inserted.")

# 3. Inject JS Modal logic
target_js = "window.cargarHistorialAuditoria = async function() {"
replacement_js = """window.abrirModalAuditoria = function() {
            document.getElementById('modal-auditoria').style.display = 'flex';
            window.cargarHistorialAuditoria();
        };
        
        window.cerrarModalAuditoria = function() {
            document.getElementById('modal-auditoria').style.display = 'none';
        };

        window.cargarHistorialAuditoria = async function() {"""

if target_js in content:
    content = content.replace(target_js, replacement_js)
    print("Modal JS inserted.")


with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

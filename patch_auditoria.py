import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert Sidebar button
target_sidebar = """<button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('reventas', this)"><i class="fas fa-calculator w-5 text-gray-400"></i> Control de Reventas</button>"""
replacement_sidebar = """<button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('reventas', this)"><i class="fas fa-calculator w-5 text-gray-400"></i> Control de Reventas</button>
                <button class="tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" onclick="mostrarPestana('auditoria', this)"><i class="fas fa-shield-alt w-5 text-gray-400"></i> Auditoría Interna</button>"""

if target_sidebar in content:
    content = content.replace(target_sidebar, replacement_sidebar)
    print("Sidebar button inserted.")

# 2. Insert Tab Container
target_tab = """                </div>
            </div>"""

replacement_tab = """                </div>
            </div>

            <!-- PESTAÑA AUDITORIA -->
            <div id="tab-auditoria" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #385723; font-family: 'Oswald', sans-serif; font-size: 28px; margin: 0;"><i class="fas fa-shield-alt"></i> Historial de Auditoría y Cambios</h2>
                    <button onclick="cargarHistorialAuditoria()" style="background: #385723; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
                
                <div style="background: white; border-radius: 8px; border: 1px solid #eee; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="overflow-x: auto;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Fecha / Hora</th>
                                    <th>Usuario</th>
                                    <th>Acción</th>
                                    <th>Detalles del Cambio</th>
                                </tr>
                            </thead>
                            <tbody id="auditoria-table-body">
                                <tr><td colspan="4" style="text-align: center;">Cargando historial...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>"""

# Ensure we insert only at the right place (around line 1591)
# We can search for the end of tab-reventas using regex or string
target_tab_full = """                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>"""

replacement_tab_full = target_tab_full + """

            <!-- PESTAÑA AUDITORIA -->
            <div id="tab-auditoria" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #385723; font-family: 'Oswald', sans-serif; font-size: 28px; margin: 0;"><i class="fas fa-shield-alt"></i> Historial de Auditoría y Cambios</h2>
                    <button onclick="cargarHistorialAuditoria()" style="background: #385723; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
                
                <div style="background: white; border-radius: 8px; border: 1px solid #eee; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="overflow-x: auto;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Fecha / Hora</th>
                                    <th>Usuario</th>
                                    <th>Acción</th>
                                    <th>Detalles del Cambio</th>
                                </tr>
                            </thead>
                            <tbody id="auditoria-table-body">
                                <tr><td colspan="4" style="text-align: center;">Cargando historial...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>"""

if target_tab_full in content:
    content = content.replace(target_tab_full, replacement_tab_full)
    print("Tab HTML inserted.")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


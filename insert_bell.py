with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """<a href="tienda.html" class="text-sm font-medium opacity-90 hover:opacity-100 hover:underline transition"><i class="fas fa-shopping-cart mr-1"></i> Tienda</a>
                    <button onclick="cerrarSesion()" class="flex items-center gap-2 bg-red-500/20 text-red-50 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg font-bold transition border border-red-500/30 shadow-sm">"""

replacement = """<a href="tienda.html" class="text-sm font-medium opacity-90 hover:opacity-100 hover:underline transition"><i class="fas fa-shopping-cart mr-1"></i> Tienda</a>
                    
                    <!-- 🔔 Notificaciones de Cobranza -->
                    <div class="relative" id="bell-container">
                        <button id="btn-campana" class="relative hover:opacity-80 transition-opacity p-2 text-white" onclick="toggleNotificaciones()">
                            <i class="fas fa-bell text-xl"></i>
                            <span id="badge-notificaciones" class="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full hidden" style="transform: translate(20%, -10%);">0</span>
                        </button>
                        <div id="dropdown-notificaciones" class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 hidden text-gray-800 border border-gray-100">
                            <div class="p-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                <h4 class="font-bold text-sm text-brandDark m-0"><i class="fas fa-exclamation-circle text-orange-500"></i> Notificaciones de Cobranza</h4>
                            </div>
                            <ul id="lista-notificaciones" class="max-h-64 overflow-y-auto p-0 m-0 list-none">
                                <!-- JS inyectará facturas aquí -->
                            </ul>
                        </div>
                    </div>

                    <button onclick="cerrarSesion()" class="flex items-center gap-2 bg-red-500/20 text-red-50 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg font-bold transition border border-red-500/30 shadow-sm">"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced Bell HTML!")
else:
    print("Not found! Check target string.")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

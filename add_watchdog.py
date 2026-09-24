with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

watchdog_script = """
    <script>
        window.moduleLoaded = false;
        setTimeout(function() {
            if (!window.moduleLoaded) {
                alert("ERROR CRÍTICO: El módulo principal no cargó.\\n\\nCausas posibles:\\n1. Problemas de conexión a internet o bloqueo de Firebase.\\n2. Error de sintaxis en el archivo JS.\\n3. Caché del navegador antigua.");
                document.getElementById('auth-loading-screen').innerHTML = "<h2 style='color:red;'>ERROR: No se pudo cargar el sistema. Verifique su conexión y refresque (Cmd+Shift+R).</h2>";
            }
        }, 8000);
    </script>
"""

# Insert watchdog before the module
content = content.replace('<script type="module" src="admin_logic.js', watchdog_script + '    <script type="module" src="admin_logic.js')

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('admin_logic.js', 'r', encoding='utf-8') as f:
    logic = f.read()

# Add window.moduleLoaded = true at the very end of admin_logic.js
logic += "\nwindow.moduleLoaded = true;\nconsole.log('Modulo admin_logic cargado exitosamente.');\n"

with open('admin_logic.js', 'w', encoding='utf-8') as f:
    f.write(logic)

print("Watchdog added!")

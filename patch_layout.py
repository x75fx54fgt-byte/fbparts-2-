with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the entire tab-reventas block
start_idx = content.find('            <!-- 🚀 PESTAÑA CONTROL DE REVENTAS -->')
end_idx = content.find('    <!-- CONTENEDOR EXCLUSIVO PARA IMPRESIÓN -->')

if start_idx != -1 and end_idx != -1:
    tab_reventas_block = content[start_idx:end_idx]
    
    # Remove it from its current position
    content = content[:start_idx] + content[end_idx:]
    
    # We want to place it right before the closing divs:
    #         </div>
    #     </div> <!-- Cierre App Wrapper -->
    
    # Let's find exactly those two closing divs
    target_str = "        </div>\n    </div> <!-- Cierre App Wrapper -->"
    insert_idx = content.find(target_str)
    
    if insert_idx != -1:
        # Insert tab_reventas_block right before target_str
        content = content[:insert_idx] + tab_reventas_block + target_str + "\n" + content[insert_idx + len(target_str):]
        
        with open('admin.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Patch successful!")
    else:
        print("Target string not found.")
else:
    print("Tab block bounds not found.")

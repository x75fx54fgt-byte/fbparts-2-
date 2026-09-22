with open('admin.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
skip = False
for i, line in enumerate(lines):
    if skip:
        if "}" in line and "catch" not in line:
            skip = False
        continue
    
    # We want to remove the wrong block around 5756
    # Let's just find the exact line indices.
    if "if (window.calcularGananciaNetaDashboard) {" in line and i > 5000:
        out.append("\n") # Restore original empty line
        skip = True
    elif skip and "await window.calcularGananciaNetaDashboard" in line:
        continue
    elif skip and "}" in line:
        skip = False
    else:
        out.append(line)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.writelines(out)

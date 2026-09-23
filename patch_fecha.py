import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                const targetSuffix = `/${mes}/${anio}`; 

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.fecha && data.fecha.endsWith(targetSuffix)) {"""

replacement = """                const targetMes = parseInt(mes, 10);
                const targetAnio = parseInt(anio, 10);

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    let matchDate = false;
                    
                    if (data.fecha) {
                        const parts = data.fecha.split('/');
                        if (parts.length >= 3) {
                            if (parseInt(parts[1], 10) === targetMes && parseInt(parts[2], 10) === targetAnio) {
                                matchDate = true;
                            }
                        }
                    }

                    if (matchDate) {"""

if target in content:
    content = content.replace(target, replacement)
    print("Patched date logic")
else:
    print("Target not found")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


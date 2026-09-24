import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = "if(selectCat) selectCat.innerHTML = '<option value=\"\">Seleccionar...</option>';"

rep = """const datalistCats = document.getElementById('lista-categorias');
            if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML = '<option value="">Seleccionar...</option>';
            if(datalistCats) datalistCats.innerHTML = '';"""

if target in content:
    content = content.replace(target, rep)
    
target2 = "if(selectCat) selectCat.innerHTML += opt;"
rep2 = """if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML += opt;
                    if(datalistCats) datalistCats.innerHTML += `<option value="${cat.nombre}"></option>`;"""

if target2 in content:
    content = content.replace(target2, rep2)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed target 1 and 2")

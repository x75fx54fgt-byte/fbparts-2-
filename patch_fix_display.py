import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = '<div id="tab-cierre-mensual" class="tab-content" style="display: none;">'
replacement = '<div id="tab-cierre-mensual" class="tab-content">'

if target in content:
    content = content.replace(target, replacement)
    print("Fixed inline display: none")
else:
    print("Could not find the target string")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)


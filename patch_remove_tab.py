with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Regex to completely remove the tab-auditoria
pattern = re.compile(r'<!-- PESTAÑA AUDITORIA -->.*?</div>\s*</div>\s*</div>', re.DOTALL)
if pattern.search(content):
    content = pattern.sub('', content)
    print("Removed tab-auditoria.")
else:
    print("tab-auditoria not found.")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

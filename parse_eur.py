with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = re.findall(r'eur = .*?;', content)
for m in matches:
    print(m)

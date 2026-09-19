import glob
import re

html_files = glob.glob('*.html') + ['styles.css']
for file in html_files:
    if file.startswith('admin') or 'bot' in file:
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace #385723 with #5e8877 (brand green)
    content = re.sub(r'#385723', '#5e8877', content, flags=re.IGNORECASE)
    
    # Replace #2c441b with #4d7162 (brand dark green)
    content = re.sub(r'#2c441b', '#4d7162', content, flags=re.IGNORECASE)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
print("Updated all greens successfully.")

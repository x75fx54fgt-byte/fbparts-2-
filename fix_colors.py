import glob
import re

html_files = glob.glob('*.html')
for file in html_files:
    if file.startswith('admin') or 'bot' in file:
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace #5B8266 (case insensitive) with #5e8877
    content = re.sub(r'#5b8266', '#5e8877', content, flags=re.IGNORECASE)
    
    # Replace #5b8743 (case insensitive) with #5e8877
    content = re.sub(r'#5b8743', '#5e8877', content, flags=re.IGNORECASE)
    
    # Replace #4A6B53 and #4a6b54 with #4d7162
    content = re.sub(r'#4a6b5[34]', '#4d7162', content, flags=re.IGNORECASE)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
print("Updated colors successfully.")

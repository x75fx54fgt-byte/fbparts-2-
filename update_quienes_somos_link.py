import glob

html_files = glob.glob('*.html')
for file in html_files:
    if file.startswith('admin') or 'bot' in file:
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the link in the header nav
    content = content.replace('href="#nosotros"', 'href="quienes-somos.html"')
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
print("Updated links successfully.")

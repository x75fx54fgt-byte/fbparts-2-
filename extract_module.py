import re
import sys

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of the module script
match = re.search(r'<script type="module">\s*', content)
if not match:
    print("Module script not found!")
    sys.exit(1)

start_idx = match.end()

# Find the end of the module script
# Look for the last </script> after start_idx
end_idx = content.find('</script>', start_idx)
if end_idx == -1:
    print("End of module script not found!")
    sys.exit(1)

# Extract the module code
module_code = content[start_idx:end_idx]

# Save to admin_logic.js
with open('admin_logic.js', 'w', encoding='utf-8') as f:
    f.write(module_code)

# Replace the block in admin.html with an external script tag
new_html = content[:match.start()] + '<script type="module" src="admin_logic.js?v=' + str(hash(module_code))[-6:] + '"></script>\n' + content[end_idx + 9:]

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Extraction complete!")

import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Pattern explanation:
# We look for "img/" followed by any characters except quotes (or just typical filename characters), ending in .png or .jpg
# Because we strictly want to change the extension of local images starting with "img/"
pattern = r'(img/[^"\'\s]+)\.(png|jpg)'

def replace_ext(match):
    return match.group(1) + '.webp'

new_html = re.sub(pattern, replace_ext, html, flags=re.IGNORECASE)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(new_html)

print("Replacement complete.")

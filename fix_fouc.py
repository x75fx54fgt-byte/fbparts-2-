import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Remove deferred script from the bottom
bottom_target1 = '    <!-- Tailwind (Deferred for Performance) -->\n    <script defer src="https://cdn.tailwindcss.com"></script>'
bottom_target2 = '<script defer src="https://cdn.tailwindcss.com"></script>'
if bottom_target1 in html:
    html = html.replace(bottom_target1, "")
elif bottom_target2 in html:
    html = html.replace(bottom_target2, "")

# Remove any extra blank lines before </body>
html = re.sub(r'\n\s*\n</body>', '\n</body>', html)

# Insert the blocking script before styles.css
target = '<link rel="preload" href="styles.css"'
sync_tailwind = '    <script src="https://cdn.tailwindcss.com"></script>\n    '
html = html.replace(target, sync_tailwind + target)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("FOUC fix applied.")

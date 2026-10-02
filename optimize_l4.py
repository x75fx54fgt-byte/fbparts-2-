import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. REMOVE ALL TAILWIND SCRIPTS FROM HEAD
tailwind_script = '<script defer src="https://cdn.tailwindcss.com"></script>'
html = html.replace(tailwind_script, '')
tailwind_no_defer = '<script src="https://cdn.tailwindcss.com"></script>'
html = html.replace(tailwind_no_defer, '')

# Add tailwind script before </body>
html = html.replace('</body>', '    <!-- Tailwind (Deferred for Performance) -->\n    <script defer src="https://cdn.tailwindcss.com"></script>\n</body>')

# 2. MAKE STYLES.CSS ASYNCHRONOUS
# Remove old styles.css
old_styles = '<link rel="stylesheet" href="styles.css">'
async_styles = """<link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="styles.css"></noscript>"""

# Since there might be multiple (due to the user's duplication), replace all.
html = html.replace(old_styles, async_styles)

# 3. CHECK FIREBASE DEFER
# The Firebase script is already `<script type="module" defer>` from a previous step.
# Let's verify it or replace it just in case.
if '<script type="module">' in html:
    html = html.replace('<script type="module">', '<script type="module" defer>')

# Let's clean up empty lines if there are any trailing ones created by the removal of tailwind.
html = re.sub(r'\n\s*\n', '\n\n', html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Optimization Level 4 applied successfully")

import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove Tailwind from <head>
tailwind_sync = '        <script src="https://cdn.tailwindcss.com"></script>\n'
if tailwind_sync in html:
    html = html.replace(tailwind_sync, "")
elif '<script src="https://cdn.tailwindcss.com"></script>' in html:
    html = html.replace('<script src="https://cdn.tailwindcss.com"></script>', "")

# 2. Inject <style> block into <head>
style_block = """
    <style>
      /* Suavizar la carga diferida de Tailwind */
      body { animation: fadeIn 0.8s ease-in; }
      @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
    </style>
"""
# Insert it right before the closing </head>
html = html.replace("</head>", style_block + "</head>")

# 3. Add deferred Tailwind before </body>
tailwind_defer = '    <script defer src="https://cdn.tailwindcss.com"></script>\n</body>'
html = html.replace("</body>", tailwind_defer)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Tailwind reverted to deferred with fade-in animation applied.")

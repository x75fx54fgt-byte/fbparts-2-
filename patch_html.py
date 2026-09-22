import re
with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """<span id="badge-notificaciones" class="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full hidden" style="transform: translate(20%, -10%);">0</span>"""

if target in content:
    content = content.replace(target, "")
    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Removed old HTML badge.")
else:
    print("Old HTML badge not found.")


import re
import os

files = ['index.html', 'tienda.html', 'producto.html', 'admin-login.html', 'login.html', 'register.html', 'mi-cuenta.html', 'mis-pedidos.html']

responsive_css = """
        /* =========================================================
           🚀 RESPONSIVE DESIGN TOTAL: MODALS & GENERAL GRIDS
           ========================================================= */
        @media (max-width: 768px) {
            .modal-content { width: 95% !important; padding: 15px !important; margin: 10px auto !important; }
            div[style*="display: grid"] { grid-template-columns: 1fr !important; }
        }
"""

for f in files:
    if os.path.exists(f):
        with open(f, 'r') as file:
            content = file.read()
        
        if "🚀 RESPONSIVE DESIGN TOTAL: MODALS & GENERAL GRIDS" not in content:
            content = content.replace("</style>", f"{responsive_css}</style>")
            with open(f, 'w') as file:
                file.write(content)
            print(f"Updated {f}")


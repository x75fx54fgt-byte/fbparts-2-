import re
import os

files = ['admin-login.html', 'login.html', 'register.html', 'mi-cuenta.html', 'mis-pedidos.html']

table_css = """
        /* =========================================================
           🚀 RESPONSIVE DESIGN TOTAL: TABLAS
           ========================================================= */
        @media (max-width: 768px) {
            .data-table, table { display: block !important; overflow-x: auto !important; white-space: nowrap !important; width: 100% !important; -webkit-overflow-scrolling: touch; }
        }
"""

for f in files:
    if os.path.exists(f):
        with open(f, 'r') as file:
            content = file.read()
        
        if "🚀 RESPONSIVE DESIGN TOTAL: TABLAS" not in content:
            content = content.replace("</style>", f"{table_css}</style>")
            with open(f, 'w') as file:
                file.write(content)
            print(f"Updated {f}")


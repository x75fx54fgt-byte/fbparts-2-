import re
import os

files = ['index.html', 'tienda.html', 'producto.html']

responsive_css = """
        /* =========================================================
           🚀 RESPONSIVE DESIGN: GRID & IMAGES (USER REQUIREMENT)
           ========================================================= */
        img { max-width: 100%; object-fit: cover; }
        
        @media (max-width: 768px) {
            header .header-wrap, header nav { flex-wrap: wrap !important; }
            .products-grid-home, .products-grid, .related-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
            .product-container { grid-template-columns: 1fr !important; padding: 20px !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
            .products-grid-home, .products-grid, .related-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 15px !important; }
        }
"""

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    if "🚀 RESPONSIVE DESIGN: GRID & IMAGES" not in content:
        content = content.replace("</style>", f"{responsive_css}</style>")
        with open(f, 'w') as file:
            file.write(content)
        print(f"Updated {f}")
    else:
        print(f"Already updated {f}")


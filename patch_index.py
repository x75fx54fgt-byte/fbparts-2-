import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """            </div>
        </div>
    </section>

    <section class="block" style="background-color: #fdfdfd; padding: 40px 0;">
        <div class="container px-4 md:px-8">
            <h2 class="section-title" style="text-align: center; margin-bottom: 5px;">RESEÑAS DE CLIENTES</h2>"""

replacement = """            </div>
        </div>
    </section>

    <!-- 🚀 NUEVA SECCIÓN: IMPORTACIÓN DIRECTA GLOBAL -->
    <section id="importadores" class="w-full bg-[#f9fafb] py-16 border-y border-gray-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-14">
                <h2 class="text-3xl md:text-4xl font-bold text-[#5e8877] mb-4 tracking-wide uppercase" style="font-family: 'Oswald', sans-serif;">
                    Músculo en Importación Directa Global
                </h2>
                <p class="text-gray-600 max-w-3xl mx-auto text-base md:text-lg leading-relaxed">
                    Suministro directo de fábrica para vehículos particulares y flotas comerciales en Venezuela, <strong class="text-[#385723]">sin intermediarios</strong>.
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- Tarjeta 1 -->
                <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
                    <div class="absolute top-0 left-0 w-full h-1 bg-[#5e8877] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <div class="w-16 h-16 rounded-2xl bg-[#eef3f0] flex items-center justify-center mb-6 group-hover:bg-[#5e8877] transition-colors duration-300">
                        <i class="fas fa-industry text-3xl text-[#5e8877] group-hover:text-white transition-colors duration-300"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3" style="font-family: 'Oswald', sans-serif; letter-spacing: 0.02em;">Dongfeng & Marcas Chinas</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">
                        Importación directa de componentes, filtros y partes vitales para la gama pesada y ligera de origen asiático.
                    </p>
                </div>

                <!-- Tarjeta 2 -->
                <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
                    <div class="absolute top-0 left-0 w-full h-1 bg-[#5e8877] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <div class="w-16 h-16 rounded-2xl bg-[#eef3f0] flex items-center justify-center mb-6 group-hover:bg-[#5e8877] transition-colors duration-300">
                        <i class="fas fa-truck-moving text-3xl text-[#5e8877] group-hover:text-white transition-colors duration-300"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3" style="font-family: 'Oswald', sans-serif; letter-spacing: 0.02em;">Toyota GAC (China) & Brasil</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">
                        Acceso directo a repuestos genuinos provenientes de las principales plantas de ensamblaje internacionales.
                    </p>
                </div>

                <!-- Tarjeta 3 -->
                <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
                    <div class="absolute top-0 left-0 w-full h-1 bg-[#5e8877] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                    <div class="w-16 h-16 rounded-2xl bg-[#eef3f0] flex items-center justify-center mb-6 group-hover:bg-[#5e8877] transition-colors duration-300">
                        <i class="fas fa-shield-alt text-3xl text-[#5e8877] group-hover:text-white transition-colors duration-300"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3" style="font-family: 'Oswald', sans-serif; letter-spacing: 0.02em;">Trazabilidad y Calidad OEM</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">
                        Garantía absoluta de origen, optimizando costos tanto para ventas al mayor como al detal.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <section class="block" style="background-color: #fdfdfd; padding: 40px 0;">
        <div class="container px-4 md:px-8">
            <h2 class="section-title" style="text-align: center; margin-bottom: 5px;">RESEÑAS DE CLIENTES</h2>"""

if target in content:
    content = content.replace(target, replacement)
    print("Injected new section")
else:
    print("Could not find insertion point")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)


// generar.mjs - Generador de páginas estáticas de productos con URLs amigables (Slugs) y pre-renderizado completo para SEO
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Configuración de rutas para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuración de Firebase (Credenciales oficiales de Firestore)
const firebaseConfig = {
    apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
    authDomain: "fb-parts-app.firebaseapp.com",
    projectId: "fb-parts-app",
    storageBucket: "fb-parts-app.firebasestorage.app",
    messagingSenderId: "21714159445",
    appId: "1:21714159445:web:8f4946cd1c98d9b95dd1dc"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Función para generar slugs limpios y aptos para SEO
function crearSlug(texto) {
    if (!texto) return 'repuesto';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos y diacríticos
        .replace(/[^a-z0-9]+/g, '-')     // Convertir caracteres especiales y espacios a guiones
        .replace(/^-+|-+$/g, '');        // Eliminar guiones al inicio o final
}

const toUrl = (u) => {
    if(!u) return '';
    const m = u.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/|[?&]id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    if(m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
    return u;
};

const logoFallback = "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png";

function renderizarBreadcrumbEstatico(prod) {
    const nombre = prod.nombre || 'Repuesto Automotriz';
    const categoria = prod.categoria || 'Repuestos';
    return `
    <nav class="breadcrumb-nav" aria-label="Breadcrumb">
        <a href="index.html">Inicio</a> › 
        <a href="tienda.html">Tienda</a> › 
        <a href="tienda.html?cat=${encodeURIComponent(categoria)}" id="breadcrumb-category">${escapeHtml(categoria)}</a> <span id="breadcrumb-category-separator">›</span> 
        <span id="breadcrumb-current">${escapeHtml(nombre)}</span>
    </nav>`;
}

function renderizarContenidoEstatico(prod, docId, slug, precioFinal, precioRegularFinal, tieneOferta, pctAhorro) {
    const nombre = prod.nombre || 'Repuesto Automotriz';
    const categoria = prod.categoria || 'Repuestos';
    const marca = prod.marca || '';
    const modelo = prod.modelo || '';
    const subcategoria = prod.subcategoria || '';
    const numero_parte = prod.numero_parte || '';
    const stock = prod.stock !== undefined ? Number(prod.stock) : 1;
    const safeName = (nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const stockTxt = stock > 0
        ? `<span style="color: #27ae60; font-weight: bold;">En Stock (${stock} disponibles)</span>`
        : `<span style="color: #c0392b; font-weight: bold;">Agotado</span>`;
    const numParteTxt = numero_parte
        ? `<p style="margin: 5px 0;"><strong>Número de Parte / OEM:</strong> ${escapeHtml(numero_parte)}</p>`
        : '';
    const descTxt = prod.descripcion
        ? `<div style="margin: 15px 0; color: #444; font-size: 14px; line-height: 1.6; white-space: pre-wrap; font-family: inherit;">${escapeHtml(prod.descripcion)}</div>`
        : '<p style="margin: 10px 0; color: #888; font-size: 13px;">Sin descripción detallada para este repuesto. Contáctanos para mayor información de compatibilidad.</p>';
    const catSubtitle = `F&B PARTS • ${escapeHtml(categoria.toUpperCase())}`;

    const imagenes = Array.isArray(prod.imagenes) && prod.imagenes.length > 0
        ? prod.imagenes.map(toUrl)
        : [toUrl(prod.imagen)].filter(Boolean);
    const mainImg = imagenes[0] || logoFallback;

    const galeriaHTML = imagenes.length > 1
        ? `\n                    <div id="galeria-thumbs" style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">\n` +
          imagenes.map((url, i) => `                        <img src="${url}" data-idx="${i}" onclick="cambiarFotoPrincipal(this)" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:2px solid ${i===0?'#5B8266':'#ddd'}; cursor:pointer; transition:border 0.2s;" onerror="this.style.display='none'">`).join('\n') +
          `\n                    </div>`
        : '';

    const badgeMarca = (marca && marca !== '' && marca !== 'Universal/Multi-marca')
        ? `<span style="background:#e8f4f8; color:#1d6fa5; border:1px solid #bee3f8; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:5px;"><i class="fas fa-car-side"></i> ${escapeHtml(marca)}</span>`
        : '';
    const badgeModelo = (modelo && modelo !== '')
        ? `<span style="background:#f0f4ff; color:#3c4fa8; border:1px solid #c3cff8; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:5px;"><i class="fas fa-cogs"></i> ${escapeHtml(modelo)}</span>`
        : '';
    const badgeSubcat = (subcategoria && subcategoria !== '')
        ? `<span style="background:#f5f0ff; color:#6b46c1; border:1px solid #d6bcfa; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;"><i class="fas fa-tag"></i> ${escapeHtml(subcategoria)}</span>`
        : '';

    const posiciones = Array.isArray(prod.posiciones) && prod.posiciones.length > 0
        ? prod.posiciones.filter(p => p !== 'N/A')
        : (prod.posicion && prod.posicion !== 'N/A' ? [prod.posicion] : []);

    let badgePosicion = '';
    let selectorPosicion = '';
    if (posiciones.length > 1) {
        selectorPosicion = `
                    <div style="margin: 12px 0;">
                        <p style="font-size:13px; font-weight:bold; margin-bottom:8px; color:#333;">Selecciona el lado:</p>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            ${posiciones.map(p => `
                                <button type="button" onclick="seleccionarPosicion(this, '${p}')"
                                    class="btn-pos-var"
                                    style="padding:8px 18px; border:2px solid #ddd; border-radius:8px; background:#fff; color:#333; font-size:13px; font-weight:bold; cursor:pointer; transition:all 0.2s;">
                                    ${p === 'RH' ? '→ RH (Derecho)' : p === 'LH' ? '← LH (Izquierdo)' : p}
                                </button>`).join('')}
                        </div>
                    </div>`;
    } else if (posiciones.length === 1) {
        badgePosicion = `<span style="background:#fff7e6; color:#c07800; border:1px solid #ffe0a0; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">${escapeHtml(posiciones[0])}</span>`;
    }

    const badgesHTML = (badgeMarca || badgeModelo || badgePosicion || badgeSubcat)
        ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin: 10px 0;">${badgeMarca}${badgeModelo}${badgePosicion}${badgeSubcat}</div>`
        : '';

    const modalidadHTML = prod.modalidad
        ? `<p style="margin: 8px 0; font-size:13px;"><strong>Disponibilidad:</strong> <span style="background:#fff3cd; color:#856404; border:1px solid #ffd970; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${escapeHtml(prod.modalidad)}</span></p>`
        : '';

    const badgeOfertaProdHTML = (tieneOferta && pctAhorro > 0) ? `
                    <div id="badge-oferta-contenedor" style="display: inline-flex; align-items: center; gap: 6px; margin: 8px 0 14px 0;">
                        <span style="background: linear-gradient(135deg, #e63946 0%, #b7094c 100%); color: white; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 4px; box-shadow: 0 3px 8px rgba(230,57,70,0.45); text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.6px; display: inline-flex; align-items: center; gap: 5px;">
                            <i id="badge-icono-oferta" class="fas fa-fire"></i> <span id="badge-texto-campana">BLACK FRIDAY</span>
                        </span>
                        <span id="badge-pct-oferta" style="background: #1f2937; color: #fde047; font-size: 11.5px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">
                            -${pctAhorro}% OFF
                        </span>
                    </div>` : `
                    <div id="badge-oferta-contenedor" style="display: none; align-items: center; gap: 6px; margin: 8px 0 14px 0;"></div>`;

    const precioProdHTML = (tieneOferta && pctAhorro > 0) ? `
                    <div id="precio-producto-contenedor" style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                        <span style="text-decoration: line-through; color: #ef4444; font-size: 20px; font-weight: 600;">$${precioRegularFinal.toFixed(2)}</span>
                        <span style="font-size: 32px; color: #2c441b; font-weight: 800; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">$${precioFinal.toFixed(2)}</span>
                    </div>` : `
                    <div id="precio-producto-contenedor" class="product-price">$${precioRegularFinal.toFixed(2)}</div>`;

    let botonML = "";
    if (prod.ml_id && prod.ml_id.trim() !== "") {
        let idML = prod.ml_id.trim();
        if (idML.startsWith("MLV") && !idML.startsWith("MLV-")) idML = idML.replace("MLV", "MLV-");
        botonML = `\n                    <a href="https://articulo.mercadolibre.com.ve/${idML}" target="_blank" class="btn-ml-large"><i class="fas fa-handshake"></i> Ver esta pieza en Mercado Libre</a>`;
    }

    return `
    <div class="product-container" id="product-details-container">
        <div class="product-img-box">
            <img id="img-principal" src="${mainImg}" alt="Repuesto original ${escapeHtml(nombre)} en Caracas - F&B Parts" loading="lazy" decoding="async" onerror="this.src='${logoFallback}'">${galeriaHTML}
        </div>
        <div class="product-details">
            <span style="font-size: 12px; color: #888; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${catSubtitle}</span>
            <h1>${escapeHtml(nombre)}</h1>${badgeOfertaProdHTML}
            ${badgesHTML}
            ${selectorPosicion}
            ${precioProdHTML}
            
            <div class="product-meta">
                <p style="margin: 5px 0;"><strong>Disponibilidad de stock:</strong> ${stockTxt}</p>
                ${modalidadHTML}
                ${numParteTxt}
                ${descTxt}
            </div>

            <button class="btn-add-cart-large" id="btn-add-cart-main" onclick="agregarAlCarrito('${docId}', '${safeName}', ${precioFinal.toFixed(2)})">
                <i class="fas fa-shopping-cart"></i> Añadir al Pedido
            </button>${botonML}
        </div>
    </div>`;
}

async function generarPaginasEstaticas() {
    console.log("🚀 Iniciando generación de páginas estáticas amigables para SEO con Pre-renderizado...");

    // 2. Leer la plantilla base producto.html
    const plantillaPath = path.join(__dirname, 'producto.html');
    if (!fs.existsSync(plantillaPath)) {
        console.error("❌ Error: No se encontró el archivo producto.html como plantilla.");
        process.exit(1);
    }
    const plantillaHtml = fs.readFileSync(plantillaPath, 'utf-8');

    // 3. Descargar todos los productos de Firestore
    console.log("📦 Consultando colección 'productos' en Firestore...");
    const snap = await getDocs(collection(db, "productos"));

    if (snap.empty) {
        console.log("⚠️ No se encontraron productos en la base de datos.");
        return;
    }

    console.log(`✅ Se encontraron ${snap.size} productos. Generando archivos HTML con slugs y pre-renderizado...`);

    let generados = 0;
    const slugsUsados = new Set();

    snap.forEach((docSnap) => {
        const prod = docSnap.data();
        const docId = docSnap.id;

        const nombre = prod.nombre || 'Repuesto Automotriz';
        const marca = (prod.marca && prod.marca !== 'Universal/Multi-marca') ? prod.marca : (prod.marca || 'tu vehículo');
        const numero_parte = prod.numero_parte || '';
        const stock = prod.stock !== undefined ? Number(prod.stock) : 1;
        
        // Generar el slug único amigable para la URL
        const baseSlug = crearSlug(nombre);
        let slug = baseSlug;
        if (slugsUsados.has(slug)) {
            slug = `${baseSlug}-${docId.slice(0, 5).toLowerCase()}`;
        }
        slugsUsados.add(slug);

        const canonicalUrl = `https://www.fybparts.com/${slug}.html`;

        // Construir Título y Descripción SEO
        const titulo = `${nombre} - F&B Parts`;
        const descripcion = `Compra ${nombre} para ${marca}. Repuestos originales en Caracas con delivery gratis. Disponible en F&B Parts.`;

        // Lógica de Precios y Descuento
        const precioRegularFinal = Number(prod.precioRegular || prod.precio || 0);
        const precioOfertaRaw = (prod.precioOferta !== undefined && prod.precioOferta !== null && prod.precioOferta !== '') ? Number(prod.precioOferta) : null;
        const tieneOferta = Boolean(precioOfertaRaw && precioOfertaRaw > 0 && precioOfertaRaw < precioRegularFinal);
        const pctAhorro = tieneOferta ? Math.round((1 - (precioOfertaRaw / precioRegularFinal)) * 100) : 0;
        const mostrarOferta = tieneOferta && pctAhorro > 0;
        const precioFinal = mostrarOferta ? precioOfertaRaw : precioRegularFinal;

        // 4. Inyectar etiquetas dinámicas usando expresiones regulares seguras
        let nuevoHtml = plantillaHtml;

        // Inyectar <title>
        nuevoHtml = nuevoHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(titulo)}</title>`);

        // Inyectar <meta name="description">
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+name=["']description["'][\s\S]*?>/i,
            `<meta name="description" content="${escapeHtml(descripcion)}" id="meta-desc">`
        );

        // Reemplazar robots a index, follow para páginas de producto estáticas generadas
        if (/<meta\s+name=["']robots["'][\s\S]*?>/i.test(nuevoHtml)) {
            nuevoHtml = nuevoHtml.replace(/<meta\s+name=["']robots["'][\s\S]*?>/i, `<meta name="robots" content="index, follow">`);
        } else {
            nuevoHtml = nuevoHtml.replace('</head>', `    <meta name="robots" content="index, follow">\n</head>`);
        }

        // Canonical URL estricto
        if (/<link\s+rel=["']canonical["'][\s\S]*?>/i.test(nuevoHtml)) {
            nuevoHtml = nuevoHtml.replace(/<link\s+rel=["']canonical["'][\s\S]*?>/i, `<link rel="canonical" href="${canonicalUrl}">`);
        } else {
            nuevoHtml = nuevoHtml.replace('</head>', `    <link rel="canonical" href="${canonicalUrl}">\n</head>`);
        }

        // Actualizar etiquetas Open Graph
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:title["'][\s\S]*?>/i,
            `<meta property="og:title" content="${escapeHtml(titulo)}" id="og-title">`
        );
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:description["'][\s\S]*?>/i,
            `<meta property="og:description" content="${escapeHtml(descripcion)}" id="og-desc">`
        );
        if (prod.imagen) {
            nuevoHtml = nuevoHtml.replace(
                /<meta\s+property=["']og:image["'][\s\S]*?>/i,
                `<meta property="og:image" content="${toUrl(prod.imagen)}" id="og-image">`
            );
        }
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:url["'][\s\S]*?>/i,
            `<meta property="og:url" content="${canonicalUrl}" id="og-url">`
        );

        // 5. Bloque Schema.org tipo Product JSON-LD
        const schemaProduct = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": nombre,
            "image": toUrl(prod.imagen) || logoFallback,
            "description": prod.descripcion || `Repuesto automotriz ${nombre} disponible en F&B Parts Caracas.`,
            "sku": numero_parte || docId,
            "mpn": numero_parte || "",
            "brand": {
                "@type": "Brand",
                "name": (marca && marca !== 'Universal/Multi-marca') ? marca : "F&B Parts"
            },
            "offers": {
                "@type": "Offer",
                "url": canonicalUrl,
                "priceCurrency": "USD",
                "price": precioFinal.toFixed(2),
                "priceValidUntil": "2026-12-31",
                "itemCondition": "https://schema.org/NewCondition",
                "availability": stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": "Inversiones FB Parts, C.A."
                }
            }
        };

        const schemaJsonTag = `    <!-- Schema.org JSON-LD para Google Search Console y Rich Results -->\n    <script id="schema-product-jsonld" type="application/ld+json">\n${JSON.stringify(schemaProduct, null, 2)}\n    </script>`;
        if (/<script id="schema-product-jsonld"[\s\S]*?<\/script>/i.test(nuevoHtml)) {
            nuevoHtml = nuevoHtml.replace(/<script id="schema-product-jsonld"[\s\S]*?<\/script>/i, schemaJsonTag);
        } else {
            nuevoHtml = nuevoHtml.replace('</head>', `${schemaJsonTag}\n</head>`);
        }

        // 6. Pre-renderizar Breadcrumb real
        const preRenderedBreadcrumb = renderizarBreadcrumbEstatico(prod);
        nuevoHtml = nuevoHtml.replace(
            /<nav class="breadcrumb-nav"[\s\S]*?<\/nav>/i,
            preRenderedBreadcrumb.trim()
        );

        // 7. Pre-renderizar Contenido Completo del Producto (h1, precios, badges, descripción, etc.)
        const preRenderedContainer = renderizarContenidoEstatico(
            prod,
            docId,
            slug,
            precioFinal,
            precioRegularFinal,
            mostrarOferta,
            pctAhorro
        );
        nuevoHtml = nuevoHtml.replace(
            /<div class="product-container" id="product-details-container">[\s\S]*?<\/div>\s*<\/div>/i,
            preRenderedContainer.trim()
        );

        // 8. Inyección de datos precargados e ID para hidratación instantánea y sincronización
        const datosProducto = {
            id: docId,
            ...prod
        };
        const jsonSeguro = JSON.stringify(datosProducto)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');

        nuevoHtml = nuevoHtml.replace(
            '</head>',
            `    <!-- Datos precargados del repuesto para carga instantánea (Zero-Delay) y SEO -->\n    <script>window.FIREBASE_PRODUCT_ID = "${docId}"; window.PRODUCTO_PRECARGADO = ${jsonSeguro};</script>\n</head>`
        );

        // 9. Guardar archivo físico [slug].html
        const archivoSalida = path.join(__dirname, `${slug}.html`);
        fs.writeFileSync(archivoSalida, nuevoHtml, 'utf-8');
        generados++;
    });

    console.log(`🎉 ¡Éxito! Se generaron ${generados} archivos HTML con contenido pre-renderizado completo y URLs amigables.`);
    process.exit(0);
}

generarPaginasEstaticas().catch((err) => {
    console.error("❌ Error durante la generación:", err);
    process.exit(1);
});

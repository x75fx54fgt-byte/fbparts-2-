// generar.mjs - Generador de páginas estáticas de productos con URLs amigables (Slugs) para SEO
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Configuración de rutas para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuración de Firebase (Tus credenciales oficiales de Firestore)
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

async function generarPaginasEstaticas() {
    console.log("🚀 Iniciando generación de páginas estáticas amigables para SEO...");

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

    console.log(`✅ Se encontraron ${snap.size} productos. Generando archivos HTML con slugs...`);

    let generados = 0;
    const slugsUsados = new Set();

    snap.forEach((docSnap) => {
        const prod = docSnap.data();
        const docId = docSnap.id;

        const nombre = prod.nombre || 'Repuesto Automotriz';
        const marca = (prod.marca && prod.marca !== 'Universal/Multi-marca') ? prod.marca : (prod.marca || 'tu vehículo');
        
        // Generar el slug único amigable para la URL
        const baseSlug = crearSlug(nombre);
        let slug = baseSlug;
        if (slugsUsados.has(slug)) {
            slug = `${baseSlug}-${docId.slice(0, 5).toLowerCase()}`;
        }
        slugsUsados.add(slug);

        // Construir Título y Descripción SEO
        const titulo = `${nombre} - F&B Parts`;
        const descripcion = `Compra ${nombre} para ${marca}. Repuestos originales en Caracas con delivery gratis. Disponible en F&B Parts.`;

        // 4. Inyectar etiquetas dinámicas usando expresiones regulares seguras
        let nuevoHtml = plantillaHtml;

        // Inyectar <title>
        nuevoHtml = nuevoHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titulo}</title>`);

        // Inyectar <meta name="description">
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+name=["']description["'][\s\S]*?>/i,
            `<meta name="description" content="${descripcion}" id="meta-desc">`
        );

        // Actualizar etiquetas Open Graph para WhatsApp y Redes Sociales
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:title["'][\s\S]*?>/i,
            `<meta property="og:title" content="${titulo}" id="og-title">`
        );
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:description["'][\s\S]*?>/i,
            `<meta property="og:description" content="${descripcion}" id="og-desc">`
        );
        if (prod.imagen) {
            nuevoHtml = nuevoHtml.replace(
                /<meta\s+property=["']og:image["'][\s\S]*?>/i,
                `<meta property="og:image" content="${prod.imagen}" id="og-image">`
            );
        }
        nuevoHtml = nuevoHtml.replace(
            /<meta\s+property=["']og:url["'][\s\S]*?>/i,
            `<meta property="og:url" content="https://www.fybparts.com/${slug}.html" id="og-url">`
        );

        // 5. Inyección de datos precargados e ID para carga instantánea (Zero-Delay) y SEO
        const datosProducto = {
            id: docId,
            ...prod
        };
        // Serialización segura para evitar caracteres conflictivos o romper la etiqueta <script>
        const jsonSeguro = JSON.stringify(datosProducto)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');

        nuevoHtml = nuevoHtml.replace(
            '</head>',
            `    <!-- Datos precargados del repuesto para carga instantánea (Zero-Delay) y SEO -->\n    <script>window.FIREBASE_PRODUCT_ID = "${docId}"; window.PRODUCTO_PRECARGADO = ${jsonSeguro};</script>\n</head>`
        );

        // 6. Guardar archivo físico [slug].html
        const archivoSalida = path.join(__dirname, `${slug}.html`);
        fs.writeFileSync(archivoSalida, nuevoHtml, 'utf-8');
        generados++;
    });

    console.log(`🎉 ¡Éxito! Se generaron ${generados} archivos HTML con URLs amigables (ej: ${Array.from(slugsUsados)[0]}.html).`);
    process.exit(0);
}

generarPaginasEstaticas().catch((err) => {
    console.error("❌ Error durante la generación:", err);
    process.exit(1);
});

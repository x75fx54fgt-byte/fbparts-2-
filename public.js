
/**
 * Inicia o reinicia el carrusel animado de la portada pública
 */
let heroTimer = null;
function iniciarAnimacionHero(heroCarousel) {
    if (!heroCarousel) return;
    const heroSlides = heroCarousel.querySelectorAll('.hero-slide');
    const heroDots = heroCarousel.querySelectorAll('.hero-dots span');
    const heroPrev = heroCarousel.querySelector('.arrow.left');
    const heroNext = heroCarousel.querySelector('.arrow.right');

    if (heroSlides.length === 0) return;

    let heroIndex = 0;

    function updateHero() {
        heroSlides.forEach((slide, i) => slide.classList.toggle('active', i === heroIndex));
        heroDots.forEach((dot, i) => dot.classList.toggle('active', i === heroIndex));
    }

    function heroNextSlide() {
        heroIndex = (heroIndex + 1) % heroSlides.length;
        updateHero();
    }

    function heroPrevSlide() {
        heroIndex = (heroIndex - 1 + heroSlides.length) % heroSlides.length;
        updateHero();
    }

    function startHeroAutoplay() {
        if (heroTimer) clearInterval(heroTimer);
        heroTimer = setInterval(heroNextSlide, 4500);
    }

    // Reemplazar listeners viejos clonando los botones de flechas
    if (heroNext) {
        const newNext = heroNext.cloneNode(true);
        heroNext.parentNode.replaceChild(newNext, heroNext);
        newNext.addEventListener('click', (e) => {
            e.preventDefault();
            heroNextSlide();
            startHeroAutoplay();
        });
    }

    if (heroPrev) {
        const newPrev = heroPrev.cloneNode(true);
        heroPrev.parentNode.replaceChild(newPrev, heroPrev);
        newPrev.addEventListener('click', (e) => {
            e.preventDefault();
            heroPrevSlide();
            startHeroAutoplay();
        });
    }

    heroDots.forEach((dot, idx) => {
        dot.style.cursor = 'pointer';
        dot.onclick = () => {
            heroIndex = idx;
            updateHero();
            startHeroAutoplay();
        };
    });

    updateHero();
    startHeroAutoplay();
}

/**
 * Normaliza enlaces de imágenes compartidos (Google Drive, Dropbox, HTTPS)
 */
function normalizarUrlImagen(url) {
    if (!url || typeof url !== 'string') return '';
    let cleanUrl = url.trim();
    const driveMatch = cleanUrl.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/|[?&]id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    if (cleanUrl.includes('dropbox.com')) {
        if (cleanUrl.includes('?dl=0')) return cleanUrl.replace('?dl=0', '?raw=1');
        if (cleanUrl.includes('&dl=0')) return cleanUrl.replace('&dl=0', '&raw=1');
        if (!cleanUrl.includes('raw=1')) return cleanUrl + (cleanUrl.includes('?') ? '&raw=1' : '?raw=1');
    }
    return cleanUrl;
}

function obtenerGoogleDriveId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/|[?&]id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    return match ? match[1] : null;
}

/**
 * Carga y renderiza los banners activos del carrusel principal desde Firestore (web_banners)
 */
export async function cargarBannersHeroPublico() {
    const heroCarousel = document.getElementById('heroCarousel');
    if (!heroCarousel) return;

    const track = heroCarousel.querySelector('.hero-track');
    const dotsContainer = heroCarousel.querySelector('.hero-dots');
    if (!track) return;

    try {
        let snap;
        try {
            const q = query(
                collection(db, "web_banners"),
                where("activo", "==", true),
                orderBy("orden", "asc")
            );
            snap = await getDocs(q);
        } catch (e) {
            const qSimple = query(
                collection(db, "web_banners"),
                where("activo", "==", true)
            );
            snap = await getDocs(qSimple);
        }

        if (!snap || snap.empty) {
            // Mantiene los banners estáticos originales si Firestore aún no tiene ninguno
            return;
        }

        const banners = [];
        snap.forEach(d => banners.push({ id: d.id, ...d.data() }));
        banners.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

        if (banners.length === 0) return;

        let slidesHtml = '';
        let dotsHtml = '';

        banners.forEach((b, idx) => {
            const activoClass = idx === 0 ? ' active' : '';
            const titulo = sanitizarTexto(b.titulo || 'F&B PARTS');
            const subtitulo = sanitizarTexto(b.subtitulo || '');
            const btnTexto = sanitizarTexto(b.botonTexto || 'VER PRODUCTOS');
            const btnLink = sanitizarTexto(b.botonLink || 'tienda.html');
            const rawImg = b.imagen || 'img/fotoportada.webp';
            const driveId = obtenerGoogleDriveId(rawImg);
            const imagen = sanitizarTexto(normalizarUrlImagen(rawImg));

            let bgStyle = '';
            if (driveId) {
                bgStyle = `background-image: linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url('https://lh3.googleusercontent.com/d/${driveId}'), url('https://drive.google.com/thumbnail?id=${driveId}&sz=w1920'), url('img/fotoportada.webp');`;
            } else {
                bgStyle = `background-image: linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url('${imagen}'), url('img/fotoportada.webp');`;
            }

            slidesHtml += `
                <div class="hero-slide${activoClass}" style="${bgStyle}" role="img" aria-label="${titulo}">
                    <div class="hero-overlay">
                        <h2 style="margin: 0 0 10px 0; color: var(--title, #2c441b); font-size: 24px; font-weight: 700; letter-spacing: .08em; line-height: 1.1; font-family: 'Oswald', sans-serif;">
                            ${titulo}
                        </h2>
                        <div class="sub" style="margin: 8px 0 24px; color: var(--title, #333); font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 400; letter-spacing: .04em; line-height: 1.2;">
                            ${subtitulo}
                        </div>
                        <a class="cta" href="${btnLink}">${btnTexto}</a>
                    </div>
                </div>
            `;

            dotsHtml += `<span class="${idx === 0 ? 'active' : ''}"></span>`;
        });

        track.innerHTML = slidesHtml;
        if (dotsContainer) dotsContainer.innerHTML = dotsHtml;

        iniciarAnimacionHero(heroCarousel);

    } catch (err) {
        console.warn("No se pudieron cargar banners dinámicos, conservando los originales:", err);
    }
}


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuración oficial de Firebase FB Parts
const firebaseConfig = {
    apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
    authDomain: "fb-parts-app.firebaseapp.com",
    projectId: "fb-parts-app",
    storageBucket: "fb-parts-app.firebasestorage.app",
    messagingSenderId: "21714159445",
    appId: "1:21714159445:web:8f4946cd1c98d9b95dd1dc"
};

// Inicializar Firebase Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Sanitiza texto para evitar inyecciones HTML en el frontend público
 */
function sanitizarTexto(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Carga y renderiza los repuestos destacados activos desde Firestore (web_destacados)
 */
export async function cargarDestacadosPublico() {
    const contenedor = document.getElementById('contenedor-destacados') || document.getElementById('destacados-grid');
    if (!contenedor) return;

    try {
        // Consultar colección web_destacados donde mostrar_en_destacados == true
        let snap;
        try {
            const q = query(
                collection(db, "web_destacados"),
                where("mostrar_en_destacados", "==", true),
                orderBy("timestamp", "desc")
            );
            snap = await getDocs(q);
        } catch (queryErr) {
            // Fallback sin orderBy si el índice compuesto aún no está indexado en Firestore
            console.warn("Consulta con orderBy en web_destacados no disponible, ejecutando query simple:", queryErr);
            const qSimple = query(
                collection(db, "web_destacados"),
                where("mostrar_en_destacados", "==", true)
            );
            snap = await getDocs(qSimple);
        }

        if (!snap || snap.empty) {
            contenedor.innerHTML = `
                <div style="text-align: center; padding: 45px 20px; color: #666; grid-column: 1/-1; background: white; border-radius: 10px; border: 1px dashed #d1d5db; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <i class="fas fa-tags" style="font-size: 32px; color: #5e8877; margin-bottom: 12px; display: block;"></i>
                    <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #2c441b; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">INVENTARIO DESTACADO EN ACTUALIZACIÓN</h3>
                    <p style="margin: 0; font-size: 13.5px; color: #6b7280;">Estamos renovando nuestras ofertas y piezas destacadas para Caracas.</p>
                </div>`;
            return;
        }

        // Obtener docs y ordenar manualmente si fue fallback simple
        const items = [];
        snap.forEach(docSnap => {
            items.push({ id: docSnap.id, ...docSnap.data() });
        });
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        let html = '';

        items.forEach(item => {
            const nombre = sanitizarTexto(item.nombre || 'Repuesto Automotriz');
            const rawImg = item.imagen || 'img/logo-fb-parts.png';
            const driveId = obtenerGoogleDriveId(rawImg);
            const imagen = sanitizarTexto(normalizarUrlImagen(rawImg));
            const precioRegular = Number(item.precioRegular) || 0;
            const precioOferta = (item.precioOferta !== null && item.precioOferta !== undefined && item.precioOferta !== '') 
                ? Number(item.precioOferta) 
                : null;

            const fallbackAttr = driveId
                ? `onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='https://drive.google.com/thumbnail?id=${driveId}&sz=w1920';}else{this.onerror=null;this.src='img/logo-fb-parts.png';}"`
                : `onerror="this.onerror=null; this.src='img/logo-fb-parts.png';"`;

            // Generar slug para enlazar al producto
            const slug = sanitizarTexto(item.slug || nombre
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, ''));
            const productUrl = `${slug}.html`;

            // Lógica de Descuentos (Black Friday / Oferta)
            const tieneOferta = precioOferta !== null && precioOferta > 0 && precioOferta < precioRegular;
            const pctAhorro = tieneOferta ? Math.round((1 - (precioOferta / precioRegular)) * 100) : 0;

            // Badge de Oferta / Black Friday en la esquina superior izquierda
            const badgeOfertaHtml = tieneOferta ? `
                <div style="position: absolute; top: 12px; left: 12px; z-index: 2; display: flex; flex-direction: column; gap: 4px; pointer-events: none;">
                    <span style="background: linear-gradient(135deg, #e63946 0%, #b7094c 100%); color: white; font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 4px; box-shadow: 0 3px 8px rgba(230,57,70,0.45); text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.6px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-fire"></i> BLACK FRIDAY
                    </span>
                    <span style="background: #1f2937; color: #fde047; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 3px; align-self: flex-start; text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">
                        -${pctAhorro}% OFF
                    </span>
                </div>
            ` : '';

            // Renderizado de Precios según especificación
            let precioHtml = '';
            if (tieneOferta) {
                precioHtml = `
                    <div style="margin-bottom: 12px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                        <span style="text-decoration: line-through; color: #ef4444; font-size: 14px; font-weight: 600;">$${precioRegular.toFixed(2)}</span>
                        <span style="color: #2c441b; font-size: 22px; font-weight: 800; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">$${precioOferta.toFixed(2)}</span>
                    </div>
                `;
            } else {
                precioHtml = `
                    <div style="margin-bottom: 12px;">
                        <span style="color: #5e8877; font-size: 20px; font-weight: 800; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">$${precioRegular.toFixed(2)}</span>
                    </div>
                `;
            }

            html += `
            <div class="card-repuesto-destacado" style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); display: flex; flex-direction: column; position: relative; transition: transform 0.25s ease, box-shadow 0.25s ease;">
                ${badgeOfertaHtml}
                <a href="${productUrl}" style="text-decoration: none; color: inherit; display: block;" title="Ver detalles de ${nombre}">
                    <div style="width: 100%; height: 190px; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 12px; box-sizing: border-box; border-bottom: 1px solid #f3f4f6;">
                        <img src="${imagen}" alt="Repuesto ${nombre} en Caracas" loading="lazy" decoding="async" 
                            style="width: 100%; height: 100%; object-fit: contain; transition: transform 0.3s ease;"
                            ${fallbackAttr}>
                    </div>
                </a>
                <div style="padding: 14px 16px; display: flex; flex-direction: column; flex: 1;">
                    <a href="${productUrl}" style="text-decoration: none; color: inherit; display: block; flex: 1;">
                        <h4 style="font-size: 13.5px; color: #1f2937; margin: 0 0 10px 0; font-weight: 700; line-height: 1.35; min-height: 36px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${nombre}">
                            ${nombre}
                        </h4>
                    </a>
                    
                    ${precioHtml}

                    <div style="margin-top: auto;">
                        <button type="button" onclick="window.location.href='${productUrl}'" 
                            style="background: #5e8877; color: white; border: none; padding: 9px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; width: 100%; font-size: 13px; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s ease;">
                            <i class="fas fa-eye"></i> VER DETALLES
                        </button>
                    </div>
                </div>
            </div>`;
        });

        contenedor.innerHTML = html;

    } catch (err) {
        console.error("Error al cargar repuestos destacados en public.js:", err);
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #ef4444; grid-column: 1/-1;">
                <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 8px;"></i>
                <p style="margin: 0; font-size: 14px;">No se pudieron cargar los repuestos destacados en este momento.</p>
            </div>`;
    }
}

// Ejecución automática al cargar el documento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cargarDestacadosPublico();
        cargarBannersHeroPublico();
    });
} else {
    cargarDestacadosPublico();
    cargarBannersHeroPublico();
}

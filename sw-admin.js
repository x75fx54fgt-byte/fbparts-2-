/**
 * =========================================================================
 * ⚙️ SERVICE WORKER PWA - F&B PARTS ADMIN (iOS & Mobile)
 * Inversiones FB Parts C.A.
 * =========================================================================
 */

const CACHE_NAME = 'fbparts-admin-pwa-v1';

// Recursos base del App Shell (solo estáticos)
const APP_SHELL = [
    './admin.html',
    './manifest-admin.json',
    './styles.css',
    './styles-mobile-admin.css',
    './img/icon-192.png',
    './img/icon-512.png',
    './img/apple-touch-icon.png'
];

// Dominios y rutas que NUNCA deben cachearse (datos en vivo de Firebase y APIs cambiarias)
const BYPASS_URL_PATTERNS = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseio.com',
    've.dolarapi.com',
    'criptoya.com',
    'js.puter.com',
    'cdn.tailwindcss.com',
    '_vercel',
    'chrome-extension'
];

// 1. INSTALACIÓN: Cachear App Shell estático
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 [PWA Admin] Pre-cacheando App Shell estático...');
            return cache.addAll(APP_SHELL).catch((err) => {
                console.warn('⚠️ [PWA Admin] Aviso al pre-cachear algunos archivos:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVACIÓN: Limpiar cachés antiguas y tomar control inmediato
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🧹 [PWA Admin] Eliminando caché obsoleta:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. ESTRATEGIA DE RED:
// - Peticiones no-GET: Directas a red
// - Firebase / APIs en vivo: Network-Only (0% cacheo agresivo)
// - Navegación / App Shell: Network-First con fallback a caché offline
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo interceptar peticiones GET
    if (request.method !== 'GET') {
        return;
    }

    const url = request.url;

    // Bypassear APIs dinámicas en vivo
    const shouldBypass = BYPASS_URL_PATTERNS.some((pattern) => url.includes(pattern));
    if (shouldBypass) {
        return; // Deja que el navegador maneje la petición directo a red
    }

    // Navegación (HTML de admin.html): Network-First
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('./admin.html');
                    });
                })
        );
        return;
    }

    // Recursos estáticos locales: Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => null);

            return cachedResponse || fetchPromise;
        })
    );
});

/**
 * =========================================================================
 * ⚙️ SERVICE WORKER PWA & FCM - F&B PARTS ADMIN (iOS & Mobile)
 * Inversiones FB Parts C.A.
 * =========================================================================
 */

// 1. Importar SDK Compat de Firebase para Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// 2. Configuración de Firebase del Proyecto
const firebaseConfig = {
    apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
    authDomain: "fb-parts-app.firebaseapp.com",
    projectId: "fb-parts-app",
    storageBucket: "fb-parts-app.firebasestorage.app",
    messagingSenderId: "21714159445",
    appId: "1:21714159445:web:8f4946cd1c98d9b95dd1dc"
};

// 3. Inicializar Firebase Messaging en Segundo Plano
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('📬 [SW Admin] Notificación recibida en segundo plano:', payload);
    const titulo = payload.notification?.title || payload.data?.title || 'F&B Parts - Notificación';
    const opciones = {
        body: payload.notification?.body || payload.data?.body || 'Nueva actualización en el panel administrativo.',
        icon: payload.notification?.icon || payload.data?.icon || './img/logo-fb-parts.png',
        badge: payload.notification?.badge || payload.data?.badge || './img/icon-192.png',
        data: {
            url: payload.data?.url || payload.fcmOptions?.link || 'https://www.fybparts.com/admin.html',
            ...payload.data
        }
    };
    return self.registration.showNotification(titulo, opciones);
});

// 4. Manejador de Clic en la Notificación Nativa
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || 'https://www.fybparts.com/admin.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una pestaña de admin.html abierta, enfocarla
            for (const client of windowClients) {
                if (client.url.includes('admin.html') && 'focus' in client) {
                    if (client.url !== targetUrl && 'navigate' in client) {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir la URL objetivo
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// =========================================================================
// 📦 GESTIÓN DE CACHÉ PWA Y ESTRATEGIAS OFFLINE
// =========================================================================

const CACHE_NAME = 'fbparts-admin-pwa-v2';

// Recursos base del App Shell (solo estáticos)
const APP_SHELL = [
    './admin.html',
    './manifest-admin.json',
    './styles.css',
    './styles-mobile-admin.css',
    './img/logo-fb-parts.png',
    './img/icon-192.png',
    './img/icon-512.png',
    './img/apple-touch-icon.png'
];

// Dominios y rutas que NUNCA deben cachearse (datos en vivo de Firebase y APIs cambiarias)
const BYPASS_URL_PATTERNS = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'fcm.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'firebaseio.com',
    've.dolarapi.com',
    'criptoya.com',
    'js.puter.com',
    'cdn.tailwindcss.com',
    '_vercel',
    'chrome-extension'
];

// 5. INSTALACIÓN: Cachear App Shell estático
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

// 6. ACTIVACIÓN: Limpiar cachés antiguas y tomar control inmediato
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

// 7. ESTRATEGIA DE RED:
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

/* ══════════════════════════════════
   Musical Trips — Service Worker 🎭
   ══════════════════════════════════ */

const CACHE_NAME = 'musical-trips-v1';

const ASSETS = [
  '/app-viaje/',
  '/app-viaje/index.html',
  '/app-viaje/style.css',
  '/app-viaje/app.js',
  '/app-viaje/manifest.json',
  '/app-viaje/icons/icon.svg',
];

// Instalar: guardar archivos en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar: borrar cachés antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: caché primero, red como respaldo
self.addEventListener('fetch', e => {
  // Solo interceptar peticiones GET
  if (e.request.method !== 'GET') return;

  // Para peticiones externas (fuentes, mapas, firebase) usar red directamente
  const url = new URL(e.request.url);
  const isExternal = url.origin !== location.origin;
  if (isExternal) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Guardar en caché si es una respuesta válida
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

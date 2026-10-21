/* Service Worker de SPA Nereyda.
 * Plantilla: el build (vite.config.ts) inyecta la versión de caché y la lista de precache.
 * - Precache del app shell.
 * - Cache first para assets estáticos.
 * - Network first para datos de la API (GET).
 * - Página offline para navegaciones sin conexión.
 * - Control de versión: al activar se eliminan cachés de versiones anteriores.
 */
const CACHE_VERSION = '__CACHE_VERSION__';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, DATA_CACHE];

const PRECACHE_URLS = __PRECACHE_URLS__;
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/index.html';

// Endpoints que nunca se guardan en caché (sesión, credenciales, salud)
const NO_CACHE_API = ['/api/auth/', '/api/health', '/api/profile'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Al cerrar sesión se eliminan los datos de negocio cacheados
  if (event.data === 'CLEAR_DATA_CACHE') event.waitUntil(caches.delete(DATA_CACHE));
});

const networkFirstData = async (request) => {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ message: 'Sin conexión', code: 'OFFLINE' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

const cacheFirstAsset = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
};

const navigation = async (request) => {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(SHELL_URL)) || (await caches.match(OFFLINE_URL));
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (NO_CACHE_API.some((p) => url.pathname.startsWith(p))) return;
    event.respondWith(networkFirstData(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  event.respondWith(cacheFirstAsset(request));
});

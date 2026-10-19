// Service worker de Forja: app shell en caché (funciona sin conexión).
// La API nunca se cachea aquí: los datos offline viven en IndexedDB.
const VERSION = 'forja-v1.2.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'api.js', 'db.js', 'calc.js', 'chart.js', 'exercises.js', 'config.js', 'local-server.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // Cada archivo por separado: si uno falta (p. ej. nombres con hash en otro hosting) el resto sí se guarda
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // API y terceros: directo a la red

  // Navegación: red primero (para recibir actualizaciones), caché si no hay conexión
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(VERSION);
        c.put('index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // Archivos estáticos: caché primero y actualización en segundo plano
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') (await caches.open(VERSION)).put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || new Response('Sin conexión', { status: 503 });
  })());
});

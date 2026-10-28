// Service worker du launcher Ludiworld. Incrémenter VERSION à chaque publication.
// Les jeux ont chacun leur propre service worker (autre dossier) : on ne s'en occupe pas.
const VERSION = 'ludiworld-0.2.0';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'kit/ludi.js',
  'fonts/baloo2-500.woff2', 'fonts/baloo2-700.woff2', 'fonts/baloo2-800.woff2',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ludiworld-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const ours = url.pathname.startsWith(new URL('./', self.registration.scope).pathname);

  // Fiches des jeux : le réseau d'abord (pour voir les nouveautés), le cache sinon.
  if (ours && url.pathname.includes('/jeux/')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  // Icônes des jeux (dans leurs dossiers) : le cache d'abord, mis à jour en arrière-plan.
  if (!ours && /\.(png|webp|jpg)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // Le launcher lui-même : le cache d'abord.
  if (ours) e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});

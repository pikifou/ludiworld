// Service worker du launcher Ludiworld. Incrémenter VERSION à chaque publication.
// Les jeux ont chacun leur propre service worker (autre dossier) : on ne s'en occupe pas.
const VERSION = 'ludiworld-0.5.1';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'textes.js', 'temps.js', 'synchro.js', 'site/nuage.js', 'manifest.webmanifest', 'kit/ludi.js',
  'site/barre.js', 'site/barre.css',
  'fonts/baloo2-500.woff2', 'fonts/baloo2-700.woff2', 'fonts/baloo2-800.woff2',
  'fonts/lexend.woff2', 'fonts/fraunces.woff2', 'fonts/fraunces-italic.woff2',
  'img/ile-jour.webp', 'img/ile-nuit.webp', 'img/soleil.webp', 'img/lune.webp',
  'img/nuage-1.webp', 'img/nuage-2.webp', 'img/nuage-3.webp',
  'img/marmotte-salut.webp', 'img/marmotte-baille.webp', 'img/marmotte-dodo.webp', 'img/marmotte-carnet.webp',
  'icons/marmotte-192.png', 'icons/marmotte-512.png', 'icons/marmotte-64.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' : on redemande tout au serveur, sinon le cache du navigateur (10 min sur GitHub Pages) peut rendre l'ancienne version.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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

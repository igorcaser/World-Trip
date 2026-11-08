// Service worker: lets the app open without internet.
// Bump CACHE when you want phones to drop old cached files.
const CACHE = 'world-trip-v1';
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const APP = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'firebase-config.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const SDK_FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => SDK + f);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(APP);
    await Promise.all(SDK_FILES.map((u) => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isSdk = req.url.startsWith(SDK);
  if (!isSdk && url.origin !== location.origin) return; // Firebase API calls go straight to the network
  if (isSdk) { // SDK files never change for a given version: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  // App files: network first (updates show immediately when online), cache when offline
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

// Service worker: lets the app open without internet.
// Bump CACHE when you want phones to drop old cached files.
const CACHE = 'world-trip-v4';
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const APP = ['./', 'index.html', 'styles.css', 'app.js', 'ui.js', 'data.js', 'firebase-config.js',
  'features/index.js', 'features/todos.js', 'features/places.js', 'features/activities.js',
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
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // App files: network first (revalidated, so a deploy never mixes old and new files),
  // but fall back to the saved copy if offline or if the network stalls for 4 seconds.
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  net.catch(() => {});
  e.respondWith(Promise.race([
    net.catch(async () => (await fromCache()) || Response.error()),
    new Promise((r) => setTimeout(r, 4000)).then(async () => (await fromCache()) || net)
  ]));
});

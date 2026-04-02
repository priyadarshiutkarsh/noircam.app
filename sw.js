/**
 * sw.js — NoirCam Service Worker (PWA support)
 * Caches app shell for offline use.
 */
const CACHE = 'noircam-v1';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/filters.js',
  './js/camera.js',
  './js/recorder.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for camera API calls, cache-first for static assets
  if (e.request.url.includes('getUserMedia') || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

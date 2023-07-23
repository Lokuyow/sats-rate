// Cache name
const CACHE_NAME = 'sats-rate-caches-v1';
// Cache targets
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './images/icon_x192.png',
  './images/icon_x512.png',
  './images/maskable_icon_x192.png',
  './images/maskable_icon_x512.png',
  './favicons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        return response ? response : fetch(event.request);
      })
  );
});

// Cache name
const CACHE_NAME = 'sat-conv-caches-v1';
// Cache targets
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './images/icon.png',
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

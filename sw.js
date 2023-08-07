// Cache name
const CACHE_NAME = 'sats-rate-caches-v1.16';
// Cache targets
const urlsToCache = [
  './index.html',
  './styles.css',
  './main.js',
  './images/icon_x192.png',
  './images/icon_x512.png',
  './images/maskable_icon_x192.png',
  './images/maskable_icon_x512.png',
  './images/bitcoin-sign-solid.svg',
  './images/yen-sign-solid.svg',
  './images/dollar-sign-solid.svg',
  './images/square-x-twitter.svg',
  './images/cloud-solid.svg',
  './images/ostrich.svg',
  './images/copy-solid.svg',
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

self.addEventListener('activate', (event) => {
  var cacheWhitelist = [CACHE_NAME]; // このバージョン以外は削除

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
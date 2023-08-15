// Cache name
const CACHE_NAME = 'sats-rate-caches-v1.28';
// Cache targets
const urlsToCache = [
  './index.html',
  './styles.css',
  './main.js',
  './favicons/favicon.ico',
  './images/icon_x192.png',
  './images/icon_x512.png',
  './images/maskable_icon_x192.png',
  './images/maskable_icon_x512.png',
  './images/title.svg',
  './images/白抜きのビットコインアイコン.svg',
  './images/白抜きの円アイコン.svg',
  './images/白抜きのドルアイコン.svg',
  './images/白抜きのユーロアイコン.svg',
  './images/square-x-twitter.svg',
  './images/nostr-icon-purple-on-white.svg',
  './images/cloud-solid.svg',
  './images/share-nodes-solid.svg',
  './images/clipboard-solid.svg'
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
  var cacheWhitelist = [CACHE_NAME];

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
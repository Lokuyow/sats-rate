const urlsToCache = [
    './index.html',
    './styles.css',
    './main.js',
    './manifest.json',
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
    './images/clipboard-solid.svg',
    './images/fulgur-favicon.ico',
    './images/alby_icon_head_yellow_48x48.svg',
    './images/btcmap-logo.svg',
    './images/robosats-favicon.ico',
    './images/mempool-favicon.ico',
    './images/bolt-solid.svg',
    './images/list-ol-solid.svg',
    './images/magnifying-glass-solid.svg',
    './images/sun-regular.svg',
    './images/moon-regular.svg',
    './images/angle-down-solid.svg'
];

const VERSION = '1.38';
let CACHE_NAME = 'sats-rate-caches-' + VERSION;
const MY_CACHES = new Set([CACHE_NAME]);

self.addEventListener('install', (ev) => ev.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urlsToCache);

    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter(key => !MY_CACHES.has(key))
            .map(key => caches.delete(key))
    );
    return self.skipWaiting();
})()));

self.addEventListener('fetch', (ev) => void ev.respondWith((async () => {
    const url = new URL(ev.request.url);
    if (url.origin === location.origin) {
        url.search = '';
    }

    let requestToFetch = ev.request;

    if (ev.request.mode === 'navigate') {
        requestToFetch = new Request(ev.request, {
            mode: 'cors'
        });
    }

    const cacheResponse = await caches.match(url.toString());

    return cacheResponse || fetch(requestToFetch);
})()));

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const client of clientsList) {
        client.postMessage({ type: 'NEW_VERSION_ACTIVE' });
      }
  
      return self.clients.claim();
    })());
  });

self.addEventListener('message', (event) => {
    if (event.data.action === 'getVersion') {
        event.ports[0].postMessage({ version: VERSION });
    }
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
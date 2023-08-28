// Cache name
const SW_CACHE_NAME = 'sats-rate-caches-v1.31';
const RATE_CACHE_NAME = 'rate-cache';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd%2Ceur&include_last_updated_at=true&precision=5';
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
    './images/copy-regular.svg',
    './images/paste-regular.svg',
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
            .open(SW_CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                return caches.open(RATE_CACHE_NAME);
            })
            .then((cache) => {
                return fetch(COINGECKO_URL)
                    .then((response) => {
                        return cache.put(COINGECKO_URL, response);
                    });
            })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes(COINGECKO_URL)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(RATE_CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse).catch((error) => { });
                    }).catch((error) => { });
                    return response;
                })
                .catch(() => {
                    return caches.open(RATE_CACHE_NAME).then((cache) => {
                        return cache.match(event.request).then((response) => {
                            if (response) {
                                return response;
                            } else {
                                return new Response("Offline data not available");
                            }
                        });
                    });
                })
        );
    } else {
        event.respondWith(
            caches.open(SW_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (event.request.url.startsWith('http') && event.request.method === 'GET') {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return new Response("Offline data not available");
                    });
                });
            })
        );
    }
});

self.addEventListener('activate', (event) => {
    var cacheWhitelist = [SW_CACHE_NAME, RATE_CACHE_NAME];

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
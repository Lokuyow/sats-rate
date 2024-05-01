const urlsToCache = [
    './index.html',
    './styles.css',
    './main.js',
    './lib/currencyManager.js',
    './lib/lightning-address.js',
    './lib/pos.js',
    './lib/currencies.json',
    './manifest.json',
    './fonts/MPLUSRounded1c-Medium.ttf',
    './fonts/MPLUSRounded1c-Bold.ttf',
    './favicons/favicon.ico',
    './images/icon_x192.png',
    './images/icon_x512.png',
    './images/maskable_icon_x192.png',
    './images/maskable_icon_x512.png',
    './images/square-x-twitter.svg',
    './images/nostr-icon-purple-on-white.svg',
    './images/cloud-solid.svg',
    './images/share-nodes-solid.svg',
    './images/clipboard-solid.svg',
    './images/bitcoin-zukan.png',
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
    './images/angle-down-solid.svg',
    './images/settings-solid.svg',
    './images/bitcoin-icon.svg'
];

const VERSION = '1.43';
let CACHE_NAME = 'sats-rate-caches-' + VERSION;
const MY_CACHES = new Set([CACHE_NAME]);

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urlsToCache);

        // 新しいバージョンがインストールされたことをクライアントに通知
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
            clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_INSTALLED' }));
        });

        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(key => !MY_CACHES.has(key))
                .map(key => caches.delete(key))
        );
        return self.skipWaiting();
    })());
});

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

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data === 'CHECK_UPDATE_STATUS') {
        if (self.registration.waiting) {
            // 新しいバージョンがインストールされ、待機中であれば NEW_VERSION_INSTALLED を送信
            event.source.postMessage({ type: 'NEW_VERSION_INSTALLED' });
        } else if (self.registration.installing) {
            // 新しいバージョンが現在インストール中であれば、インストールの完了を待機
            const worker = self.registration.installing;
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') {
                    event.source.postMessage({ type: 'NEW_VERSION_INSTALLED' });
                }
            });
        } else {
            // 更新がない場合、あるいはまだ新しいバージョンが準備されていない場合は NO_UPDATE_FOUND を送信
            event.source.postMessage({ type: 'NO_UPDATE_FOUND' });
        }
    }
    if (event.data.action === 'getVersion') {
        event.ports[0].postMessage({ version: VERSION });
    }
});

const urlsToCache = [
  "/README.md",
  "/LICENSE",
  "/index.html",
  "/currencies/index.html",
  "/what-are-zaps/index.html",
  "/assets/css/common.css",
  "/assets/css/main.css",
  "/assets/css/currencies.css",
  "/assets/css/what-are-zaps.css",
  "/main.js",
  "/manifest.json",
  "/assets/js/currencyManager.js",
  "/assets/js/currencies.js",
  "/assets/js/lightning-address.js",
  "/assets/js/pos.js",
  "/assets/data/currencies.json",
  "/assets/vanilla-i18n/日本語.json",
  "/assets/vanilla-i18n/English.json",
  "/lib/qr-code-styling@1.6.0-rc.1.js",
  "/lib/sortable@1.15.2.js",
  "/lib/vanilla-i18n.min.js",
  "/assets/fonts/RoundedMplus1c-Regular.woff2",
  "/assets/fonts/RoundedMplus1c-Medium.woff2",
  "/assets/fonts/RoundedMplus1c-Bold.woff2",
  "/assets/favicons/favicon.ico",
  "/assets/images/icon.svg",
  "/assets/images/icon_x192.png",
  "/assets/images/icon_x512.png",
  "/assets/images/maskable_icon_x192.png",
  "/assets/images/maskable_icon_x512.png",
  "/assets/images/square-x-twitter.svg",
  "/assets/images/nostr-icon-purple-on-white.svg",
  "/assets/images/cloud-solid.svg",
  "/assets/images/share-nodes-solid.svg",
  "/assets/images/clipboard-solid.svg",
  "/assets/images/bitcoin-zukan.webp",
  "/assets/images/fulgur-favicon.webp",
  "/assets/images/alby_icon_head_yellow_48x48.svg",
  "/assets/images/btcmap-logo.svg",
  "/assets/images/robosats-favicon.webp",
  "/assets/images/mempool-favicon.webp",
  "/assets/images/bolt-solid.svg",
  "/assets/images/sun-regular.svg",
  "/assets/images/moon-regular.svg",
  "/assets/images/angle-down-solid.svg",
  "/assets/images/settings-solid.svg",
  "/assets/images/bitcoin-icon.svg",
  "/assets/images/drag_indicator_16dp_000000_FILL0_wght400_GRAD0_opsz20.svg",
  "/assets/images/caret-up-solid.svg",
  "/assets/images/caret-down-solid.svg",
  "/assets/images/trash-solid.svg",
  "/assets/images/list-ol-solid.svg",
  "/assets/images/arrow-up-right-from-square-solid.svg",
  "/assets/images/cryptocurrency-icons/btc.svg",
  "/assets/images/cryptocurrency-icons/btc-s.svg",
  "/assets/images/cryptocurrency-icons/eth.svg",
  "/assets/images/cryptocurrency-icons/ltc.svg",
  "/assets/images/cryptocurrency-icons/bch.svg",
  "/assets/images/cryptocurrency-icons/bnb.svg",
  "/assets/images/cryptocurrency-icons/eos.svg",
  "/assets/images/cryptocurrency-icons/xrp.svg",
  "/assets/images/cryptocurrency-icons/xlm.svg",
  "/assets/images/cryptocurrency-icons/link.svg",
  "/assets/images/cryptocurrency-icons/dot.svg",
  "/assets/images/cryptocurrency-icons/yfi.svg",
  "/assets/images/flags/emoji_u1f1fa_1f1f8.svg",
  "/assets/images/flags/emoji_u1f1e6_1f1ea.svg",
  "/assets/images/flags/emoji_u1f1e6_1f1f7.svg",
  "/assets/images/flags/emoji_u1f1e6_1f1fa.svg",
  "/assets/images/flags/emoji_u1f1e7_1f1e9.svg",
  "/assets/images/flags/emoji_u1f1e7_1f1ed.svg",
  "/assets/images/flags/emoji_u1f1e7_1f1f2.svg",
  "/assets/images/flags/emoji_u1f1e7_1f1f7.svg",
  "/assets/images/flags/emoji_u1f1e8_1f1e6.svg",
  "/assets/images/flags/emoji_u1f1e8_1f1ed.svg",
  "/assets/images/flags/emoji_u1f1e8_1f1f1.svg",
  "/assets/images/flags/emoji_u1f1e8_1f1f3.svg",
  "/assets/images/flags/emoji_u1f1e8_1f1ff.svg",
  "/assets/images/flags/emoji_u1f1e9_1f1f0.svg",
  "/assets/images/flags/emoji_u1f1ea_1f1fa.svg",
  "/assets/images/flags/emoji_u1f1ec_1f1e7.svg",
  "/assets/images/flags/emoji_u1f1ec_1f1ea.svg",
  "/assets/images/flags/emoji_u1f1ed_1f1f0.svg",
  "/assets/images/flags/emoji_u1f1ed_1f1fa.svg",
  "/assets/images/flags/emoji_u1f1ee_1f1e9.svg",
  "/assets/images/flags/emoji_u1f1ee_1f1f1.svg",
  "/assets/images/flags/emoji_u1f1ee_1f1f3.svg",
  "/assets/images/flags/emoji_u1f1ef_1f1f5.svg",
  "/assets/images/flags/emoji_u1f1f0_1f1f7.svg",
  "/assets/images/flags/emoji_u1f1f0_1f1fc.svg",
  "/assets/images/flags/emoji_u1f1f1_1f1f0.svg",
  "/assets/images/flags/emoji_u1f1f2_1f1f2.svg",
  "/assets/images/flags/emoji_u1f1f2_1f1fd.svg",
  "/assets/images/flags/emoji_u1f1f2_1f1fe.svg",
  "/assets/images/flags/emoji_u1f1f3_1f1ec.svg",
  "/assets/images/flags/emoji_u1f1f3_1f1f4.svg",
  "/assets/images/flags/emoji_u1f1f3_1f1ff.svg",
  "/assets/images/flags/emoji_u1f1f5_1f1ed.svg",
  "/assets/images/flags/emoji_u1f1f5_1f1f0.svg",
  "/assets/images/flags/emoji_u1f1f5_1f1f1.svg",
  "/assets/images/flags/emoji_u1f1f7_1f1fa.svg",
  "/assets/images/flags/emoji_u1f1f8_1f1e6.svg",
  "/assets/images/flags/emoji_u1f1f8_1f1ea.svg",
  "/assets/images/flags/emoji_u1f1f8_1f1ec.svg",
  "/assets/images/flags/emoji_u1f1f9_1f1ed.svg",
  "/assets/images/flags/emoji_u1f1f9_1f1f7.svg",
  "/assets/images/flags/emoji_u1f1f9_1f1fc.svg",
  "/assets/images/flags/emoji_u1f1fa_1f1e6.svg",
  "/assets/images/flags/emoji_u1f1fb_1f1ea.svg",
  "/assets/images/flags/emoji_u1f1fb_1f1f3.svg",
  "/assets/images/flags/emoji_u1f1ff_1f1e6.svg",
  "/assets/images/silver-icon.png",
  "/assets/images/gold-icon.png",
];

const VERSION = "2.19.1";
let CACHE_NAME = "osats-caches-" + VERSION;
const MY_CACHES = new Set([CACHE_NAME]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urlsToCache);

      // 新しいバージョンがインストールされたことをクライアントに通知
      self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "NEW_VERSION_INSTALLED" }));
      });

      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !MY_CACHES.has(key)).map((key) => caches.delete(key)));
      return self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !MY_CACHES.has(key)).map((key) => caches.delete(key)));
      return self.clients.claim();
    })()
  );
});

self.addEventListener(
  "fetch",
  (ev) =>
    void ev.respondWith(
      (async () => {
        const url = new URL(ev.request.url);
        if (url.origin === location.origin) {
          url.search = "";
        }

        let requestToFetch = ev.request;

        if (ev.request.mode === "navigate") {
          requestToFetch = new Request(ev.request, {
            mode: "cors",
          });
        }

        const cacheResponse = await caches.match(url.toString());

        return cacheResponse || fetch(requestToFetch);
      })()
    )
);

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
  if (event.data === "CHECK_UPDATE_STATUS") {
    if (self.registration.waiting) {
      // 新しいバージョンがインストールされ、待機中であれば NEW_VERSION_INSTALLED を送信
      event.source.postMessage({ type: "NEW_VERSION_INSTALLED" });
    } else if (self.registration.installing) {
      // 新しいバージョンが現在インストール中であれば、インストールの完了を待機
      const worker = self.registration.installing;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          event.source.postMessage({ type: "NEW_VERSION_INSTALLED" });
        }
      });
    } else {
      // 更新がない場合、あるいはまだ新しいバージョンが準備されていない場合は NO_UPDATE_FOUND を送信
      event.source.postMessage({ type: "NO_UPDATE_FOUND" });
    }
  }
  if (event.data.action === "getVersion") {
    event.ports[0].postMessage({ version: VERSION });
  }
});

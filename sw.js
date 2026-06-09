importScripts("/assets/generated/sw-manifest.js");

const RELEASE_MANIFEST = self.__OSATS_SW_MANIFEST;
const VERSION = RELEASE_MANIFEST.version;
const CACHE_NAME = `osats-release-${VERSION}`;
const LOCAL_ASSETS = new Set(RELEASE_MANIFEST.assets);
const NAVIGATION_ROUTES = new Map([
  ["/", "/index.html"],
  ["/index.html", "/index.html"],
  ["/currencies", "/currencies/index.html"],
  ["/currencies/", "/currencies/index.html"],
  ["/currencies/index.html", "/currencies/index.html"],
  ["/what-are-zaps", "/what-are-zaps/index.html"],
  ["/what-are-zaps/", "/what-are-zaps/index.html"],
  ["/what-are-zaps/index.html", "/what-are-zaps/index.html"],
]);

function getNavigationAsset(pathname) {
  return NAVIGATION_ROUTES.get(pathname) || null;
}

function isLocalAsset(pathname) {
  return LOCAL_ASSETS.has(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(RELEASE_MANIFEST.assets);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
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
        if (url.origin !== location.origin) {
          return fetch(ev.request);
        }

        const cache = await caches.open(CACHE_NAME);
        const cacheKey =
          ev.request.mode === "navigate" ? getNavigationAsset(url.pathname) : isLocalAsset(url.pathname) ? url.pathname : null;

        if (!cacheKey) {
          return fetch(ev.request);
        }

        const cacheResponse = await cache.match(cacheKey);
        if (cacheResponse) {
          return cacheResponse;
        }

        return fetch(ev.request);
      })()
    )
);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: VERSION });
  }
});

importScripts("/assets/generated/sw-manifest.js");

const RELEASE_MANIFEST = self.__OSATS_SW_MANIFEST;
const SITE_VERSION = RELEASE_MANIFEST.version;
const RELEASE_REVISION = RELEASE_MANIFEST.revision || SITE_VERSION;
const CACHE_NAME = `osats-release-${SITE_VERSION}`;
const STAGING_CACHE_NAME = `osats-release-staging-${RELEASE_REVISION}`;
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

function isManagedCacheName(cacheName) {
  return cacheName.startsWith("osats-caches-") || cacheName.startsWith("osats-release-");
}

async function populateStagingCache() {
  const cache = await caches.open(STAGING_CACHE_NAME);
  await cache.addAll(RELEASE_MANIFEST.assets);
}

async function promoteStagingCache() {
  const stagingCache = await caches.open(STAGING_CACHE_NAME);
  const requests = await stagingCache.keys();

  await caches.delete(CACHE_NAME);

  const activeCache = await caches.open(CACHE_NAME);
  await Promise.all(
    requests.map(async (request) => {
      const response = await stagingCache.match(request);
      if (response) {
        await activeCache.put(request, response);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await populateStagingCache();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await promoteStagingCache();
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => isManagedCacheName(key) && key !== CACHE_NAME).map((key) => caches.delete(key)));
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
    event.ports[0].postMessage({ version: SITE_VERSION });
  }
});

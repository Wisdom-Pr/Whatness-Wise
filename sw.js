// WiseDiction service worker.
//
// Strategy matters here: the PAGE itself is network-first, so a freshly
// uploaded index.html always wins over the cached copy (the old cache-first
// version made updates invisible until the cache was manually cleared).
// The cached copy is kept purely as an offline fallback.

const CACHE_NAME = "wisedefine-v8";
const CORE_ASSETS = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never touch API calls

  const isPage =
    event.request.mode === "navigate" || event.request.destination === "document";

  if (isPage) {
    // NETWORK FIRST: always try to get the newest page.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() =>
          caches
            .match("./index.html")
            .then((cached) => cached || caches.match("./"))
        )
    );
    return;
  }

  // Everything else (fonts, scripts): cache first is fine, they rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});

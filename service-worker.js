const CACHE_NAME = "holocron-archive-v3";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isImage(url) {
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isImage(url)) {
    // Images rarely change: serve from cache, refresh quietly in the background.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Page, app code, data and manifest: always try the network first so updates arrive
  // immediately, and fall back to the saved copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});

/* CONFIG is injected at build time by scripts/cache.mjs. */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CONFIG.cache)
      .then((cache) => cache.addAll(CONFIG.assets))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CONFIG.prefix) && key !== CONFIG.cache)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(CONFIG.base)
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CONFIG.cache);
    // Hashed Vite assets are immutable. Serve their precached response
    // immediately, so an offline reload never races a failed network fetch.
    if (url.pathname.startsWith(CONFIG.base + "assets/")) {
      const cachedAsset = await cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
      if (cachedAsset) return cachedAsset;
    }
    // Navigations remain network-first to allow fresh app shell updates.
    // A network failure may reject or return a non-OK response.
    try {
      const response = await fetch(request);
      if (response.ok) return response;
    } catch {
      // Offline: serve the last fully cached app shell below.
    }

    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === "navigate"
        ? (await cache.match(CONFIG.base + "index.html"))
        : undefined) ||
      Response.error()
    );
  })());
});

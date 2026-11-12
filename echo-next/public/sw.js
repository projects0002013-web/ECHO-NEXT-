/* CONFIG is injected by scripts/cache.mjs into the production worker. */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CONFIG.cache)
      .then((cache) => cache.addAll(CONFIG.assets))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CONFIG.prefix) && k !== CONFIG.cache)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(CONFIG.base)
  )
    return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CONFIG.cache);
      return (
        (await cache.match(request)) ||
        (request.mode === "navigate"
          ? await cache.match(CONFIG.base + "index.html")
          : null) ||
        Response.error()
      );
    }),
  );
});

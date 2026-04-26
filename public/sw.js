// Bump this version whenever you deploy a new build so stale caches are purged.
const CACHE_NAME = "dash-barros-e-sa-v2";

// Only truly static, versioned assets should be pre-cached.
// Never include HTML pages here — they are server-rendered and auth-aware.
const STATIC_ASSETS = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
      .then(() =>
        // After purging stale caches, tell every open window to reload so it
        // immediately runs under the new SW instead of the old one.
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) =>
            clients.forEach((client) =>
              client.postMessage({ type: "SW_UPDATED" })
            )
          )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API routes and Next.js internals — let them go straight to the network.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    return;
  }

  // HTML document requests (navigations) use network-first so that
  // auth redirects and fresh server responses are always respected.
  // Fall back to cache only when the network is unavailable.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (images, fonts, etc.) use cache-first for performance.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseClone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    })
  );
});

const CACHE_NAME = "vybe-shell-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/css/style.css?v=2",
  "/js/app.js?v=3",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL)
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API or realtime Socket.IO traffic.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (
          response.ok &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(() =>
        caches.match(request).then(
          cached => cached || caches.match("/index.html")
        )
      )
  );
});

/* InstaYa! service worker: la interfaz abre aunque no haya señal; los datos (/api) nunca se guardan en caché. */
const CACHE = "instaya-v1";
const PRECARGA = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  // Navegación: primero la red (para tener siempre la última versión); sin red, la app guardada
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copia));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Archivos de la app (JS/CSS con hash, íconos): caché primero, y se guarda lo nuevo
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
    )
  );
});

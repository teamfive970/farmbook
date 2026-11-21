// Bumped so phones drop any shell cached by the older worker.
const CACHE = "minders-shell-v4";
const CORE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/audio/manifest.json"
];

// Vite fingerprints the JS/CSS bundles, so read their names from index.html at install.
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  const response = await fetch("/index.html", { cache: "no-store" });
  const html = await response.text();
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    assets.add(match[1]);
  }
  if (assets.size > 0) await cache.addAll([...assets]);
}

async function offlineShell() {
  return (await caches.match("/index.html")) || (await caches.match("/"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("minders-") && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages: try the network, fall back to the saved app shell. Only a good,
  // same-origin page replaces the saved shell, so a server error page or a
  // captive Wi-Fi login page can never stop the app from opening offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const type = response.headers.get("content-type") || "";
          if (response.ok && response.type === "basic" && type.includes("text/html")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
            return response;
          }
          const shell = await offlineShell();
          return shell || response;
        })
        .catch(async () => (await offlineShell()) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // 200 only: partial (206) audio responses cannot be stored. Voice
          // clips are saved after they first play, so they work offline.
          if (response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

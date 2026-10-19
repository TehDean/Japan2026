// Japan December Plan: keeps the site working offline.
// The page itself: try the network first (so updates show up), fall back to the saved copy.
// Map pieces, fonts and the map library: use the saved copy, fetch and save it the first time.
// Suggestions (Supabase) always go to the network and are never saved.
const VERSION = "jp26-v1";
const SHELL = "shell-" + VERSION;
const ASSETS = "assets-" + VERSION;
const TILES = "tiles-" + VERSION;
const MAX_TILES = 1500;   // about 30-40 MB of map at most

const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  // Save each file on its own, so one that fails (a slow CDN, say) can't stop the others.
  e.waitUntil(caches.open(SHELL)
    .then(c => Promise.allSettled(SHELL_FILES.map(f => c.add(new Request(f, { mode: f.startsWith("http") ? "cors" : "same-origin" })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => ![SHELL, ASSETS, TILES].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimTiles() {
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, isTile) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { cache.put(req, res.clone()); if (isTile) trimTiles(); }
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || (await cache.match("./index.html")) || Response.error();
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;                       // suggestions: always live
  if (req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(networkFirst(req)); return;
  }
  if (url.hostname === "server.arcgisonline.com" || url.hostname === "tile.openstreetmap.org") {
    e.respondWith(cacheFirst(req, TILES, true)); return;
  }
  if (url.hostname === "cdnjs.cloudflare.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.origin === location.origin) {
    e.respondWith(cacheFirst(req, url.origin === location.origin ? SHELL : ASSETS, false));
  }
});

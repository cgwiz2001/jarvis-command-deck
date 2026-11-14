// Jarvis Command Deck service worker. Cache name is versioned with the app.
const VERSION = "2.6.9";
const CACHE = "jcd-" + VERSION;
const PRECACHE = [
  "./",
  "index.html",
  "style.css?v=268",
  "lock.js?v=268",
  "app.js?v=268",
  "config.js?v=268",
  "scene.js?v=268",
  "avatars.js?v=268",
  "readout.js?v=268",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-512-maskable.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("jcd-") && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isApi(url) {
  const u = url.href;
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(u)) return false;
  return /api\.x\.ai|second-brain|secondbrain|generativelanguage\.googleapis|firestore\.googleapis|firebaseio\.com|identitytoolkit|securetoken\.googleapis|webhook|cursor\.sh\/automations|cloudfunctions\.net/i.test(u);
}

function isCacheFirst(url) {
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url.href)) return true;
  if (url.origin === self.location.origin && /\.(png|webp|svg|ico|woff2?)$/i.test(url.pathname)) return true;
  if (url.origin === self.location.origin && /manifest\.webmanifest$/i.test(url.pathname)) return true;
  return false;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // Revalidate with the server so a new release never waits on the browser's HTTP cache.
    const same = new URL(req.url).origin === self.location.origin;
    const res = await fetch(same && req.mode !== "navigate" ? new Request(req, { cache: "no-cache" }) : req, same && req.mode === "navigate" ? { cache: "no-cache" } : undefined);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) || await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      const idx = await cache.match("./") || await cache.match("index.html") || await cache.match("./index.html");
      if (idx) return idx;
    }
    throw err;
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return;
  if (isCacheFirst(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin === self.location.origin || /cdn\.jsdelivr\.net/i.test(url.hostname)) {
    event.respondWith(networkFirst(req));
  }
});

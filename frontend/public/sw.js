// Simpleng service worker: para mabuksan ang app (at ang editor ng weekly report) kahit walang internet.
// Network-first para laging bago ang app kapag may net; cache lang ang gagamitin kapag offline.
const CACHE = "practicum-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isCollegeLogo = /^\/api\/public\/colleges\/\d+\/logo$/.test(url.pathname);
  if (url.origin !== self.location.origin || (url.pathname.startsWith("/api/") && !isCollegeLogo)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "/" : req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req.mode === "navigate" ? "/" : req);
        return cached || Response.error();
      }),
  );
});

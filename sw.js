/* The Fun Vault — service worker.
   Pages: get the newest version from the server, but if that takes more than 4 seconds (a slow connection),
   open the saved copy right away and keep downloading the new one for next time. A download that gets cut off
   is never saved or shown. With no connection at all, the saved copy opens.
   Icons and other files: saved copy first. */
const CACHE = 'fun-vault-v6';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-180.png'];
const WAIT = 4000;
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function freshPage(url) {   // the whole new page (or a failure), saved for next time
  return fetch(url, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) return res;
    return res.blob().then((body) => {
      const page = () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return caches.open(CACHE).then((c) => c.put('index.html', page())).then(page, page);
    });
  });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    const net = freshPage(req.url);
    e.waitUntil(net.catch(() => {}));
    e.respondWith(new Promise((resolve) => {
      let done = false;
      const give = (r) => { if (!done && r) { done = true; resolve(r); } };
      const timer = setTimeout(() => { caches.match('index.html').then(give); }, WAIT);
      net.then((res) => { clearTimeout(timer); if (res.ok) give(res); else caches.match('index.html').then((hit) => give(hit || res)); },
        () => { clearTimeout(timer); caches.match('index.html').then((hit) => give(hit || Response.error())); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

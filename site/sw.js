/* InvoiceIguana service worker — makes the app installable and fully offline.
 *
 * The whole product is static + client-side (documents live in the URL
 * fragment), so precaching the app shell is enough: once cached, every
 * generator and the viewer work with no connection. Strategy is
 * stale-while-revalidate for same-origin GETs (instant from cache, refreshed
 * in the background); cross-origin requests (analytics beacon, remote logos)
 * are left to the network so they fail gracefully offline.
 *
 * Bump CACHE on each deploy to invalidate the old shell. */

const CACHE = 'invoiceiguana-v1';

// Both clean and .html forms are listed because production serves both and we
// don't know which a given navigation used. Missing entries (files added later)
// are tolerated via allSettled, so this list can run ahead of the files.
const PRECACHE = [
  '/', '/index.html',
  '/free-invoice-generator', '/free-invoice-generator.html',
  '/free-quote-generator', '/free-quote-generator.html',
  '/receipt', '/receipt.html',
  '/quote', '/quote.html',
  '/privacy', '/privacy.html',
  '/r', '/r.html',
  '/404.html',
  '/theme.css', '/generator.css', '/viewer.css',
  '/generator.js', '/receipt.js', '/quote.js', '/viewer.js',
  '/register-sw.js', '/ads.js',
  '/manifest.webmanifest',
  '/og-image.png',
  '/shared/codec.js', '/shared/currencies.js', '/shared/db.js', '/shared/durable-link.js',
  '/shared/export-png.js', '/shared/invoice-codec.js', '/shared/invoice-parse.js',
  '/shared/invoice-render.js', '/shared/invoice-templates.js', '/shared/line-math.js',
  '/shared/logo-embed.js', '/shared/parse.js', '/shared/qr.js', '/shared/qrcodegen.js',
  '/shared/render.js', '/shared/share-links.js', '/shared/style.js', '/shared/templates.js',
  '/shared/wire.js', '/shared/quote-codec.js', '/shared/quote-parse.js', '/shared/quote-render.js',
  '/shared/invoice.css', '/shared/receipt.css', '/shared/templates.css',
  '/icons/icon16.png', '/icons/icon48.png', '/icons/icon128.png',
  '/icons/icon192.png', '/icons/icon512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Per-URL so one missing asset can't abort the whole precache.
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin to the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const networked = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { networked.catch(() => {}); return cached; } // stale-while-revalidate
    const res = await networked;
    if (res) return res;
    // Offline and never cached: fall back to the app shell for navigations.
    if (req.mode === 'navigate') {
      return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
    }
    return Response.error();
  })());
});

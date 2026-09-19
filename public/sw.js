/* Only the public shell and static assets are cached. Never cache /api or requests with mutations. */
const CACHE = 'mengsign-shell-v1';
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Cache the initial JS/CSS too: the first page load precedes worker control.
    const html = await (await cache.match('/')).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"<>]+)"/g)]
      .map(match => new URL(match[1].replaceAll('&amp;', '&'), self.location.origin))
      .filter(url => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'))
      .map(url => url.href);
    await cache.addAll([...new Set(assets)]);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mengsign-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || req.headers.has('RSC') || url.search) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok && url.pathname === '/') { const clone = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/', clone))); }
      return response;
    }).catch(() => caches.match('/').then(response => response || Response.error())));
  } else if (url.pathname.startsWith('/_next/static/') || SHELL.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
      if (response.ok) { const clone = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, clone))); }
      return response;
    })));
  }
});

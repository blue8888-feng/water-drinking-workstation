const CACHE = 'wb-cache-v2';
const CORE = [
  './',
  './creator-workbench.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShell = url.pathname.endsWith('creator-workbench.html') ||
                  url.pathname.endsWith('manifest.json') ||
                  url.pathname === '/' ||
                  url.pathname.endsWith('/');

  if (isShell) {
    // 联网时优先拉最新 HTML/manifest，离线回退缓存，保证更新及时
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('./creator-workbench.html')
          )
        )
    );
  } else {
    // 图标/CDN 资源用缓存优先，加速并支持离线
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached || caches.match('./creator-workbench.html'));
      })
    );
  }
});

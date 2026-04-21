const CACHE = 'izik-driver-1776735780';
const ASSETS = ['/driver-app.html', '/manifest-driver.json', '/icon-driver.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('firebase') ||
     e.request.url.includes('googleapis') ||
     e.request.url.includes('gstatic')) return;

  // Always network first for HTML — guarantees latest version
  if(e.request.url.endsWith('.html') || e.request.url.includes('driver-app')) {
    e.respondWith(
      fetch(e.request, {cache: 'no-store'}).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first for icons/manifests
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if(res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});

// Tell all open tabs to reload when new SW activates
self.addEventListener('activate', () => {
  self.clients.matchAll({type: 'window'}).then(clients => {
    clients.forEach(client => client.postMessage({type: 'SW_UPDATED'}));
  });
});

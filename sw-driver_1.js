const CACHE = 'izik-driver-v2';
const ASSETS = ['/driver-app.html', '/manifest-driver.json'];

self.addEventListener('install', e => {
  self.skipWaiting(); // activate new SW immediately
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim(); // take control immediately
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // Never cache Firebase, Google APIs
  if(e.request.url.includes('firebase') || 
     e.request.url.includes('googleapis') || 
     e.request.url.includes('gstatic')) return;
  
  // Network first for HTML files — always get latest version
  if(e.request.url.endsWith('.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Cache first for other assets (icons, manifests)
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if(res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

const CACHE_NAME = 'hive-app-v4';

self.addEventListener('install', event => {
  // Activate the new worker immediately, don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network-first: always try to get the freshest version,
  // only fall back to cache if completely offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Optionally cache successful responses for offline fallback
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

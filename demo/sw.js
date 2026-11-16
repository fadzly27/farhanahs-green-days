/* Farhanah's Green Days — service worker
   Bump CACHE (fgd-v1 → fgd-v2 …) whenever you change any file. */
var CACHE = 'fgddemo-v6';
var ASSETS = [
  './',
  'index.html',
  'guide.html',
  'style.css',
  'foods.js',
  'app.js',
  'manifest.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    // cache: 'reload' skips the browser's HTTP cache (GitHub Pages caches files for 10 min),
    // so a new version never gets filled with old files.
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('fgddemo-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Stale-while-revalidate: answer from cache instantly, refresh the cache in the background.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        // revalidate against the server, not the HTTP cache
        var network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        }).catch(function () {
          if (req.mode === 'navigate') return cache.match('index.html');
          return cached;
        });
        if (cached) { event.waitUntil(network.catch(function () { })); return cached; }
        return network;
      });
    })
  );
});

// Tapping a reminder notification opens (or focuses) the app.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
      return self.clients.openWindow('./');
    })
  );
});

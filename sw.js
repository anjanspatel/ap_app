/* AP WORKSPACE — Service Worker
   Caches design system assets + tool shells for offline use.
   Stale-while-revalidate for static assets, network-first for navigation.
*/
var CACHE = 'ap-v14';
var STATIC = [
  '/',
  '/tokens.css',
  '/premium.css',
  '/global-features.js',
  '/manifest.json',
  '/flange/',
  '/torque/',
  '/tubing/',
  '/dashboard.html',
  '/settings.html',
  '/terms/',
  '/privacy/',
  '/disclaimer/',
  '/404.html',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(STATIC.map(function(url) {
        return c.add(url).catch(function() {});
      }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  /* Skip non-GET and API calls — these must always hit the network, never
     the cache, or a cached /api/auth/session could show someone as signed
     in (or out, or as the wrong user) after their real session changed. */
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('googleapis.com') && !url.pathname.includes('/css2')) return;

  var isNav = e.request.mode === 'navigate';

  if (isNav) {
    /* Network-first for navigation, falling back to cache, then offline shell */
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/404.html');
        });
      })
    );
    return;
  }

  /* Stale-while-revalidate for static assets: serve from cache instantly
     when available, and refresh the cache in the background for next time. */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var network = fetch(e.request).then(function(res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() { return cached; });
      return cached || network;
    })
  );
});

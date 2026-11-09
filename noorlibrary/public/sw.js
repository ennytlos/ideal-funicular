const CACHE_NAME = 'noor-static-cache-v2';
const BOOKS_CACHE_NAME = 'noor-books-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/noor_logo.png',
];

// Install Event: Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== BOOKS_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-First falling back to Cache (same-origin GET only)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests (POST, PUT, DELETE, OPTIONS, etc.)
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept cross-origin requests (Firebase Auth, Firestore streams, Google OAuth, Bunny CDN, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. Handle JSON books read APIs with Network-First and dynamic offline caching
  if (url.pathname.startsWith('/api/read/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(BOOKS_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({ error: 'Service Unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 2. Bypass Service Worker for all other /api/ routes and auth routes so live data & sessions are never stale
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/auth/') ||
    url.pathname.includes('/auth/') ||
    url.search.includes('auth=')
  ) {
    return;
  }

  // 3. Handle static page / assets caching with Network-First strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response(
            'Service Unavailable',
            { status: 503, headers: { 'Content-Type': 'text/plain' } }
          );
        });
      })
  );
});

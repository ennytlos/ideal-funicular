const CACHE_NAME = 'noor-static-cache-v1';
const BOOKS_CACHE_NAME = 'noor-books-cache-v1';

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

// Fetch Event: Network-First falling back to Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Handle JSON books read APIs with Network-First and dynamic caching
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
            // Return 503 Service Unavailable if no cache and network fails
            return new Response(
              JSON.stringify({ error: 'Service Unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 2. Handle auth routes - bypass service worker, let browser handle them directly
  if (url.pathname.includes('/auth/') || url.search.includes('auth=')) {
    return;
  }

  // 3. Handle API calls - Network-First with proper error handling
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Always return the response, whether it's success or error
          return response;
        })
        .catch(() => {
          // If network fails, try to get cached response
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return 503 if no cache available
            return new Response(
              JSON.stringify({ error: 'Service Unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 4. Handle static page / assets caching with Network-First strategy
  if (request.method === 'GET') {
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
            // Return 503 for any failed resource
            return new Response(
              'Service Unavailable',
              { status: 503, headers: { 'Content-Type': 'text/plain' } }
            );
          });
        })
    );
    return;
  }

  // 5. For non-GET requests (POST, PUT, DELETE, etc.), always use network
  event.respondWith(
    fetch(request).catch(() => {
      return new Response(
        JSON.stringify({ error: 'Network error - request failed' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    })
  );
});

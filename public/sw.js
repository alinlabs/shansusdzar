const SHELL_CACHE_NAME = 'shansusdzar-shell-v4';
const MEDIA_CACHE_NAME = 'shansusdzar-media-v2';
const DATA_CACHE_NAME = 'shansusdzar-data-v7';
const HERO_VIDEO_CACHE_NAME = 'shansusdzar-hero-media-v2';

const VALID_CACHES = new Set([
  SHELL_CACHE_NAME,
  MEDIA_CACHE_NAME,
  DATA_CACHE_NAME,
  HERO_VIDEO_CACHE_NAME,
]);

const PRECACHE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-gelap.webp',
  '/logo-white.webp',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/apple-touch-icon.png',
  '/produk/produk.json',
];

function buildSignature(headers) {
  const etag = (headers.get('etag') || '').trim();
  const lastModified = (headers.get('last-modified') || '').trim();
  const contentLength = (headers.get('content-length') || '').trim();
  return `${etag}|${lastModified}|${contentLength}`;
}

function isValidImageOrAssetResponse(response) {
  if (!response || !response.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) return false;
  return true;
}

function isViteDevRequest(url) {
  return (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  );
}

function isImageRequest(request, url) {
  if (request.destination === 'image') return true;
  return /\.(webp|png|jpe?g|svg|gif|avif|ico)$/i.test(url.pathname);
}

function isImmutableBuiltAsset(url) {
  return url.pathname.startsWith('/assets/') && /\.(js|css|woff2?|ttf|mjs)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_SHELL_URLS.map((assetUrl) =>
            fetch(assetUrl, { cache: 'no-store' })
              .then((res) => {
                if (res && res.ok) {
                  const targetCacheName = isImageRequest({ destination: '' }, new URL(assetUrl, self.location.origin))
                    ? MEDIA_CACHE_NAME
                    : assetUrl.endsWith('.json')
                      ? DATA_CACHE_NAME
                      : SHELL_CACHE_NAME;
                  return caches.open(targetCacheName).then((targetCache) => targetCache.put(assetUrl, res));
                }
                return undefined;
              })
              .catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!VALID_CACHES.has(cacheName)) {
              return caches.delete(cacheName);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

const revalidatedInWorkerSession = new Set();

async function revalidateCachedImage(cache, cacheKey, cachedResponse) {
  if (revalidatedInWorkerSession.has(cacheKey)) return;
  revalidatedInWorkerSession.add(cacheKey);

  const cachedSignature = buildSignature(cachedResponse.headers);
  try {
    const headResponse = await fetch(cacheKey, { method: 'HEAD', cache: 'no-cache' }).catch(
      () => null
    );
    if (headResponse && isValidImageOrAssetResponse(headResponse)) {
      const headSignature = buildSignature(headResponse.headers);
      if (cachedSignature && headSignature && headSignature === cachedSignature) {
        return;
      }
    }

    const networkResponse = await fetch(cacheKey, { cache: 'no-cache' });
    if (!isValidImageOrAssetResponse(networkResponse)) return;

    const freshSignature = buildSignature(networkResponse.headers);
    if (!cachedSignature || !freshSignature || freshSignature !== cachedSignature) {
      await cache.delete(cacheKey);
      await cache.put(cacheKey, networkResponse.clone());
    }
  } catch {
    // Offline or network unreachable; retain existing cached image
  }
}

async function handleImageWithRevalidation(request, url) {
  const cacheKey = `${url.pathname}${url.search}`;
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse && isValidImageOrAssetResponse(cachedResponse)) {
    void revalidateCachedImage(cache, cacheKey, cachedResponse);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (isValidImageOrAssetResponse(networkResponse)) {
      revalidatedInWorkerSession.add(cacheKey);
      await cache.delete(cacheKey);
      await cache.put(cacheKey, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

async function handleCatalogDataRequest(request, url) {
  const cacheKey = `${url.pathname}${url.search}`;
  const cache = await caches.open(DATA_CACHE_NAME);

  try {
    const networkResponse = await fetch(request, { cache: 'no-cache' });
    if (networkResponse && networkResponse.ok) {
      await cache.delete(cacheKey);
      await cache.put(cacheKey, networkResponse.clone());
      return networkResponse;
    }
  } catch {
    // Fall back to cached catalog JSON when offline
  }

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);

  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse && networkResponse.ok) {
      await cache.put('/index.html', networkResponse.clone());
      return networkResponse;
    }
  } catch {
    // Offline fallback to cached SPA shell
  }

  const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
  if (cachedIndex) {
    return cachedIndex;
  }

  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isViteDevRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.pathname === '/produk/produk.json') {
    event.respondWith(handleCatalogDataRequest(request, url));
    return;
  }

  if (isImageRequest(request, url)) {
    event.respondWith(handleImageWithRevalidation(request, url));
    return;
  }

  if (isImmutableBuiltAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

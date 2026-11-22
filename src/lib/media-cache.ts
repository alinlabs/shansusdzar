import { useEffect, useState } from 'react';
import mediaPresetsData from '../data/aset-media-bawaan.json';
import { getDeviceCapabilities } from './device-capabilities';

export const MEDIA_CACHE_NAME = 'shansusdzar-media-v2';
export const MODEL_3D_CACHE_NAME = 'shansusdzar-3d-v1';

const REVALIDATE_STAMP_PREFIX = 'sdi-media-rev:';
const REVALIDATE_TTL_MS = 12 * 60 * 60 * 1000;

export const BRAND_LOGO_ASSETS = mediaPresetsData.asetLogoMerek as readonly string[];

export const CORE_BRAND_IMAGE_ASSETS = mediaPresetsData.asetGambarMerekUtama as readonly string[];

const PINNED_MEDIA_KEYS = new Set<string>(BRAND_LOGO_ASSETS);

export interface MemoryMediaEntry {
  objectUrl: string;
  signature: string;
}

const memoryMediaCache = new Map<string, MemoryMediaEntry>();
const pendingMediaLoads = new Map<string, Promise<string | null>>();
const pending3dLoads = new Map<string, Promise<Cached3dModelResult | null>>();
const sessionRevalidatedUrls = new Set<string>();
const subscribers = new Map<string, Set<(objectUrl: string) => void>>();
let hasWarmedBrandAssets = false;

interface QueuedTask {
  run: () => void;
}
let activeMediaFetches = 0;
const mediaFetchQueue: QueuedTask[] = [];

function enqueueMediaTask<T>(task: () => Promise<T>): Promise<T> {
  const maxConcurrency = getDeviceCapabilities().maxMediaConcurrency;

  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeMediaFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeMediaFetches = Math.max(0, activeMediaFetches - 1);
          const next = mediaFetchQueue.shift();
          if (next) next.run();
        });
    };

    if (activeMediaFetches < maxConcurrency) {
      start();
    } else {
      mediaFetchQueue.push({ run: start });
    }
  });
}

export function buildResponseSignature(headers: Headers): string {
  const etag = headers.get('etag')?.trim() ?? '';
  const lastModified = headers.get('last-modified')?.trim() ?? '';
  const contentLength = headers.get('content-length')?.trim() ?? '';
  return `${etag}|${lastModified}|${contentLength}`;
}

export function isValidCachedMediaResponse(response: Response): boolean {
  if (!response.ok) return false;
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    return false;
  }
  return true;
}

export function isMediaResponseChanged(
  cachedSignature: string,
  cachedSize: number,
  freshHeaders: Headers,
  freshBlobSize?: number
): boolean {
  const freshSignature = buildResponseSignature(freshHeaders);
  if (cachedSignature && freshSignature && cachedSignature !== freshSignature) {
    return true;
  }
  if (typeof freshBlobSize === 'number' && freshBlobSize > 0 && cachedSize > 0) {
    if (freshBlobSize !== cachedSize) {
      return true;
    }
  }
  const freshLenRaw = freshHeaders.get('content-length');
  if (freshLenRaw) {
    const freshLen = Number(freshLenRaw);
    if (Number.isFinite(freshLen) && freshLen > 0 && cachedSize > 0 && freshLen !== cachedSize) {
      return true;
    }
  }
  return false;
}

export function evictLruCacheEntries<T>(
  cacheMap: Map<string, T>,
  maxEntries: number,
  pinnedKeys: ReadonlySet<string> = PINNED_MEDIA_KEYS,
  onEvict?: (key: string, value: T) => void
): number {
  let evictedCount = 0;
  if (maxEntries <= 0 || cacheMap.size <= maxEntries) return evictedCount;

  for (const [key, value] of cacheMap.entries()) {
    if (cacheMap.size <= maxEntries) break;
    if (pinnedKeys.has(key)) continue;
    cacheMap.delete(key);
    onEvict?.(key, value);
    evictedCount += 1;
  }
  return evictedCount;
}

function revokeObjectUrlDelayed(objectUrl: string): void {
  if (typeof window === 'undefined' || !objectUrl.startsWith('blob:')) return;
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore already-revoked object URLs
    }
  }, 3000);
}

function notifySubscribers(url: string, objectUrl: string): void {
  const listeners = subscribers.get(url);
  if (!listeners) return;
  for (const listener of listeners) {
    listener(objectUrl);
  }
}

function setMemoryMediaEntry(url: string, objectUrl: string, signature: string): void {
  const previous = memoryMediaCache.get(url);
  if (previous) {
    // Refresh insertion order for LRU recency
    memoryMediaCache.delete(url);
  }
  memoryMediaCache.set(url, { objectUrl, signature });
  notifySubscribers(url, objectUrl);

  if (previous && previous.objectUrl !== objectUrl) {
    revokeObjectUrlDelayed(previous.objectUrl);
  }

  const maxEntries = getDeviceCapabilities().memoryCacheMaxEntries;
  evictLruCacheEntries(memoryMediaCache, maxEntries, PINNED_MEDIA_KEYS, (_key, entry) => {
    revokeObjectUrlDelayed(entry.objectUrl);
  });
}

function shouldSkipRevalidation(cacheKey: string): boolean {
  if (sessionRevalidatedUrls.has(cacheKey)) return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(`${REVALIDATE_STAMP_PREFIX}${cacheKey}`);
    if (!raw) return false;
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && Date.now() - timestamp < REVALIDATE_TTL_MS;
  } catch {
    return false;
  }
}

function markRevalidated(cacheKey: string): void {
  sessionRevalidatedUrls.add(cacheKey);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${REVALIDATE_STAMP_PREFIX}${cacheKey}`, String(Date.now()));
  } catch {
    // Ignore storage quota restrictions
  }
}

async function openCacheByName(name: string): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }
  try {
    return await window.caches.open(name);
  } catch {
    return null;
  }
}

export function normalizeCacheKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (typeof window === 'undefined') return trimmed;
  try {
    const resolved = new URL(trimmed, window.location.origin);
    if (resolved.origin === window.location.origin) {
      return `${resolved.pathname}${resolved.search}`;
    }
    return resolved.href;
  } catch {
    return trimmed;
  }
}

function isSameOriginUrl(cacheKey: string): boolean {
  return cacheKey.startsWith('/') && !cacheKey.startsWith('//');
}

function isServiceWorkerControllingSameOrigin(cacheKey: string): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!isSameOriginUrl(cacheKey)) return false;
  return 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
}

async function fetchAndStoreMedia(
  cacheKey: string,
  cache: Cache | null
): Promise<{ objectUrl: string; signature: string; blobSize: number } | null> {
  const response = await enqueueMediaTask(() => fetch(cacheKey, { cache: 'default' }));
  if (!isValidCachedMediaResponse(response)) {
    return null;
  }

  const blob = await response.clone().blob();
  if (blob.size === 0) {
    return null;
  }

  const signature = buildResponseSignature(response.headers);

  if (cache) {
    try {
      await cache.delete(cacheKey);
      const headers = new Headers(response.headers);
      if (!headers.get('content-type') && blob.type) {
        headers.set('content-type', blob.type);
      }
      if (!headers.get('content-length')) {
        headers.set('content-length', String(blob.size));
      }
      await cache.put(
        cacheKey,
        new Response(blob, {
          status: 200,
          headers,
        })
      );
    } catch {
      // Ignore quota / storage errors gracefully
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, signature, blobSize: blob.size };
}

async function revalidateMediaAgainstServer(
  cacheKey: string,
  cachedSignature: string,
  cachedSize: number,
  cache: Cache | null
): Promise<void> {
  if (shouldSkipRevalidation(cacheKey)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (getDeviceCapabilities().isConstrainedNetwork) return;

  markRevalidated(cacheKey);

  try {
    const headResponse = await fetch(cacheKey, { method: 'HEAD', cache: 'no-cache' }).catch(
      () => null
    );

    if (headResponse && headResponse.ok && isValidCachedMediaResponse(headResponse)) {
      const freshSignature = buildResponseSignature(headResponse.headers);
      const changed = isMediaResponseChanged(cachedSignature, cachedSize, headResponse.headers);

      if (!changed && (freshSignature || cachedSize > 0)) {
        return;
      }
    }

    const freshResponse = await enqueueMediaTask(() => fetch(cacheKey, { cache: 'no-cache' }));
    if (!isValidCachedMediaResponse(freshResponse)) {
      return;
    }

    const freshBlob = await freshResponse.clone().blob();
    if (freshBlob.size === 0) {
      return;
    }

    const changed = isMediaResponseChanged(
      cachedSignature,
      cachedSize,
      freshResponse.headers,
      freshBlob.size
    );

    if (!changed) {
      return;
    }

    if (cache) {
      try {
        await cache.delete(cacheKey);
        const headers = new Headers(freshResponse.headers);
        if (!headers.get('content-type') && freshBlob.type) {
          headers.set('content-type', freshBlob.type);
        }
        if (!headers.get('content-length')) {
          headers.set('content-length', String(freshBlob.size));
        }
        await cache.put(
          cacheKey,
          new Response(freshBlob, {
            status: 200,
            headers,
          })
        );
      } catch {
        // Ignore storage write errors
      }
    }

    const nextSignature = buildResponseSignature(freshResponse.headers);
    const nextObjectUrl = URL.createObjectURL(freshBlob);
    setMemoryMediaEntry(cacheKey, nextObjectUrl, nextSignature);
  } catch {
    // Offline or transient failure: keep serving cached media safely
  }
}

export function getCachedMediaObjectUrl(url?: string | null): string | null {
  if (!url) return null;
  const key = normalizeCacheKey(url);
  if (!key) return null;
  const entry = memoryMediaCache.get(key);
  if (!entry) return null;
  // Touch LRU recency on hit
  memoryMediaCache.delete(key);
  memoryMediaCache.set(key, entry);
  return entry.objectUrl;
}

export async function loadAndCacheMediaUrl(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const cacheKey = normalizeCacheKey(url);
  if (!cacheKey || cacheKey.startsWith('blob:') || cacheKey.startsWith('data:')) {
    return url;
  }

  const existingMemory = getCachedMediaObjectUrl(cacheKey);
  if (existingMemory) {
    const sig = memoryMediaCache.get(cacheKey)?.signature ?? '';
    if (!shouldSkipRevalidation(cacheKey)) {
      void openCacheByName(MEDIA_CACHE_NAME).then((cache) =>
        revalidateMediaAgainstServer(cacheKey, sig, 0, cache)
      );
    }
    return existingMemory;
  }

  const inFlight = pendingMediaLoads.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const task = (async () => {
    try {
      const cache = await openCacheByName(MEDIA_CACHE_NAME);

      if (cache) {
        const cachedMatch = await cache.match(cacheKey);
        if (cachedMatch && isValidCachedMediaResponse(cachedMatch)) {
          const cachedBlob = await cachedMatch.blob();
          if (cachedBlob.size > 0) {
            const cachedSignature = buildResponseSignature(cachedMatch.headers);
            const objectUrl = URL.createObjectURL(cachedBlob);
            setMemoryMediaEntry(cacheKey, objectUrl, cachedSignature);

            void revalidateMediaAgainstServer(
              cacheKey,
              cachedSignature,
              cachedBlob.size,
              cache
            );

            return objectUrl;
          }
          await cache.delete(cacheKey).catch(() => {});
        }
      }

      markRevalidated(cacheKey);
      const stored = await fetchAndStoreMedia(cacheKey, cache);
      if (!stored) return null;

      setMemoryMediaEntry(cacheKey, stored.objectUrl, stored.signature);
      return stored.objectUrl;
    } catch {
      return null;
    } finally {
      pendingMediaLoads.delete(cacheKey);
    }
  })();

  pendingMediaLoads.set(cacheKey, task);
  return task;
}

export interface Cached3dModelResult {
  objectUrl: string;
  fromCache: boolean;
  revoke: () => void;
}

export async function loadAndCache3dModelUrl(
  url: string,
  onProgress?: (pct: number | null) => void
): Promise<Cached3dModelResult | null> {
  if (typeof window === 'undefined') return null;
  const cacheKey = normalizeCacheKey(url);
  if (!cacheKey) return null;

  const existingTask = pending3dLoads.get(cacheKey);
  if (existingTask) {
    return existingTask;
  }

  const task = (async (): Promise<Cached3dModelResult | null> => {
    try {
      const cache = await openCacheByName(MODEL_3D_CACHE_NAME);

      if (cache) {
        const cachedMatch = await cache.match(cacheKey);
        if (cachedMatch && isValidCachedMediaResponse(cachedMatch)) {
          const cachedBlob = await cachedMatch.blob();
          if (cachedBlob.size > 0) {
            onProgress?.(100);
            const objectUrl = URL.createObjectURL(cachedBlob);
            return {
              objectUrl,
              fromCache: true,
              revoke: () => revokeObjectUrlDelayed(objectUrl),
            };
          }
          await cache.delete(cacheKey).catch(() => {});
        }
      }

      const response = await fetch(cacheKey, { cache: 'default' });
      if (!isValidCachedMediaResponse(response)) {
        return null;
      }

      const contentLengthHeader = Number(response.headers.get('content-length') ?? '0');
      const totalBytes =
        Number.isFinite(contentLengthHeader) && contentLengthHeader > 0
          ? contentLengthHeader
          : 0;

      let blob: Blob;

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let loadedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
            copy.set(value);
            chunks.push(copy);
            loadedBytes += value.byteLength;
            if (totalBytes > 0) {
              const pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
              onProgress?.(pct);
            }
          }
        }

        const mimeType = response.headers.get('content-type') || 'model/gltf-binary';
        blob = new Blob(chunks, { type: mimeType });
      } else {
        blob = await response.blob();
      }

      if (blob.size === 0) {
        return null;
      }

      onProgress?.(100);

      if (cache) {
        try {
          await cache.delete(cacheKey);
          const headers = new Headers(response.headers);
          if (!headers.get('content-type')) {
            headers.set('content-type', 'model/gltf-binary');
          }
          if (!headers.get('content-length')) {
            headers.set('content-length', String(blob.size));
          }
          await cache.put(cacheKey, new Response(blob, { status: 200, headers }));
        } catch {
          // Ignore CacheStorage quota errors
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      return {
        objectUrl,
        fromCache: false,
        revoke: () => revokeObjectUrlDelayed(objectUrl),
      };
    } catch {
      return null;
    } finally {
      pending3dLoads.delete(cacheKey);
    }
  })();

  pending3dLoads.set(cacheKey, task);
  return task;
}

export function warmBrandMediaCache(): void {
  if (typeof window === 'undefined' || hasWarmedBrandAssets) return;
  hasWarmedBrandAssets = true;

  const { isConstrainedNetwork } = getDeviceCapabilities();
  const assetsToWarm = isConstrainedNetwork ? BRAND_LOGO_ASSETS : CORE_BRAND_IMAGE_ASSETS;

  const warm = () => {
    for (const assetUrl of assetsToWarm) {
      void loadAndCacheMediaUrl(assetUrl);
    }
  };

  if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 1500 });
  } else {
    window.setTimeout(warm, 200);
  }
}

export function prefetchMediaUrls(urls: readonly string[]): void {
  if (typeof window === 'undefined' || urls.length === 0) return;
  if (getDeviceCapabilities().isConstrainedNetwork) return;

  for (const url of urls) {
    if (!url || !url.trim()) continue;
    void loadAndCacheMediaUrl(url);
  }
}

export interface UseCachedMediaOptions {
  enabled?: boolean;
}

export function useCachedMediaSrc(
  rawSrc?: string | null,
  options?: UseCachedMediaOptions
): string | null {
  const enabled = options?.enabled ?? true;
  const normalized =
    typeof rawSrc === 'string' && rawSrc.trim().length > 0 ? normalizeCacheKey(rawSrc) : null;

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!normalized || !enabled) return null;
    return getCachedMediaObjectUrl(normalized) ?? normalized;
  });

  useEffect(() => {
    if (!normalized || !enabled) {
      setResolvedSrc(null);
      return;
    }

    const immediateCached = getCachedMediaObjectUrl(normalized);
    if (immediateCached) {
      setResolvedSrc(immediateCached);
      return;
    }

    setResolvedSrc(normalized);

    // When the Service Worker controls same-origin requests, it handles CacheStorage + revalidation
    // natively without duplicating HTTP requests or swapping <img src> into a blob URL mid-paint.
    if (isServiceWorkerControllingSameOrigin(normalized) && !PINNED_MEDIA_KEYS.has(normalized)) {
      return;
    }

    let isActive = true;
    const listener = (nextObjectUrl: string) => {
      if (isActive) {
        setResolvedSrc(nextObjectUrl);
      }
    };

    let setForUrl = subscribers.get(normalized);
    if (!setForUrl) {
      setForUrl = new Set();
      subscribers.set(normalized, setForUrl);
    }
    setForUrl.add(listener);

    void loadAndCacheMediaUrl(normalized).then((cachedObjectUrl) => {
      if (isActive && cachedObjectUrl) {
        setResolvedSrc(cachedObjectUrl);
      }
    });

    return () => {
      isActive = false;
      const existingSet = subscribers.get(normalized);
      if (existingSet) {
        existingSet.delete(listener);
        if (existingSet.size === 0) {
          subscribers.delete(normalized);
        }
      }
    };
  }, [normalized, enabled]);

  return resolvedSrc;
}

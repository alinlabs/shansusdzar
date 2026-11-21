import { useEffect, useState } from 'react';
import mediaPresetsData from '../data/aset-media-bawaan.json';

export const MEDIA_CACHE_NAME = 'shansusdzar-media-v2';

export const BRAND_LOGO_ASSETS = mediaPresetsData.asetLogoMerek as readonly string[];

export const CORE_BRAND_IMAGE_ASSETS = mediaPresetsData.asetGambarMerekUtama as readonly string[];

interface MemoryMediaEntry {
  objectUrl: string;
  signature: string;
}

const memoryMediaCache = new Map<string, MemoryMediaEntry>();
const pendingMediaLoads = new Map<string, Promise<string | null>>();
const sessionRevalidatedUrls = new Set<string>();
const subscribers = new Map<string, Set<(objectUrl: string) => void>>();
let hasWarmedBrandAssets = false;

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

function notifySubscribers(url: string, objectUrl: string): void {
  const listeners = subscribers.get(url);
  if (!listeners) return;
  for (const listener of listeners) {
    listener(objectUrl);
  }
}

function setMemoryMediaEntry(url: string, objectUrl: string, signature: string): void {
  const previous = memoryMediaCache.get(url);
  memoryMediaCache.set(url, { objectUrl, signature });
  notifySubscribers(url, objectUrl);

  if (previous && previous.objectUrl !== objectUrl) {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(previous.objectUrl);
      } catch {
        // Ignore already-revoked object URLs
      }
    }, 3000);
  }
}

async function openMediaCache(): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }
  try {
    return await window.caches.open(MEDIA_CACHE_NAME);
  } catch {
    return null;
  }
}

function normalizeCacheKey(url: string): string {
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

async function fetchAndStoreMedia(
  cacheKey: string,
  cache: Cache | null
): Promise<{ objectUrl: string; signature: string; blobSize: number } | null> {
  const response = await fetch(cacheKey, { cache: 'no-cache' });
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
  if (sessionRevalidatedUrls.has(cacheKey)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  sessionRevalidatedUrls.add(cacheKey);

  try {
    // Check server headers first via HEAD; fall back to no-cache GET if HEAD is disallowed
    const headResponse = await fetch(cacheKey, { method: 'HEAD', cache: 'no-cache' }).catch(
      () => null
    );

    if (headResponse && headResponse.ok && isValidCachedMediaResponse(headResponse)) {
      const freshSignature = buildResponseSignature(headResponse.headers);
      const changed = isMediaResponseChanged(cachedSignature, cachedSize, headResponse.headers);

      if (!changed && freshSignature) {
        return;
      }
    }

    const freshResponse = await fetch(cacheKey, { cache: 'no-cache' });
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

    // Even if signature headers match, verify whether cachedSignature was empty
    if (!changed && cachedSignature) {
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

    if (changed) {
      const nextSignature = buildResponseSignature(freshResponse.headers);
      const nextObjectUrl = URL.createObjectURL(freshBlob);
      setMemoryMediaEntry(cacheKey, nextObjectUrl, nextSignature);
    }
  } catch {
    // Offline or transient failure: keep serving cached media safely
  }
}

export function getCachedMediaObjectUrl(url?: string | null): string | null {
  if (!url) return null;
  const key = normalizeCacheKey(url);
  if (!key) return null;
  return memoryMediaCache.get(key)?.objectUrl ?? null;
}

export async function loadAndCacheMediaUrl(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const cacheKey = normalizeCacheKey(url);
  if (!cacheKey || cacheKey.startsWith('blob:') || cacheKey.startsWith('data:')) {
    return url;
  }

  const existingMemory = memoryMediaCache.get(cacheKey);
  if (existingMemory) {
    if (!sessionRevalidatedUrls.has(cacheKey)) {
      void openMediaCache().then((cache) =>
        revalidateMediaAgainstServer(cacheKey, existingMemory.signature, 0, cache)
      );
    }
    return existingMemory.objectUrl;
  }

  const inFlight = pendingMediaLoads.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const task = (async () => {
    try {
      const cache = await openMediaCache();

      if (cache) {
        const cachedMatch = await cache.match(cacheKey);
        if (cachedMatch && isValidCachedMediaResponse(cachedMatch)) {
          const cachedBlob = await cachedMatch.blob();
          if (cachedBlob.size > 0) {
            const cachedSignature = buildResponseSignature(cachedMatch.headers);
            const objectUrl = URL.createObjectURL(cachedBlob);
            setMemoryMediaEntry(cacheKey, objectUrl, cachedSignature);

            // Revalidate quietly against server; replaces old cache automatically if changed
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

      sessionRevalidatedUrls.add(cacheKey);
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

export function warmBrandMediaCache(): void {
  if (typeof window === 'undefined' || hasWarmedBrandAssets) return;
  hasWarmedBrandAssets = true;

  const warm = () => {
    for (const assetUrl of CORE_BRAND_IMAGE_ASSETS) {
      void loadAndCacheMediaUrl(assetUrl);
    }
  };

  if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 1500 });
  } else {
    window.setTimeout(warm, 150);
  }
}

export function useCachedMediaSrc(rawSrc?: string | null): string | null {
  const normalized =
    typeof rawSrc === 'string' && rawSrc.trim().length > 0 ? normalizeCacheKey(rawSrc) : null;

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!normalized) return null;
    return getCachedMediaObjectUrl(normalized) ?? normalized;
  });

  useEffect(() => {
    if (!normalized) {
      setResolvedSrc(null);
      return;
    }

    const immediateCached = getCachedMediaObjectUrl(normalized);
    setResolvedSrc(immediateCached ?? normalized);

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
  }, [normalized]);

  return resolvedSrc;
}

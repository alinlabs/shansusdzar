export const VERSION_MANIFEST_PATH = '/version.json';
export const VERSION_CHECK_MIN_INTERVAL_MS = 30_000;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__.trim().length > 0
    ? __APP_BUILD_ID__.trim()
    : 'dev';

export interface RemoteVersionPayload {
  buildId: string;
  builtAt?: string;
}

export function parseVersionPayload(raw: unknown): RemoteVersionPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const buildId = typeof record.buildId === 'string' ? record.buildId.trim() : '';
  if (!buildId) {
    return null;
  }
  const builtAt =
    typeof record.builtAt === 'string' && record.builtAt.trim().length > 0
      ? record.builtAt.trim()
      : undefined;
  return builtAt ? { buildId, builtAt } : { buildId };
}

export function isNewerBuildAvailable(
  currentBuildId: string,
  remoteBuildId?: string | null
): boolean {
  const current = currentBuildId.trim();
  const remote = typeof remoteBuildId === 'string' ? remoteBuildId.trim() : '';
  if (!current || !remote) return false;
  if (current === 'dev' || remote === 'dev') return false;
  return current !== remote;
}

export function shouldCheckRemoteVersion(options: {
  currentBuildId: string;
  lastCheckedAt: number | null;
  now: number;
  minIntervalMs?: number;
  force?: boolean;
  isOnline?: boolean;
}): boolean {
  const {
    currentBuildId,
    lastCheckedAt,
    now,
    minIntervalMs = VERSION_CHECK_MIN_INTERVAL_MS,
    force = false,
    isOnline = true,
  } = options;

  if (!isOnline) return false;
  const normalizedBuildId = currentBuildId.trim();
  if (!normalizedBuildId || normalizedBuildId === 'dev') return false;
  if (force) return true;
  if (typeof lastCheckedAt === 'number' && Number.isFinite(lastCheckedAt)) {
    return now - lastCheckedAt >= minIntervalMs;
  }
  return true;
}

export async function clearShellAndMediaRevalidationCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('sdi-media-rev:')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage access errors
  }

  try {
    window.localStorage.removeItem('shansusdzar-hero-video-rev-at');
  } catch {
    // Ignore localStorage access errors
  }

  if ('caches' in window) {
    try {
      const cacheNames = await window.caches.keys();
      await Promise.allSettled(
        cacheNames
          .filter((name) => name.startsWith('shansusdzar-shell-'))
          .map((name) => window.caches.delete(name))
      );
    } catch {
      // Ignore CacheStorage errors
    }
  }
}

let inFlightVersionCheck: Promise<boolean> | null = null;
let lastVersionCheckAt: number | null = null;

export async function checkForNewBuildAndReload(options: {
  force?: boolean;
  currentBuildId?: string;
  onNewBuildDetected: (remoteBuildId: string) => void;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const currentBuildId = options.currentBuildId ?? APP_BUILD_ID;
  const now = Date.now();
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (
    !shouldCheckRemoteVersion({
      currentBuildId,
      lastCheckedAt: lastVersionCheckAt,
      now,
      force: options.force,
      isOnline,
    })
  ) {
    return false;
  }

  if (inFlightVersionCheck) {
    return inFlightVersionCheck;
  }

  lastVersionCheckAt = now;

  inFlightVersionCheck = (async () => {
    try {
      const response = await fetch(`${VERSION_MANIFEST_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'cache-control': 'no-cache',
        },
      });
      if (!response.ok) return false;

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        return false;
      }

      const json: unknown = await response.json();
      const parsed = parseVersionPayload(json);
      if (!parsed || !isNewerBuildAvailable(currentBuildId, parsed.buildId)) {
        return false;
      }

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update().catch(() => {});
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        } catch {
          // Ignore SW update issues
        }
      }

      await clearShellAndMediaRevalidationCaches();
      options.onNewBuildDetected(parsed.buildId);
      return true;
    } catch {
      return false;
    } finally {
      inFlightVersionCheck = null;
    }
  })();

  return inFlightVersionCheck;
}

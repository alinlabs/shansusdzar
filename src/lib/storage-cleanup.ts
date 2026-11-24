export const RELEASE_STATE_EPOCH_KEY = 'shansusdzar-state-epoch';
export const CURRENT_RELEASE_STATE_EPOCH = '2026-11-22-prod-8';

export interface StorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const APP_KEY_PREFIX = 'shansusdzar-';

function clearPrefixedKeys(storage: StorageLike, preserveKey?: string): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(APP_KEY_PREFIX) && key !== preserveKey) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

export function resetStaleAppStorageIfNeeded(
  local: StorageLike,
  session?: Pick<StorageLike, 'length' | 'key' | 'removeItem'> | null
): boolean {
  if (local.getItem(RELEASE_STATE_EPOCH_KEY) === CURRENT_RELEASE_STATE_EPOCH) {
    return false;
  }

  clearPrefixedKeys(local, RELEASE_STATE_EPOCH_KEY);
  local.setItem(RELEASE_STATE_EPOCH_KEY, CURRENT_RELEASE_STATE_EPOCH);

  if (session) {
    const sessionKeys: string[] = [];
    for (let i = 0; i < session.length; i += 1) {
      const key = session.key(i);
      if (key && key.startsWith(APP_KEY_PREFIX)) {
        sessionKeys.push(key);
      }
    }
    for (const key of sessionKeys) {
      session.removeItem(key);
    }
  }

  return true;
}

export function sweepLegacyClientState(): void {
  if (typeof window === 'undefined') return;
  try {
    const cleared = resetStaleAppStorageIfNeeded(window.localStorage, window.sessionStorage);
    if (cleared && 'caches' in window) {
      void window.caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith(APP_KEY_PREFIX))
              .map((k) => window.caches.delete(k))
          )
        )
        .catch(() => {});
    }
  } catch {
    // Ignore storage access failures in restricted browser modes
  }
}

sweepLegacyClientState();

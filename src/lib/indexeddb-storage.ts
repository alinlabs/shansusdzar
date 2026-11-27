import {
  RELEASE_STATE_EPOCH_KEY,
  consumeStaleStorageResetFlag,
} from './storage-cleanup';

export const INDEXED_DB_NAME = 'shansusdzar-local-cache';
export const INDEXED_DB_VERSION = 1;
export const INDEXED_DB_STORE_NAME = 'kv_store';
export const LOCAL_CACHE_BROADCAST_CHANNEL = 'shansusdzar-local-cache-sync';

const MIGRATE_KEY_PREFIX = 'shansusdzar-';

interface IndexedDbRecord {
  key: string;
  raw: string;
  updatedAt: number;
}

type CacheSyncMessage =
  | { type: 'set'; key: string; raw: string }
  | { type: 'remove'; key: string }
  | { type: 'clear' };

const memoryCache = new Map<string, string>();
const removedKeys = new Set<string>();
const keyListeners = new Map<string, Set<() => void>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let broadcastChannel: BroadcastChannel | null = null;
let windowListenersAttached = false;
let isBootHydrated = false;

function getIndexedDbFactory(): IDBFactory | null {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      return window.indexedDB;
    }
    if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis) {
      return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
    }
  } catch {
    // Ignore restricted context errors
  }
  return null;
}

function getLocalStorageSafely(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted storage access
  }
  return null;
}

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  const factory = getIndexedDbFactory();
  if (!factory) {
    return Promise.resolve(null);
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };

    try {
      const request = factory.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);

      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(INDEXED_DB_STORE_NAME)) {
            db.createObjectStore(INDEXED_DB_STORE_NAME, { keyPath: 'key' });
          }
        } catch {
          // Ignore upgrade issues
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        finish(db);
      };

      request.onerror = () => {
        dbPromise = null;
        finish(null);
      };

      request.onblocked = () => {
        dbPromise = null;
        finish(null);
      };
    } catch {
      dbPromise = null;
      finish(null);
    }
  });

  return dbPromise;
}

function enqueueIdbOperation(task: (store: IDBObjectStore) => void): void {
  writeChain = writeChain
    .then(async () => {
      const db = await openIndexedDb();
      if (!db) return;

      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(INDEXED_DB_STORE_NAME, 'readwrite');
          const store = tx.objectStore(INDEXED_DB_STORE_NAME);
          task(store);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    })
    .catch(() => {});
}

async function readAllIndexedDbRecords(): Promise<IndexedDbRecord[]> {
  const db = await openIndexedDb();
  if (!db) return [];

  return new Promise<IndexedDbRecord[]>((resolve) => {
    try {
      const tx = db.transaction(INDEXED_DB_STORE_NAME, 'readonly');
      const store = tx.objectStore(INDEXED_DB_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        resolve(
          rows.filter(
            (row): row is IndexedDbRecord =>
              typeof row === 'object' &&
              row !== null &&
              typeof (row as IndexedDbRecord).key === 'string' &&
              typeof (row as IndexedDbRecord).raw === 'string'
          )
        );
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function clearAllIndexedDbRecords(): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(INDEXED_DB_STORE_NAME, 'readwrite');
      tx.objectStore(INDEXED_DB_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function notifyKeyListeners(key: string): void {
  const set = keyListeners.get(key);
  if (!set) return;
  for (const listener of set) {
    try {
      listener();
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

function notifyAllListeners(): void {
  for (const key of keyListeners.keys()) {
    notifyKeyListeners(key);
  }
}

function ensureCrossTabSyncInitialized(): void {
  if (typeof window === 'undefined') return;

  if (!windowListenersAttached) {
    windowListenersAttached = true;
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      if (event.newValue === null) {
        memoryCache.delete(event.key);
        removedKeys.add(event.key);
      } else {
        memoryCache.set(event.key, event.newValue);
        removedKeys.delete(event.key);
      }
      notifyKeyListeners(event.key);
    });
  }

  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(LOCAL_CACHE_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event: MessageEvent<CacheSyncMessage>) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'set' && typeof msg.key === 'string' && typeof msg.raw === 'string') {
          memoryCache.set(msg.key, msg.raw);
          removedKeys.delete(msg.key);
          notifyKeyListeners(msg.key);
        } else if (msg.type === 'remove' && typeof msg.key === 'string') {
          memoryCache.delete(msg.key);
          removedKeys.add(msg.key);
          notifyKeyListeners(msg.key);
        } else if (msg.type === 'clear') {
          memoryCache.clear();
          removedKeys.clear();
          notifyAllListeners();
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }
}

function broadcastMessage(message: CacheSyncMessage): void {
  ensureCrossTabSyncInitialized();
  if (!broadcastChannel) return;
  try {
    broadcastChannel.postMessage(message);
  } catch {
    // Ignore broadcast failures
  }
}

export function isLocalCacheBootHydrated(): boolean {
  return isBootHydrated;
}

export function readLocalCacheItem(key: string): string | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }
  if (removedKeys.has(key)) {
    return null;
  }
  const ls = getLocalStorageSafely();
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalCacheItem(key: string, value: string): void {
  memoryCache.set(key, value);
  removedKeys.delete(key);

  enqueueIdbOperation((store) => {
    store.put({
      key,
      raw: value,
      updatedAt: Date.now(),
    } satisfies IndexedDbRecord);
  });

  const ls = getLocalStorageSafely();
  if (ls) {
    try {
      ls.setItem(key, value);
    } catch {
      // If localStorage hits quota (e.g. large base64 uploads), keep IndexedDB as source of truth
      // and clear stale smaller copy in localStorage so it cannot contradict IndexedDB.
      try {
        ls.removeItem(key);
      } catch {
        // Ignore cleanup failure
      }
    }
  }

  broadcastMessage({ type: 'set', key, raw: value });
}

export function removeLocalCacheItem(key: string): void {
  memoryCache.delete(key);
  removedKeys.add(key);

  enqueueIdbOperation((store) => {
    store.delete(key);
  });

  const ls = getLocalStorageSafely();
  if (ls) {
    try {
      ls.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
  }

  broadcastMessage({ type: 'remove', key });
}

export function subscribeLocalCacheChange(key: string, listener: () => void): () => void {
  ensureCrossTabSyncInitialized();
  let set = keyListeners.get(key);
  if (!set) {
    set = new Set();
    keyListeners.set(key, set);
  }
  set.add(listener);

  return () => {
    const current = keyListeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      keyListeners.delete(key);
    }
  };
}

export async function flushIndexedDbWrites(): Promise<void> {
  await writeChain;
}

export async function bootstrapLocalCache(options?: {
  timeoutMs?: number;
  clearExisting?: boolean;
}): Promise<void> {
  ensureCrossTabSyncInitialized();

  const shouldWipe = Boolean(options?.clearExisting) || consumeStaleStorageResetFlag();
  const timeoutMs = options?.timeoutMs ?? 1500;

  const hydrateTask = (async () => {
    if (shouldWipe) {
      memoryCache.clear();
      removedKeys.clear();
      await clearAllIndexedDbRecords();
    }

    const idbRecords = await readAllIndexedDbRecords();
    for (const rec of idbRecords) {
      if (!removedKeys.has(rec.key)) {
        memoryCache.set(rec.key, rec.raw);
      }
    }

    // One-time migration: bring existing localStorage entries not yet in IndexedDB into IndexedDB
    const ls = getLocalStorageSafely();
    if (ls) {
      try {
        const keysToMigrate: Array<{ key: string; raw: string }> = [];
        for (let i = 0; i < ls.length; i += 1) {
          const k = ls.key(i);
          if (
            !k ||
            !k.startsWith(MIGRATE_KEY_PREFIX) ||
            k === RELEASE_STATE_EPOCH_KEY ||
            memoryCache.has(k) ||
            removedKeys.has(k)
          ) {
            continue;
          }
          const raw = ls.getItem(k);
          if (typeof raw === 'string') {
            keysToMigrate.push({ key: k, raw });
          }
        }

        if (keysToMigrate.length > 0) {
          for (const item of keysToMigrate) {
            memoryCache.set(item.key, item.raw);
          }
          enqueueIdbOperation((store) => {
            const now = Date.now();
            for (const item of keysToMigrate) {
              store.put({
                key: item.key,
                raw: item.raw,
                updatedAt: now,
              } satisfies IndexedDbRecord);
            }
          });
        }
      } catch {
        // Ignore restricted localStorage access
      }
    }

    isBootHydrated = true;
  })();

  if (timeoutMs <= 0) {
    await hydrateTask;
    return;
  }

  await Promise.race([
    hydrateTask,
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export function resetLocalCacheMemoryForTest(): void {
  memoryCache.clear();
  removedKeys.clear();
  keyListeners.clear();
  dbPromise = null;
  writeChain = Promise.resolve();
  isBootHydrated = false;
  if (broadcastChannel) {
    try {
      broadcastChannel.close();
    } catch {
      // Ignore
    }
    broadcastChannel = null;
  }
  windowListenersAttached = false;
}

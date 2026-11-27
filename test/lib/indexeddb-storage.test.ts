import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INDEXED_DB_STORE_NAME,
  bootstrapLocalCache,
  flushIndexedDbWrites,
  readLocalCacheItem,
  removeLocalCacheItem,
  resetLocalCacheMemoryForTest,
  writeLocalCacheItem,
} from '../../src/lib/indexeddb-storage';
import {
  CURRENT_RELEASE_STATE_EPOCH,
  RELEASE_STATE_EPOCH_KEY,
  sweepLegacyClientState,
} from '../../src/lib/storage-cleanup';

function createMemoryStorage(options?: {
  initial?: Record<string, string>;
  throwOnSet?: boolean;
}): Storage {
  const map = new Map<string, string>(Object.entries(options?.initial ?? {}));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      if (options?.throwOnSet) {
        throw new Error('QuotaExceededError');
      }
      map.set(key, value);
    },
  };
}

function createFakeIndexedDb(initialRecords: Array<{ key: string; raw: string; updatedAt: number }> = []) {
  const storeData = new Map<string, { key: string; raw: string; updatedAt: number }>();
  for (const row of initialRecords) {
    storeData.set(row.key, { ...row });
  }

  const fakeStore = (tx: { oncomplete?: (() => void) | null }) => ({
    getAll() {
      const req: { result?: unknown; onsuccess?: (() => void) | null; onerror?: (() => void) | null } = {};
      queueMicrotask(() => {
        req.result = Array.from(storeData.values());
        req.onsuccess?.();
        tx.oncomplete?.();
      });
      return req;
    },
    put(val: { key: string; raw: string; updatedAt: number }) {
      storeData.set(val.key, { ...val });
    },
    delete(key: string) {
      storeData.delete(key);
    },
    clear() {
      storeData.clear();
    },
  });

  const fakeDb = {
    objectStoreNames: {
      contains: (name: string) => name === INDEXED_DB_STORE_NAME,
    },
    createObjectStore: () => ({}),
    close: () => {},
    transaction: (_name: string, mode: 'readonly' | 'readwrite') => {
      const tx: {
        oncomplete?: (() => void) | null;
        onerror?: (() => void) | null;
        onabort?: (() => void) | null;
        objectStore: (storeName: string) => ReturnType<typeof fakeStore>;
      } = {
        objectStore: () => fakeStore(tx),
      };
      if (mode === 'readwrite') {
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
      }
      return tx;
    },
  };

  const factory = {
    open: () => {
      const req: {
        result?: unknown;
        onupgradeneeded?: (() => void) | null;
        onsuccess?: (() => void) | null;
        onerror?: (() => void) | null;
        onblocked?: (() => void) | null;
      } = {};
      queueMicrotask(() => {
        req.result = fakeDb;
        req.onsuccess?.();
      });
      return req;
    },
  };

  return { factory: factory as unknown as IDBFactory, storeData };
}

function installBrowserMocks(params: {
  localStorage: Storage;
  sessionStorage?: Storage;
  indexedDB: IDBFactory;
}) {
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    indexedDB?: IDBFactory;
  };
  const prevWindow = g.window;
  const prevIdb = g.indexedDB;

  g.window = {
    localStorage: params.localStorage,
    sessionStorage: params.sessionStorage ?? createMemoryStorage(),
    indexedDB: params.indexedDB,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.indexedDB = params.indexedDB;

  return () => {
    resetLocalCacheMemoryForTest();
    if (prevWindow === undefined) {
      delete g.window;
    } else {
      g.window = prevWindow;
    }
    if (prevIdb === undefined) {
      delete g.indexedDB;
    } else {
      g.indexedDB = prevIdb;
    }
  };
}

test('bootstrapLocalCache hydrates existing IndexedDB entries even when localStorage is empty', async () => {
  const idb = createFakeIndexedDb([
    { key: 'shansusdzar-cms-v1', raw: '{"hello":"indexeddb"}', updatedAt: 100 },
  ]);
  const ls = createMemoryStorage();
  const restore = installBrowserMocks({ localStorage: ls, indexedDB: idb.factory });

  try {
    resetLocalCacheMemoryForTest();
    await bootstrapLocalCache({ timeoutMs: 0 });
    assert.equal(readLocalCacheItem('shansusdzar-cms-v1'), '{"hello":"indexeddb"}');
  } finally {
    restore();
  }
});

test('bootstrapLocalCache migrates localStorage keys to IndexedDB while IndexedDB keeps priority', async () => {
  const idb = createFakeIndexedDb([
    { key: 'shansusdzar-cms-v1', raw: '{"source":"idb"}', updatedAt: 200 },
  ]);
  const ls = createMemoryStorage({
    initial: {
      [RELEASE_STATE_EPOCH_KEY]: CURRENT_RELEASE_STATE_EPOCH,
      'shansusdzar-cms-v1': '{"source":"stale-ls"}',
      'shansusdzar-projects-v1': '{"projects":[]}',
    },
  });
  const restore = installBrowserMocks({ localStorage: ls, indexedDB: idb.factory });

  try {
    resetLocalCacheMemoryForTest();
    await bootstrapLocalCache({ timeoutMs: 0 });
    await flushIndexedDbWrites();

    assert.equal(readLocalCacheItem('shansusdzar-cms-v1'), '{"source":"idb"}');
    assert.equal(readLocalCacheItem('shansusdzar-projects-v1'), '{"projects":[]}');
    assert.equal(idb.storeData.get('shansusdzar-projects-v1')?.raw, '{"projects":[]}');
    assert.equal(idb.storeData.has(RELEASE_STATE_EPOCH_KEY), false);
  } finally {
    restore();
  }
});

test('writeLocalCacheItem persists to IndexedDB and clears stale localStorage when localStorage quota throws', async () => {
  const idb = createFakeIndexedDb();
  const staleMap = new Map<string, string>([['shansusdzar-cms-v1', '{"old":true}']]);
  const quotaLs: Storage = {
    get length() {
      return staleMap.size;
    },
    clear() {
      staleMap.clear();
    },
    getItem(k) {
      return staleMap.get(k) ?? null;
    },
    key(i) {
      return Array.from(staleMap.keys())[i] ?? null;
    },
    removeItem(k) {
      staleMap.delete(k);
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };

  const restore = installBrowserMocks({ localStorage: quotaLs, indexedDB: idb.factory });

  try {
    resetLocalCacheMemoryForTest();
    writeLocalCacheItem('shansusdzar-cms-v1', '{"bigImageData":"data:image/png;base64,AAA"}');
    await flushIndexedDbWrites();

    assert.equal(
      idb.storeData.get('shansusdzar-cms-v1')?.raw,
      '{"bigImageData":"data:image/png;base64,AAA"}'
    );
    assert.equal(staleMap.has('shansusdzar-cms-v1'), false);
    assert.equal(
      readLocalCacheItem('shansusdzar-cms-v1'),
      '{"bigImageData":"data:image/png;base64,AAA"}'
    );

    removeLocalCacheItem('shansusdzar-cms-v1');
    await flushIndexedDbWrites();
    assert.equal(idb.storeData.has('shansusdzar-cms-v1'), false);
    assert.equal(readLocalCacheItem('shansusdzar-cms-v1'), null);
  } finally {
    restore();
  }
});

test('bootstrapLocalCache clears stale IndexedDB entries when epoch reset occurs', async () => {
  const idb = createFakeIndexedDb([
    { key: 'shansusdzar-cms-v1', raw: '{"stale":true}', updatedAt: 50 },
  ]);
  const ls = createMemoryStorage({
    initial: {
      [RELEASE_STATE_EPOCH_KEY]: 'legacy-old-epoch',
      'shansusdzar-cms-v1': '{"stale":true}',
    },
  });
  const restore = installBrowserMocks({ localStorage: ls, indexedDB: idb.factory });

  try {
    resetLocalCacheMemoryForTest();
    sweepLegacyClientState();
    await bootstrapLocalCache({ timeoutMs: 0 });
    await flushIndexedDbWrites();

    assert.equal(idb.storeData.size, 0);
    assert.equal(readLocalCacheItem('shansusdzar-cms-v1'), null);
  } finally {
    restore();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_RELEASE_STATE_EPOCH,
  RELEASE_STATE_EPOCH_KEY,
  resetStaleAppStorageIfNeeded,
  type StorageLike,
} from './storage-cleanup';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('resetStaleAppStorageIfNeeded removes old shansusdzar-* keys once and preserves subsequent writes', () => {
  const local = createMemoryStorage({
    'shansusdzar-cms-v1': '{"schemaVersion":3}',
    'shansusdzar-theme-v1': 'light',
    'shansusdzar-cart-v1': '{"items":[1]}',
    'unrelated-key': 'keep-me',
  });
  const session = createMemoryStorage({
    'shansusdzar-visitor-counted-date': '2026-11-20',
  });

  const firstRun = resetStaleAppStorageIfNeeded(local, session);
  assert.equal(firstRun, true);
  assert.equal(local.getItem(RELEASE_STATE_EPOCH_KEY), CURRENT_RELEASE_STATE_EPOCH);
  assert.equal(local.getItem('shansusdzar-cms-v1'), null);
  assert.equal(local.getItem('shansusdzar-theme-v1'), null);
  assert.equal(local.getItem('shansusdzar-cart-v1'), null);
  assert.equal(local.getItem('unrelated-key'), 'keep-me');
  assert.equal(session.getItem('shansusdzar-visitor-counted-date'), null);

  local.setItem('shansusdzar-cart-v1', '{"items":[2]}');
  const secondRun = resetStaleAppStorageIfNeeded(local, session);
  assert.equal(secondRun, false);
  assert.equal(local.getItem('shansusdzar-cart-v1'), '{"items":[2]}');
});

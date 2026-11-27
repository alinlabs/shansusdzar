import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  VERSION_CHECK_MIN_INTERVAL_MS,
  isNewerBuildAvailable,
  parseVersionPayload,
  shouldCheckRemoteVersion,
} from '../../src/lib/app-version';

const ROOT_DIR = process.cwd();

test('parseVersionPayload accepts valid version manifests and rejects malformed payloads', () => {
  assert.deepEqual(
    parseVersionPayload({ buildId: 'abc1234-99z', builtAt: '2026-11-27T10:00:00.000Z' }),
    { buildId: 'abc1234-99z', builtAt: '2026-11-27T10:00:00.000Z' }
  );
  assert.deepEqual(parseVersionPayload({ buildId: '  v2  ' }), { buildId: 'v2' });
  assert.equal(parseVersionPayload(null), null);
  assert.equal(parseVersionPayload([]), null);
  assert.equal(parseVersionPayload({ buildId: '   ' }), null);
});

test('isNewerBuildAvailable ignores dev builds and detects genuine buildId changes', () => {
  assert.equal(isNewerBuildAvailable('dev', 'abc123-1'), false);
  assert.equal(isNewerBuildAvailable('abc123-1', 'dev'), false);
  assert.equal(isNewerBuildAvailable('abc123-1', ''), false);
  assert.equal(isNewerBuildAvailable('abc123-1', 'abc123-1'), false);
  assert.equal(isNewerBuildAvailable('abc123-1', 'abc123-2'), true);
});

test('shouldCheckRemoteVersion enforces online state, non-dev buildId, and minimum interval unless forced', () => {
  const now = 1_000_000;

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'dev',
      lastCheckedAt: null,
      now,
      force: true,
      isOnline: true,
    }),
    false
  );

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'b-1',
      lastCheckedAt: null,
      now,
      isOnline: false,
    }),
    false
  );

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'b-1',
      lastCheckedAt: null,
      now,
    }),
    true
  );

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'b-1',
      lastCheckedAt: now - (VERSION_CHECK_MIN_INTERVAL_MS - 500),
      now,
    }),
    false
  );

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'b-1',
      lastCheckedAt: now - (VERSION_CHECK_MIN_INTERVAL_MS - 500),
      now,
      force: true,
    }),
    true
  );

  assert.equal(
    shouldCheckRemoteVersion({
      currentBuildId: 'b-1',
      lastCheckedAt: now - VERSION_CHECK_MIN_INTERVAL_MS,
      now,
    }),
    true
  );
});

test('Service Worker and Vite build config stamp dynamic per-build IDs and bypass /version.json cache', () => {
  const swSrc = fs.readFileSync(path.join(ROOT_DIR, 'public/sw.js'), 'utf8');
  assert.match(swSrc, /__SHANSUSDZAR_BUILD_ID__/);
  assert.match(swSrc, /url\.pathname === '\/version\.json'/);
  assert.doesNotMatch(swSrc, /'\/',\s*\n\s*'\/index\.html'/);

  const viteSrc = fs.readFileSync(path.join(ROOT_DIR, 'vite.config.ts'), 'utf8');
  assert.match(viteSrc, /__APP_BUILD_ID__/);
  assert.match(viteSrc, /version\.json/);
  assert.match(viteSrc, /__SHANSUSDZAR_BUILD_ID__/);
});

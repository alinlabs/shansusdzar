import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_3D_CACHE_NAME,
  buildResponseSignature,
  evictLruCacheEntries,
  isMediaResponseChanged,
  isValidCachedMediaResponse,
  normalizeCacheKey,
} from './media-cache';

test('buildResponseSignature extracts ETag, Last-Modified, and Content-Length headers', () => {
  const headers = new Headers({
    ETag: '"abc123"',
    'Last-Modified': 'Tue, 18 Nov 2026 00:00:00 GMT',
    'Content-Length': '12345',
  });
  assert.equal(buildResponseSignature(headers), '"abc123"|Tue, 18 Nov 2026 00:00:00 GMT|12345');
});

test('isValidCachedMediaResponse rejects HTML fallback or non-ok responses', () => {
  const validImg = new Response('binary', {
    status: 200,
    headers: { 'Content-Type': 'image/webp' },
  });
  const htmlFallback = new Response('<!doctype html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  const notFound = new Response('missing', {
    status: 404,
    headers: { 'Content-Type': 'image/webp' },
  });

  assert.equal(isValidCachedMediaResponse(validImg), true);
  assert.equal(isValidCachedMediaResponse(htmlFallback), false);
  assert.equal(isValidCachedMediaResponse(notFound), false);
});

test('isMediaResponseChanged detects updated server ETag or Content-Length cleanly', () => {
  const cachedSig = '"v1"|Tue, 18 Nov 2026 00:00:00 GMT|10240';

  const sameHeaders = new Headers({
    ETag: '"v1"',
    'Last-Modified': 'Tue, 18 Nov 2026 00:00:00 GMT',
    'Content-Length': '10240',
  });
  assert.equal(isMediaResponseChanged(cachedSig, 10240, sameHeaders, 10240), false);

  const updatedEtagHeaders = new Headers({
    ETag: '"v2"',
    'Last-Modified': 'Tue, 18 Nov 2026 01:00:00 GMT',
    'Content-Length': '10240',
  });
  assert.equal(isMediaResponseChanged(cachedSig, 10240, updatedEtagHeaders, 10240), true);

  const updatedSizeOnlyHeaders = new Headers({});
  assert.equal(isMediaResponseChanged('', 10240, updatedSizeOnlyHeaders, 14500), true);
});

test('evictLruCacheEntries respects maxEntries and skips pinned keys', () => {
  const map = new Map<string, string>([
    ['/logo-gelap.webp', 'blob:logo'],
    ['/a.webp', 'blob:a'],
    ['/b.webp', 'blob:b'],
    ['/c.webp', 'blob:c'],
    ['/d.webp', 'blob:d'],
  ]);
  const pinned = new Set(['/logo-gelap.webp']);
  const evicted: string[] = [];

  const count = evictLruCacheEntries(map, 3, pinned, (key) => evicted.push(key));

  assert.equal(count, 2);
  assert.deepEqual(evicted, ['/a.webp', '/b.webp']);
  assert.equal(map.has('/logo-gelap.webp'), true);
  assert.equal(map.has('/c.webp'), true);
  assert.equal(map.has('/d.webp'), true);
});

test('MODEL_3D_CACHE_NAME and normalizeCacheKey preserve model cache keys', () => {
  assert.equal(MODEL_3D_CACHE_NAME, 'shansusdzar-3d-v1');
  assert.equal(normalizeCacheKey('  /sample-produk/3d/kitchen.glb  '), '/sample-produk/3d/kitchen.glb');
});

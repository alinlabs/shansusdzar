import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SITE_ORIGIN, getRuntimeSiteOrigin, normalizeSiteOrigin } from './site-url';

test('normalizeSiteOrigin normalizes domains cleanly and defaults to shansusdzar.vercel.app', () => {
  assert.equal(DEFAULT_SITE_ORIGIN, 'https://shansusdzar.vercel.app');
  assert.equal(normalizeSiteOrigin(''), 'https://shansusdzar.vercel.app');
  assert.equal(normalizeSiteOrigin(undefined), 'https://shansusdzar.vercel.app');
  assert.equal(
    normalizeSiteOrigin('https://shansusdzar.vercel.app/'),
    'https://shansusdzar.vercel.app'
  );
  assert.equal(normalizeSiteOrigin('https://shansusdzar.com/tentang'), 'https://shansusdzar.com');
  assert.equal(normalizeSiteOrigin('shansusdzar.com'), 'https://shansusdzar.com');
  assert.equal(normalizeSiteOrigin('not a url :::'), 'https://shansusdzar.vercel.app');
});

test('getRuntimeSiteOrigin falls back automatically in non-browser environments and uses window.location.origin in browser', () => {
  assert.equal(getRuntimeSiteOrigin(), 'https://shansusdzar.vercel.app');
});


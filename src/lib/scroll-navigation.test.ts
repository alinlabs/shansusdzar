import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResetScrollOnLocationChange } from './scroll-navigation';

test('shouldResetScrollOnLocationChange returns false on initial mount or identical route', () => {
  assert.equal(
    shouldResetScrollOnLocationChange(null, { pathname: '/', search: '' }),
    false
  );
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '' },
      { pathname: '/produk', search: '' }
    ),
    false
  );
});

test('shouldResetScrollOnLocationChange resets when pathname changes', () => {
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/', search: '' },
      { pathname: '/produk', search: '' }
    ),
    true
  );
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '?mode=custom' },
      { pathname: '/pesanan', search: '' }
    ),
    true
  );
});

test('shouldResetScrollOnLocationChange preserves scroll when opening or closing product modal query', () => {
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '' },
      { pathname: '/produk', search: '?produk=sofa-minimalis' }
    ),
    false
  );
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '?produk=sofa-minimalis' },
      { pathname: '/produk', search: '' }
    ),
    false
  );
});

test('shouldResetScrollOnLocationChange resets when switching produk mode between furniture and custom', () => {
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '' },
      { pathname: '/produk', search: '?mode=custom' }
    ),
    true
  );
  assert.equal(
    shouldResetScrollOnLocationChange(
      { pathname: '/produk', search: '?mode=custom' },
      { pathname: '/produk', search: '' }
    ),
    true
  );
});

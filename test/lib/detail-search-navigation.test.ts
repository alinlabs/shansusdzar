import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildDetailSearchRedirectState,
  clearDetailSearchSession,
  consumeDetailSearchSessionHistoryBack,
  markDetailSearchSessionStarted,
  normalizeSafeInternalReturnPath,
  parseDetailSearchRedirectState,
  resolveDetailSearchCloseTarget,
} from '../../src/lib/detail-search-navigation';

const ROOT_DIR = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

test('normalizeSafeInternalReturnPath accepts internal paths and rejects unsafe targets', () => {
  assert.equal(normalizeSafeInternalReturnPath('/produk/kitchen-set'), '/produk/kitchen-set');
  assert.equal(
    normalizeSafeInternalReturnPath('/portofolio/kitchen-set?tab=solusi#detail'),
    '/portofolio/kitchen-set?tab=solusi#detail'
  );
  assert.equal(normalizeSafeInternalReturnPath('https://evil.example/produk'), null);
  assert.equal(normalizeSafeInternalReturnPath('//evil.example/produk'), null);
  assert.equal(normalizeSafeInternalReturnPath('/produk\nLocation: https://evil.com'), null);
  assert.equal(normalizeSafeInternalReturnPath('   '), null);
  assert.equal(normalizeSafeInternalReturnPath(null), null);
});

test('buildDetailSearchRedirectState and parseDetailSearchRedirectState round-trip safely', () => {
  const state = buildDetailSearchRedirectState('/produk/kitchen-set', '?ukuran=custom', '#varian');
  assert.deepEqual(state, {
    openSearch: true,
    returnTo: '/produk/kitchen-set?ukuran=custom#varian',
  });

  assert.deepEqual(parseDetailSearchRedirectState(state), {
    openSearch: true,
    returnTo: '/produk/kitchen-set?ukuran=custom#varian',
  });
  assert.equal(parseDetailSearchRedirectState(null), null);
  assert.equal(parseDetailSearchRedirectState({ openSearch: false, returnTo: '/produk/a' }), null);
  assert.deepEqual(
    parseDetailSearchRedirectState({ openSearch: true, returnTo: 'https://evil.com' }),
    { openSearch: true, returnTo: null }
  );
});

test('resolveDetailSearchCloseTarget returns original detail route only when on different list path', () => {
  const state = buildDetailSearchRedirectState('/portofolio/kitchen-set');
  assert.equal(resolveDetailSearchCloseTarget('/portofolio', state), '/portofolio/kitchen-set');
  assert.equal(resolveDetailSearchCloseTarget('/portofolio/', state), '/portofolio/kitchen-set');
  assert.equal(resolveDetailSearchCloseTarget('/portofolio/kitchen-set', state), null);
  assert.equal(resolveDetailSearchCloseTarget('/berita', { openSearch: false, returnTo: '/berita/a' }), null);
});

test('detail search session tracker tracks in-app history push vs cleared or mismatched states', () => {
  clearDetailSearchSession();
  assert.equal(consumeDetailSearchSessionHistoryBack('/produk/kitchen-set'), false);

  markDetailSearchSessionStarted('/produk/kitchen-set');
  assert.equal(consumeDetailSearchSessionHistoryBack('/produk/kitchen-set'), true);
  assert.equal(consumeDetailSearchSessionHistoryBack('/produk/kitchen-set'), false);

  markDetailSearchSessionStarted('/berita/judul-artikel');
  assert.equal(consumeDetailSearchSessionHistoryBack('/berita/artikel-lain'), false);

  markDetailSearchSessionStarted('/portofolio/proyek-a');
  clearDetailSearchSession();
  assert.equal(consumeDetailSearchSessionHistoryBack('/portofolio/proyek-a'), false);
});

test('Product, Portfolio, and Berita detail pages register searchRedirect to their complete list routes', () => {
  const productDetailSrc = readProjectFile('src/pages/produk/detail/use-product-detail.ts');
  assert.match(productDetailSrc, /searchRedirect:\s*\{[\s\S]*listRoute:\s*'\/produk'/);

  const portfolioDetailSrc = readProjectFile('src/pages/portofolio/detail.tsx');
  assert.match(portfolioDetailSrc, /searchRedirect:\s*\{[\s\S]*listRoute:\s*'\/portofolio'/);

  const beritaDetailSrc = readProjectFile('src/pages/berita/detail.tsx');
  assert.match(beritaDetailSrc, /searchRedirect:\s*\{[\s\S]*listRoute:\s*'\/berita'/);
});

test('List pages and NavigasiHeader sync search mode cleanly on open and cancel back to detail route', () => {
  for (const listPagePath of [
    'src/pages/produk/katalog/index.tsx',
    'src/pages/portofolio/index.tsx',
    'src/pages/berita/index.tsx',
  ]) {
    const src = readProjectFile(listPagePath);
    assert.match(
      src,
      /parseDetailSearchRedirectState\(location\.state\)\?\.openSearch/,
      `${listPagePath} must initialize search mode from detail search redirect state`
    );
  }

  const headerSrc = readProjectFile('src/components/layout/navigasi-header.tsx');
  assert.match(headerSrc, /headerSearchRedirect/);
  assert.match(headerSrc, /buildDetailSearchRedirectState\(/);
  assert.match(headerSrc, /resolveDetailSearchCloseTarget\(location\.pathname, location\.state\)/);
  assert.match(headerSrc, /consumeDetailSearchSessionHistoryBack\(/);
});

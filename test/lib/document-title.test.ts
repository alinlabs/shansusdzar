import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAVICON_PATH,
  resolveBrowserTabTitle,
  resolvePageTabLabel,
} from '../../src/lib/document-title';

test('FAVICON_PATH uses /logo-gelap.webp', () => {
  assert.equal(FAVICON_PATH, '/logo-gelap.webp');
});

test('resolveBrowserTabTitle formats public routes as Shansusdzar - [1 kata]', () => {
  const cases: Array<[string, string]> = [
    ['/', 'Shansusdzar - Beranda'],
    ['/produk', 'Shansusdzar - Produk'],
    ['/produk/kitchen-set-minimalis', 'Shansusdzar - Produk'],
    ['/katalog', 'Shansusdzar - Produk'],
    ['/katalog/lemari-pakaian', 'Shansusdzar - Produk'],
    ['/produk/custom', 'Shansusdzar - Custom'],
    ['/custom-interior', 'Shansusdzar - Custom'],
    ['/portofolio', 'Shansusdzar - Portofolio'],
    ['/portofolio/dapur-modern-purwakarta', 'Shansusdzar - Portofolio'],
    ['/berita', 'Shansusdzar - Berita'],
    ['/berita/tips-perawatan-hpl', 'Shansusdzar - Berita'],
    ['/tips-interior', 'Shansusdzar - Tips'],
    ['/tips-interior/multipleks', 'Shansusdzar - Tips'],
    ['/faq', 'Shansusdzar - FAQ'],
    ['/tentang', 'Shansusdzar - Tentang'],
    ['/pencarian?q=dapur', 'Shansusdzar - Pencarian'],
    ['/pesanan', 'Shansusdzar - Pesanan'],
    ['/pengaturan#tema', 'Shansusdzar - Pengaturan'],
    ['/kebijakan-privasi', 'Shansusdzar - Privasi'],
    ['/syarat-ketentuan', 'Shansusdzar - Ketentuan'],
    ['/keamanan-kepatuhan', 'Shansusdzar - Keamanan'],
    ['/rute-tidak-dikenal', 'Shansusdzar - 404'],
  ];

  for (const [pathname, expectedTitle] of cases) {
    const actual = resolveBrowserTabTitle(pathname);
    assert.equal(actual, expectedTitle, `Expected ${pathname} -> ${expectedTitle}`);
    assert.match(actual, /^Shansusdzar - \S+$/);
    assert.equal(resolvePageTabLabel(pathname).includes(' '), false);
  }
});

test('resolveBrowserTabTitle returns only Shansusdzar - Admin for all admin routes', () => {
  const adminPaths = [
    '/admin',
    '/admin/',
    '/admin/login',
    '/admin/produk',
    '/admin/produk/baru',
    '/admin/proyek/pr-1',
    '/admin/keuangan',
    '/admin/seo',
    '/admin/akses',
  ];

  for (const pathname of adminPaths) {
    assert.equal(resolveBrowserTabTitle(pathname), 'Shansusdzar - Admin');
  }
});

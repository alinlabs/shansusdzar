import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_USERS } from '../../src/lib/cms-defaults';
import {
  evaluateAdminBypassAttempt,
  parseAdminBypassParams,
  resolveAdminBypassTargetPathname,
  resolveBypassOwnerAccount,
  stripBypassParamsFromPath,
} from '../../src/lib/admin-bypass';

test('parseAdminBypassParams handles ?bypass=true and optional &page=... cleanly without credentials', () => {
  assert.deepEqual(parseAdminBypassParams('?bypass=true'), {
    hasBypass: true,
    page: '',
    cleanedSearch: '',
  });

  assert.deepEqual(parseAdminBypassParams('?bypass=true&page=proyek'), {
    hasBypass: true,
    page: 'proyek',
    cleanedSearch: '',
  });

  assert.deepEqual(parseAdminBypassParams('?tab=dokumen&bypass=true&page=proyek&sort=asc'), {
    hasBypass: true,
    page: 'proyek',
    cleanedSearch: '?tab=dokumen&sort=asc',
  });

  assert.deepEqual(parseAdminBypassParams('?bypass=false&page=proyek'), {
    hasBypass: false,
    page: '',
    cleanedSearch: '?page=proyek',
  });
});

test('resolveAdminBypassTargetPathname resolves page aliases, subpaths, and rejects unsafe paths', () => {
  assert.equal(resolveAdminBypassTargetPathname('', '/admin'), '/admin');
  assert.equal(resolveAdminBypassTargetPathname('', '/admin/login'), '/admin');
  assert.equal(resolveAdminBypassTargetPathname('', '/admin/produk'), '/admin/produk');
  assert.equal(resolveAdminBypassTargetPathname('dashboard', '/admin'), '/admin');
  assert.equal(resolveAdminBypassTargetPathname('proyek', '/admin'), '/admin/proyek');
  assert.equal(resolveAdminBypassTargetPathname('/admin/proyek/', '/admin'), '/admin/proyek');
  assert.equal(resolveAdminBypassTargetPathname('keuangan', '/admin'), '/admin/keuangan');
  assert.equal(resolveAdminBypassTargetPathname('produk', '/admin'), '/admin/produk');
  assert.equal(resolveAdminBypassTargetPathname('katalog', '/admin'), '/admin/produk');
  assert.equal(resolveAdminBypassTargetPathname('portofolio', '/admin'), '/admin/portofolio');
  assert.equal(resolveAdminBypassTargetPathname('berita', '/admin'), '/admin/informasi/berita');
  assert.equal(resolveAdminBypassTargetPathname('material', '/admin'), '/admin/informasi/material');
  assert.equal(resolveAdminBypassTargetPathname('faq', '/admin'), '/admin/informasi/faq');
  assert.equal(resolveAdminBypassTargetPathname('tentang', '/admin'), '/admin/tentang');
  assert.equal(resolveAdminBypassTargetPathname('akses', '/admin'), '/admin/akses');
  assert.equal(resolveAdminBypassTargetPathname('seo', '/admin'), '/admin/seo');
  assert.equal(resolveAdminBypassTargetPathname('proyek/baru', '/admin'), '/admin/proyek/baru');
  assert.equal(resolveAdminBypassTargetPathname('proyek/pr-1/edit', '/admin'), '/admin/proyek/pr-1/edit');
  assert.equal(resolveAdminBypassTargetPathname('../etc/passwd', '/admin'), '/admin');
  assert.equal(resolveAdminBypassTargetPathname('https://evil.example', '/admin'), '/admin');
});

test('stripBypassParamsFromPath normalizes bypass+page links into normal admin URLs', () => {
  assert.equal(stripBypassParamsFromPath('/admin?bypass=true'), '/admin');
  assert.equal(stripBypassParamsFromPath('/admin?bypass=true&page=proyek'), '/admin/proyek');
  assert.equal(
    stripBypassParamsFromPath('/admin?bypass=true&page=keuangan&tab=skema#top'),
    '/admin/keuangan?tab=skema#top'
  );
  assert.equal(
    stripBypassParamsFromPath('/admin/proyek?tab=keuangan'),
    '/admin/proyek?tab=keuangan'
  );
});

test('evaluateAdminBypassAttempt logs in owner directly without email or password', () => {
  const expectedOwner = resolveBypassOwnerAccount(DEFAULT_ADMIN_USERS);
  assert.ok(expectedOwner);

  const rootBypass = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=true',
  });
  assert.equal(rootBypass.active, true);
  assert.equal(rootBypass.ok, true);
  if (rootBypass.active && rootBypass.ok) {
    assert.equal(rootBypass.user.id, expectedOwner.id);
    assert.equal(rootBypass.cleanTargetPath, '/admin');
  }

  const proyekBypass = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=true&page=proyek',
  });
  assert.equal(proyekBypass.active, true);
  assert.equal(proyekBypass.ok, true);
  if (proyekBypass.active && proyekBypass.ok) {
    assert.equal(proyekBypass.user.id, expectedOwner.id);
    assert.equal(proyekBypass.cleanTargetPath, '/admin/proyek');
  }

  const loginWithPageBypass = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin/login',
    search: '?bypass=true&page=keuangan&tab=skema',
  });
  assert.equal(loginWithPageBypass.active, true);
  assert.equal(loginWithPageBypass.ok, true);
  if (loginWithPageBypass.active && loginWithPageBypass.ok) {
    assert.equal(loginWithPageBypass.cleanTargetPath, '/admin/keuangan?tab=skema');
  }

  const falseBypass = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=false&page=proyek',
  });
  assert.equal(falseBypass.active, false);

  const normalAdmin = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?tab=ringkasan',
  });
  assert.equal(normalAdmin.active, false);
});

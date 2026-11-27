import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_NAV_DEFINITIONS,
  resolveAdminHeaderBackMeta,
  resolveLockedAdminAddon,
  resolveProjectFormBackPath,
  shouldShowMobileAdminHamburger,
} from '../../src/lib/admin-routing';

test('resolveProjectFormBackPath: Buat Proyek returns to /admin/proyek', () => {
  assert.deepEqual(
    resolveProjectFormBackPath({
      isEditMode: false,
      projectId: undefined,
      existingProjectId: null,
    }),
    {
      backTo: '/admin/proyek',
      backLabel: 'Kembali ke Daftar Proyek',
    }
  );
});

test('resolveProjectFormBackPath: Edit Proyek returns to /admin/proyek/:projectId', () => {
  assert.deepEqual(
    resolveProjectFormBackPath({
      isEditMode: true,
      projectId: 'prj-k005',
      existingProjectId: 'prj-k005',
    }),
    {
      backTo: '/admin/proyek/prj-k005',
      backLabel: 'Kembali ke Detail Proyek',
    }
  );
});

test('resolveProjectFormBackPath: Edit Proyek when project does not exist falls back to /admin/proyek', () => {
  assert.deepEqual(
    resolveProjectFormBackPath({
      isEditMode: true,
      projectId: 'missing-id',
      existingProjectId: null,
    }),
    {
      backTo: '/admin/proyek',
      backLabel: 'Kembali ke Daftar Proyek',
    }
  );
});

test('resolveAdminHeaderBackMeta resolves sub-pages cleanly and keeps top-level pages without backTo', () => {
  // Top-level pages -> null (show mobile hamburger)
  for (const topRoute of [
    '/admin',
    '/admin/',
    '/admin/produk',
    '/admin/portofolio',
    '/admin/marketing/database',
    '/admin/marketing/campaign',
    '/admin/marketing/content-plan',
    '/admin/informasi/berita',
    '/admin/informasi/material',
    '/admin/informasi/faq',
    '/admin/tentang',
    '/admin/seo',
    '/admin/proyek',
    '/admin/keuangan',
    '/admin/akses',
  ]) {
    const meta = resolveAdminHeaderBackMeta(topRoute);
    assert.equal(meta, null, `Expected ${topRoute} to have no backTo`);
    assert.equal(shouldShowMobileAdminHamburger(Boolean(meta)), true);
  }

  // Produk form/detail
  assert.equal(resolveAdminHeaderBackMeta('/admin/produk/baru')?.backTo, '/admin/produk');
  assert.equal(resolveAdminHeaderBackMeta('/admin/produk/kitchen-set')?.backTo, '/admin/produk');
  assert.equal(
    resolveAdminHeaderBackMeta('/admin/produk/kitchen-set/edit')?.backTo,
    '/admin/produk'
  );
  assert.equal(
    shouldShowMobileAdminHamburger(
      Boolean(resolveAdminHeaderBackMeta('/admin/produk/kitchen-set/edit')?.backTo)
    ),
    false
  );

  // Proyek detail, create form, edit form, and nested sub-routes
  assert.equal(resolveAdminHeaderBackMeta('/admin/proyek/baru')?.backTo, '/admin/proyek');
  assert.equal(resolveAdminHeaderBackMeta('/admin/proyek/prj-01')?.backTo, '/admin/proyek');
  assert.equal(
    resolveAdminHeaderBackMeta('/admin/proyek/prj-01/edit')?.backTo,
    '/admin/proyek/prj-01'
  );
  assert.equal(
    resolveAdminHeaderBackMeta('/admin/proyek/prj-01/keuangan/transaksi/baru')?.backTo,
    '/admin/proyek/prj-01?tab=keuangan'
  );
  assert.equal(
    resolveAdminHeaderBackMeta('/admin/proyek/prj-01/dokumen/penawaran/baru')?.backTo,
    '/admin/proyek/prj-01?tab=dokumen'
  );
  assert.equal(
    shouldShowMobileAdminHamburger(
      Boolean(resolveAdminHeaderBackMeta('/admin/proyek/prj-01/edit')?.backTo)
    ),
    false
  );

  // Campaign send & others
  assert.equal(
    resolveAdminHeaderBackMeta('/admin/marketing/campaign/cmp-1/kirim')?.backTo,
    '/admin/marketing/campaign'
  );
  assert.equal(resolveAdminHeaderBackMeta('/admin/keuangan/baru')?.backTo, '/admin/keuangan');
  assert.equal(resolveAdminHeaderBackMeta('/admin/akses/pengguna/baru')?.backTo, '/admin/akses');
});

test('resolveLockedAdminAddon marks Marketing & SEO as separate paid modules and leaves core routes unlocked', () => {
  assert.equal(resolveLockedAdminAddon('/admin/marketing')?.id, 'marketing');
  assert.equal(resolveLockedAdminAddon('/admin/marketing/database')?.id, 'marketing');
  assert.equal(resolveLockedAdminAddon('/admin/marketing/campaign/baru')?.id, 'marketing');
  assert.equal(resolveLockedAdminAddon('/admin/marketing/content-plan')?.id, 'marketing');
  assert.equal(resolveLockedAdminAddon('/admin/seo')?.id, 'seo');
  assert.equal(resolveLockedAdminAddon('/admin/seo/')?.id, 'seo');

  for (const unlockedRoute of [
    '/admin',
    '/admin/produk',
    '/admin/portofolio',
    '/admin/informasi/berita',
    '/admin/tentang',
    '/admin/proyek',
    '/admin/keuangan',
    '/admin/akses',
  ]) {
    assert.equal(resolveLockedAdminAddon(unlockedRoute), null);
  }
});

test('ADMIN_NAV_DEFINITIONS places Proyek right below Dashboard and Keuangan right below Proyek with per-page access keys', () => {
  assert.equal(ADMIN_NAV_DEFINITIONS[0]?.to, '/admin');
  assert.equal(ADMIN_NAV_DEFINITIONS[0]?.label, 'Dashboard');
  assert.equal(ADMIN_NAV_DEFINITIONS[1]?.to, '/admin/proyek');
  assert.equal(ADMIN_NAV_DEFINITIONS[1]?.page, 'proyek');
  assert.equal(ADMIN_NAV_DEFINITIONS[2]?.to, '/admin/keuangan');
  assert.equal(ADMIN_NAV_DEFINITIONS[2]?.page, 'keuangan');

  const informasiNav = ADMIN_NAV_DEFINITIONS.find((item) => item.to === '/admin/informasi');
  assert.deepEqual(
    informasiNav?.children?.map((child) => child.page),
    ['berita', 'material', 'faq']
  );
});

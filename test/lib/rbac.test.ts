import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_USERS } from '../../src/lib/cms-defaults';
import {
  ACCESS_PAGE_CATALOG,
  canAssignPageLevel,
  canDeleteUser,
  canEditPage,
  canEditTargetUser,
  canViewPage,
  formatUserAccessSummary,
  getPageAccess,
  hasPageAccess,
  migrateLegacyPermissionsToAccess,
  sanitizePageAccessList,
  validateAdminLogin,
} from '../../src/lib/rbac';

test('validateAdminLogin validates email and password without account status field', () => {
  const okRes = validateAdminLogin(
    DEFAULT_ADMIN_USERS,
    'admin1@shansusdzar.com',
    'admin123'
  );
  assert.equal(okRes.ok, true);

  const viewerRes = validateAdminLogin(
    DEFAULT_ADMIN_USERS,
    'admin4@shansusdzar.com',
    'admin123'
  );
  assert.equal(viewerRes.ok, true);

  const wrongRes = validateAdminLogin(DEFAULT_ADMIN_USERS, 'admin1@shansusdzar.com', 'salah');
  assert.equal(wrongRes.ok, false);
});

test('getPageAccess and hasPageAccess enforce Owner, hide, view, and editor semantics accurately', () => {
  const ownerUser = DEFAULT_ADMIN_USERS[0];
  assert.equal(ownerUser.isOwner, true);
  assert.equal(getPageAccess(ownerUser, 'pengguna'), 'editor');
  assert.equal(canEditPage(ownerUser, 'proyek'), true);

  const catalogUser = DEFAULT_ADMIN_USERS[1];
  assert.equal(getPageAccess(catalogUser, 'produk'), 'editor');
  assert.equal(canViewPage(catalogUser, 'produk'), true);
  assert.equal(canEditPage(catalogUser, 'produk'), true);

  assert.equal(getPageAccess(catalogUser, 'portofolio'), 'view');
  assert.equal(canViewPage(catalogUser, 'portofolio'), true);
  assert.equal(canEditPage(catalogUser, 'portofolio'), false);

  assert.equal(getPageAccess(catalogUser, 'proyek'), 'hide');
  assert.equal(canViewPage(catalogUser, 'proyek'), false);
  assert.equal(hasPageAccess(catalogUser, 'proyek', 'view'), false);

  const viewerUser = DEFAULT_ADMIN_USERS[3];
  assert.equal(getPageAccess(viewerUser, 'proyek'), 'view');
  assert.equal(canViewPage(viewerUser, 'proyek'), true);
  assert.equal(canEditPage(viewerUser, 'proyek'), false);
});

test('sanitizePageAccessList supports krendensial typo/variants and fills missing pages as hide', () => {
  const sanitized = sanitizePageAccessList([
    { halaman: 'proyek', krendensial: 'view' },
    { halaman: 'berita', kredensial: 'editor' },
    { halaman: 'unknown-page', krendensial: 'editor' },
  ]);

  assert.equal(sanitized.length, 9);
  assert.deepEqual(
    sanitized.find((item) => item.halaman === 'proyek'),
    { halaman: 'proyek', krendensial: 'view' }
  );
  assert.deepEqual(
    sanitized.find((item) => item.halaman === 'berita'),
    { halaman: 'berita', krendensial: 'editor' }
  );
  assert.deepEqual(
    sanitized.find((item) => item.halaman === 'keuangan'),
    { halaman: 'keuangan', krendensial: 'hide' }
  );
});

test('migrateLegacyPermissionsToAccess maps legacy permission arrays into 9-page credentials', () => {
  const migrated = migrateLegacyPermissionsToAccess([
    'katalog.view',
    'katalog.edit',
    'informasi.view',
    'keuangan.view',
  ]);

  assert.equal(migrated.length, 9);
  assert.equal(migrated.find((item) => item.halaman === 'produk')?.krendensial, 'editor');
  assert.equal(migrated.find((item) => item.halaman === 'proyek')?.krendensial, 'view');
  assert.equal(migrated.find((item) => item.halaman === 'keuangan')?.krendensial, 'view');
  assert.equal(migrated.find((item) => item.halaman === 'berita')?.krendensial, 'view');
  assert.equal(migrated.find((item) => item.halaman === 'material')?.krendensial, 'view');
  assert.equal(migrated.find((item) => item.halaman === 'faq')?.krendensial, 'view');
  assert.equal(migrated.find((item) => item.halaman === 'pengguna')?.krendensial, 'hide');
});

test('canDeleteUser protects current session and Owner account', () => {
  const ownerUser = DEFAULT_ADMIN_USERS[0];
  const selfCheck = canDeleteUser(ownerUser, ownerUser.id, DEFAULT_ADMIN_USERS, ownerUser);
  assert.equal(selfCheck.allowed, false);

  const ownerDeleteAttempt = canDeleteUser(
    ownerUser,
    'usr-katalog',
    DEFAULT_ADMIN_USERS,
    DEFAULT_ADMIN_USERS[1]
  );
  assert.equal(ownerDeleteAttempt.allowed, false);

  const normalUserCheck = canDeleteUser(
    DEFAULT_ADMIN_USERS[1],
    ownerUser.id,
    DEFAULT_ADMIN_USERS,
    ownerUser
  );
  assert.equal(normalUserCheck.allowed, true);
});

test('only Owner can edit Owner/pengguna-editor or assign editor level on pengguna', () => {
  const ownerUser = DEFAULT_ADMIN_USERS[0];
  const managerUser = {
    ...DEFAULT_ADMIN_USERS[1],
    akses: DEFAULT_ADMIN_USERS[1].akses.map((item) =>
      item.halaman === 'pengguna' ? { ...item, krendensial: 'editor' as const } : item
    ),
  };

  assert.equal(canEditTargetUser(ownerUser, DEFAULT_ADMIN_USERS[2]).allowed, true);
  assert.equal(canEditTargetUser(managerUser, ownerUser).allowed, false);
  assert.equal(canEditTargetUser(managerUser, DEFAULT_ADMIN_USERS[2]).allowed, true);

  assert.equal(canAssignPageLevel(ownerUser, 'pengguna', 'editor'), true);
  assert.equal(canAssignPageLevel(managerUser, 'pengguna', 'editor'), false);
  assert.equal(canAssignPageLevel(managerUser, 'pengguna', 'view'), true);
  assert.equal(canAssignPageLevel(managerUser, 'keuangan', 'editor'), true);
});

test('consolidated akun.json provides the 9 simplified page cards and 4 admin accounts without status', () => {
  assert.deepEqual(
    ACCESS_PAGE_CATALOG.map((item) => item.halaman),
    [
      'proyek',
      'keuangan',
      'produk',
      'portofolio',
      'berita',
      'material',
      'faq',
      'profil-usaha',
      'pengguna',
    ]
  );
  assert.equal(DEFAULT_ADMIN_USERS.length, 4);
  for (const user of DEFAULT_ADMIN_USERS) {
    assert.equal('status' in user, false);
    assert.equal(user.akses.length, 9);
  }
  assert.equal(formatUserAccessSummary(DEFAULT_ADMIN_USERS[0]), 'Owner · Akses Penuh');
  assert.equal(formatUserAccessSummary(DEFAULT_ADMIN_USERS[3]), 'Semua View (9/9)');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_ROLES, DEFAULT_ADMIN_USERS } from './cms-defaults';
import {
  canDeactivateOrDeleteUser,
  canDeleteRole,
  hasAnyPermission,
  hasPermission,
  resolveUserRole,
  validateAdminLogin,
} from './rbac';

test('validateAdminLogin succeeds for active credentials and blocks wrong/suspended accounts', () => {
  const okRes = validateAdminLogin(
    DEFAULT_ADMIN_USERS,
    'admin@shansusdzar.id',
    'sdi-admin-2026'
  );
  assert.equal(okRes.ok, true);

  const wrongRes = validateAdminLogin(DEFAULT_ADMIN_USERS, 'admin@shansusdzar.id', 'salah');
  assert.equal(wrongRes.ok, false);

  const suspendedUsers = DEFAULT_ADMIN_USERS.map((u) =>
    u.id === 'usr-viewer' ? { ...u, status: 'ditangguhkan' as const } : u
  );
  const suspendedRes = validateAdminLogin(
    suspendedUsers,
    'audit@shansusdzar.id',
    'sdi-viewer-2026'
  );
  assert.equal(suspendedRes.ok, false);
});

test('hasPermission and hasAnyPermission enforce role permissions accurately', () => {
  const catalogRole = resolveUserRole(DEFAULT_ADMIN_USERS[1], DEFAULT_ADMIN_ROLES);
  assert.equal(hasPermission(catalogRole, 'katalog.edit'), true);
  assert.equal(hasPermission(catalogRole, 'akses.manage'), false);
  assert.equal(hasAnyPermission(catalogRole, ['tentang.edit', 'katalog.view']), true);
});

test('canDeactivateOrDeleteUser protects current session and last super admin', () => {
  const superAdmin = DEFAULT_ADMIN_USERS[0];
  const selfCheck = canDeactivateOrDeleteUser(
    superAdmin,
    superAdmin.id,
    DEFAULT_ADMIN_USERS,
    DEFAULT_ADMIN_ROLES
  );
  assert.equal(selfCheck.allowed, false);

  const lastSuperCheck = canDeactivateOrDeleteUser(
    superAdmin,
    'usr-katalog',
    DEFAULT_ADMIN_USERS,
    DEFAULT_ADMIN_ROLES
  );
  assert.equal(lastSuperCheck.allowed, false);

  const normalUserCheck = canDeactivateOrDeleteUser(
    DEFAULT_ADMIN_USERS[1],
    superAdmin.id,
    DEFAULT_ADMIN_USERS,
    DEFAULT_ADMIN_ROLES
  );
  assert.equal(normalUserCheck.allowed, true);
});

test('canDeleteRole prevents deleting system roles or assigned roles', () => {
  const superRole = DEFAULT_ADMIN_ROLES[0];
  assert.equal(canDeleteRole(superRole, DEFAULT_ADMIN_USERS).allowed, false);

  const catalogRole = DEFAULT_ADMIN_ROLES[1];
  assert.equal(canDeleteRole(catalogRole, DEFAULT_ADMIN_USERS).allowed, false);

  const unusedCustomRole = {
    id: 'role-custom',
    nama: 'Kontributor',
    deskripsi: 'Test',
    daftarIzin: ['dashboard.view' as const],
  };
  assert.equal(canDeleteRole(unusedCustomRole, DEFAULT_ADMIN_USERS).allowed, true);
});

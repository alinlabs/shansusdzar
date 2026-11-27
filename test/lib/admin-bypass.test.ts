import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_USERS } from '../../src/lib/cms-defaults';
import {
  evaluateAdminBypassAttempt,
  parseAdminBypassParams,
  stripBypassParamsFromPath,
} from '../../src/lib/admin-bypass';

test('parseAdminBypassParams parses ?bypass=[email]&[password] format cleanly', () => {
  const parsed = parseAdminBypassParams('?bypass=admin1@shansusdzar.com&admin123');
  assert.deepEqual(parsed, {
    hasBypass: true,
    email: 'admin1@shansusdzar.com',
    password: 'admin123',
    cleanedSearch: '',
  });
});

test('parseAdminBypassParams preserves unrelated query params and decodes special characters', () => {
  const parsed = parseAdminBypassParams(
    '?tab=dokumen&bypass=admin2%40shansusdzar.com&admin123&sort=asc'
  );
  assert.deepEqual(parsed, {
    hasBypass: true,
    email: 'admin2@shansusdzar.com',
    password: 'admin123',
    cleanedSearch: '?tab=dokumen&sort=asc',
  });

  const withPlus = parseAdminBypassParams('?bypass=admin1@shansusdzar.com&pass+123');
  assert.equal(withPlus.password, 'pass+123');

  const withoutPassword = parseAdminBypassParams('?bypass=admin1@shansusdzar.com&tab=keuangan');
  assert.equal(withoutPassword.hasBypass, true);
  assert.equal(withoutPassword.email, 'admin1@shansusdzar.com');
  assert.equal(withoutPassword.password, '');
  assert.equal(withoutPassword.cleanedSearch, '?tab=keuangan');
});

test('stripBypassParamsFromPath removes bypass credentials from URL paths', () => {
  assert.equal(
    stripBypassParamsFromPath('/admin?bypass=admin1@shansusdzar.com&admin123'),
    '/admin'
  );
  assert.equal(
    stripBypassParamsFromPath('/admin/proyek/p1?tab=dokumen&bypass=admin1@shansusdzar.com&admin123#top'),
    '/admin/proyek/p1?tab=dokumen#top'
  );
  assert.equal(stripBypassParamsFromPath('/admin/proyek?tab=keuangan'), '/admin/proyek?tab=keuangan');
});

test('evaluateAdminBypassAttempt validates against akun.json users and rejects invalid credentials', () => {
  for (const num of [1, 2, 3, 4]) {
    const email = `admin${num}@shansusdzar.com`;
    const res = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
      pathname: '/admin',
      search: `?bypass=${email}&admin123`,
    });
    assert.equal(res.active, true);
    assert.equal(res.ok, true);
    if (res.active && res.ok) {
      assert.equal(res.user.email, email);
      assert.equal(res.cleanTargetPath, '/admin');
    }
  }

  const subRouteRes = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin/produk',
    search: '?bypass=admin2@shansusdzar.com&admin123',
  });
  assert.equal(subRouteRes.active, true);
  assert.equal(subRouteRes.ok, true);
  if (subRouteRes.active && subRouteRes.ok) {
    assert.equal(subRouteRes.user.id, 'usr-katalog');
    assert.equal(subRouteRes.cleanTargetPath, '/admin/produk');
  }

  const wrongPasswordRes = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=admin1@shansusdzar.com&salah',
  });
  assert.equal(wrongPasswordRes.active, true);
  assert.equal(wrongPasswordRes.ok, false);

  const legacyEmailRes = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=admin@shansusdzar.id&sdi-admin-2026',
  });
  assert.equal(legacyEmailRes.active, true);
  assert.equal(legacyEmailRes.ok, false);

  const missingPassRes = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?bypass=admin1@shansusdzar.com',
  });
  assert.equal(missingPassRes.active, true);
  assert.equal(missingPassRes.ok, false);

  const noBypassRes = evaluateAdminBypassAttempt(DEFAULT_ADMIN_USERS, {
    pathname: '/admin',
    search: '?tab=ringkasan',
  });
  assert.equal(noBypassRes.active, false);
});

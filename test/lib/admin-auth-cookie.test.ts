import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_CREDENTIAL_COOKIE_NAME,
  buildAdminCredentialCookieString,
  parseAdminCredentialCookieHeader,
  serializeAdminCredentialCookieValue,
} from '../../src/lib/admin-auth-cookie';

test('parseAdminCredentialCookieHeader returns null when no credential cookie exists', () => {
  assert.equal(parseAdminCredentialCookieHeader(''), null);
  assert.equal(parseAdminCredentialCookieHeader('other_cookie=123; theme=dark'), null);
  assert.equal(
    parseAdminCredentialCookieHeader(`${ADMIN_CREDENTIAL_COOKIE_NAME}=invalid-json`),
    null
  );
});

test('buildAdminCredentialCookieString and parseAdminCredentialCookieHeader round-trip credentials', () => {
  const cookieStr = buildAdminCredentialCookieString(
    { email: '  Admin1@Shansusdzar.COM ', password: 'admin123' },
    { isSecure: false }
  );
  assert.ok(cookieStr.startsWith(`${ADMIN_CREDENTIAL_COOKIE_NAME}=`));
  assert.ok(cookieStr.includes('Path=/'));
  assert.ok(cookieStr.includes('SameSite=Lax'));

  const header = `foo=bar; ${cookieStr.split(';')[0]}; baz=1`;
  const parsed = parseAdminCredentialCookieHeader(header);
  assert.deepEqual(parsed, {
    email: 'admin1@shansusdzar.com',
    password: 'admin123',
  });
});

test('serializeAdminCredentialCookieValue normalizes email and rejects incomplete payloads', () => {
  const encoded = serializeAdminCredentialCookieValue({
    email: 'admin2@shansusdzar.com',
    password: '',
  });
  assert.equal(
    parseAdminCredentialCookieHeader(`${ADMIN_CREDENTIAL_COOKIE_NAME}=${encoded}`),
    null
  );
});

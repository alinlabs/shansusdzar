import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_USERS } from '../../../../../src/lib/cms-defaults';
import { createEmptyUser, normalizeUserPayload, validateUserDraft } from '../../../../../src/pages/admin/akses/pengguna/logic';

test('createEmptyUser defaults to non-owner user with all 9 pages set to hide and no status field', () => {
  const user = createEmptyUser();
  assert.equal(user.isOwner, false);
  assert.equal('status' in user, false);
  assert.equal(user.akses.length, 9);
  assert.ok(user.akses.every((rule) => rule.krendensial === 'hide'));
});

test('validateUserDraft catches missing fields and duplicate email', () => {
  const blank = createEmptyUser();
  const blankRes = validateUserDraft(blank, DEFAULT_ADMIN_USERS);
  assert.equal(blankRes.valid, false);
  assert.ok(blankRes.fieldErrors.nama);
  assert.ok(blankRes.fieldErrors.email);

  const duplicate = {
    ...createEmptyUser(),
    nama: 'Staf Baru',
    email: 'admin1@shansusdzar.com',
  };
  const dupRes = validateUserDraft(duplicate, DEFAULT_ADMIN_USERS);
  assert.equal(dupRes.valid, false);
  assert.ok(dupRes.fieldErrors.email);
});

test('normalizeUserPayload sanitizes 9-page access and enforces all-editor access for Owner', () => {
  const normalizedOwner = normalizeUserPayload({
    ...DEFAULT_ADMIN_USERS[0],
    nama: '  Hilman Aziz Napis ',
    email: ' ADMIN1@SHANSUSDZAR.COM ',
    akses: [{ halaman: 'proyek', krendensial: 'view' }],
  });
  assert.equal(normalizedOwner.nama, 'Hilman Aziz Napis');
  assert.equal(normalizedOwner.email, 'admin1@shansusdzar.com');
  assert.equal(normalizedOwner.isOwner, true);
  assert.equal(normalizedOwner.akses.length, 9);
  assert.ok(normalizedOwner.akses.every((rule) => rule.krendensial === 'editor'));

  const normalizedStaff = normalizeUserPayload({
    ...createEmptyUser(),
    nama: ' Rina ',
    email: 'admin5@shansusdzar.com',
    akses: [{ halaman: 'proyek', krendensial: 'view' }],
  });
  assert.equal(normalizedStaff.akses.length, 9);
  assert.equal(
    normalizedStaff.akses.find((rule) => rule.halaman === 'proyek')?.krendensial,
    'view'
  );
  assert.equal(
    normalizedStaff.akses.find((rule) => rule.halaman === 'keuangan')?.krendensial,
    'hide'
  );
});

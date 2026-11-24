import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG } from '../../lib/business-config';
import {
  getLocationContactActions,
  resolveOwnerPublicProfile,
  WORKING_PRINCIPLES_DRAFT,
} from './utils';

test('resolveOwnerPublicProfile keeps unapproved draft quote/name out of public display when unverified', () => {
  const profile = resolveOwnerPublicProfile({
    ...BUSINESS_CONFIG.drafPemilik,
    terverifikasi: false,
  });
  assert.equal(profile.status, 'unverified');
  assert.ok(profile.noticeTitle.includes('Menunggu Konfirmasi'));
});

test('resolveOwnerPublicProfile exposes Hilman Aziz Napis in default verified config', () => {
  const profile = resolveOwnerPublicProfile(BUSINESS_CONFIG.drafPemilik);
  assert.equal(profile.status, 'verified');
  if (profile.status === 'verified') {
    assert.equal(profile.name, 'Hilman Aziz Napis');
    assert.ok(profile.quote.length > 0);
  }
});

test('resolveOwnerPublicProfile exposes approved owner details when verified is true', () => {
  const profile = resolveOwnerPublicProfile(
    {
      terverifikasi: true,
      namaPemilik: 'Bapak Ahmad',
      jabatanPemilik: 'Pendiri Studio',
      kutipanPemilik: 'Kutipan resmi yang disetujui.',
      jalurFoto: '/images/owner-approved.webp',
      teksAltFoto: 'Foto resmi Bapak Ahmad',
    },
    'Biografi terverifikasi.'
  );

  assert.equal(profile.status, 'verified');
  if (profile.status === 'verified') {
    assert.equal(profile.name, 'Bapak Ahmad');
    assert.equal(profile.quote, 'Kutipan resmi yang disetujui.');
    assert.equal(profile.portraitPath, '/images/owner-approved.webp');
  }
});

test('getLocationContactActions preserves exact Shansus Dzar Indonesia address and WhatsApp target', () => {
  const actions = getLocationContactActions();
  assert.equal(
    actions.addressText,
    'Kp. Tegal Jati, RT 19/RW 10, Desa Cibogohilir, Kabupaten Purwakarta, 41162, Indonesia'
  );
  assert.equal(actions.whatsappDisplay, '+6281315000234');
  assert.ok(actions.whatsappUrl.startsWith('https://wa.me/6281315000234'));
  assert.ok(actions.mapsSearchUrl.includes(encodeURIComponent('Cibogohilir')));
});

test('WORKING_PRINCIPLES_DRAFT avoids fabricated counts or guarantees', () => {
  assert.equal(WORKING_PRINCIPLES_DRAFT.length, 4);
  for (const item of WORKING_PRINCIPLES_DRAFT) {
    assert.ok(!/garansi|100%|terbaik di indonesia/i.test(item.deskripsi));
  }
});

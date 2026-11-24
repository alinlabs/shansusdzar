import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG } from '../../lib/business-config';
import { DEFAULT_TENTANG_CONTENT } from '../../lib/cms-defaults';
import {
  getLocationContactActions,
  resolveOwnerPublicProfile,
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
    }
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
    'Kp. Tegal Jati, RT. 019/RW. 010, Desa Cibogohilir, Kecamatan Plered, Kabupaten Purwakarta, Jawa Barat - 41162'
  );
  assert.equal(actions.whatsappDisplay, '0813-15000-234');
  assert.ok(actions.whatsappUrl.startsWith('https://wa.me/6281315000234'));
  assert.ok(actions.mapsSearchUrl.includes(encodeURIComponent('Cibogohilir')));
});


test('DEFAULT_TENTANG_CONTENT exposes 6 default team members', () => {
  assert.equal(DEFAULT_TENTANG_CONTENT.anggotaTim.length, 6);
});

test('DEFAULT_TENTANG_CONTENT exposes 50+ Proyek, 9+ Tahun, and 6 Ahli Tim Profesional workshop highlights', () => {
  const highlights = DEFAULT_TENTANG_CONTENT.sorotanWorkshop;
  assert.equal(highlights.length, 4);
  assert.ok(highlights.some((item) => item.nilai === '50+ Proyek'));
  assert.ok(highlights.some((item) => item.nilai === '9+ Tahun'));
  assert.ok(highlights.some((item) => item.label === 'Tim Profesional' && item.nilai === '6 Ahli'));
  assert.ok(
    !highlights.some(
      (item) =>
        item.id === 'hl-material' ||
        item.id === 'hl-finishing' ||
        item.id === 'hl-workshop' ||
        /450\s*m/i.test(item.nilai)
    )
  );
});

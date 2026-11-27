import test from 'node:test';
import assert from 'node:assert/strict';
import siteProfileJson from '../../../src/data/bisnis.json';
import { BUSINESS_CONFIG } from '../../../src/lib/business-config';
import {
  DEFAULT_BERANDA_CONTENT,
  DEFAULT_OPERATIONAL_INFO,
  DEFAULT_TENTANG_CONTENT,
} from '../../../src/lib/cms-defaults';
import {
  TENTANG_STATIC_HEADINGS,
  getLocationContactActions,
  resolveOwnerPublicProfile,
} from '../../../src/pages/tentang/utils';

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

test('unified bisnis.json consolidates profilUsaha, tentang, beranda (with mediaHero), operasional without duplicate or static keys', () => {
  assert.ok('profilUsaha' in siteProfileJson);
  assert.ok('tentang' in siteProfileJson);
  assert.ok('beranda' in siteProfileJson);
  assert.ok('operasional' in siteProfileJson);
  assert.ok(siteProfileJson.beranda.mediaHero?.sumberVideo);
  assert.ok(siteProfileJson.beranda.mediaHero?.sumberGambar);
  assert.equal('namaMerekSingkat' in BUSINESS_CONFIG, false);
  assert.equal(BUSINESS_CONFIG.namaMerek, 'Shansus Dzar Indonesia');

  const tentangRecord = siteProfileJson.tentang as Record<string, unknown>;
  for (const key of ['labelAtas', 'judul', 'labelLokasi', 'judulLokasi', 'judulMisi', 'labelTim', 'judulTim']) {
    assert.equal(key in tentangRecord, false, `Expected static key ${key} to be removed from JSON`);
  }

  assert.equal(TENTANG_STATIC_HEADINGS.introEyebrow, 'Tentang Kami');
  assert.equal(TENTANG_STATIC_HEADINGS.missionTitle, 'Misi Pengerjaan & Pelayanan');
  assert.equal(TENTANG_STATIC_HEADINGS.teamEyebrow, 'Tim & Workshop');
  assert.equal(TENTANG_STATIC_HEADINGS.teamTitle, 'Orang-Orang di Balik Setiap Pengerjaan');
  assert.equal(TENTANG_STATIC_HEADINGS.locationEyebrow, 'Lokasi & Kontak');
  assert.equal(TENTANG_STATIC_HEADINGS.locationTitle, 'Berbasis di Purwakarta, Jawa Barat');
  assert.ok(DEFAULT_BERANDA_CONTENT.judulHero.length > 0);
  assert.ok(DEFAULT_BERANDA_CONTENT.mediaHero?.sumberVideo);
  assert.ok(DEFAULT_BERANDA_CONTENT.mediaHero?.sumberGambar);
  assert.ok(DEFAULT_OPERATIONAL_INFO.jamOperasional.length > 0);
});

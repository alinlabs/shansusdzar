import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertPublicProfileContact } from './marketing-store';
import {
  appendProfileToWhatsAppMessage,
  buildSurveyRequestWhatsAppMessage,
  extractCityFromAddress,
  isUserProfileComplete,
  resolveProfileModalCopy,
  resolveSafeInternalRedirect,
  sanitizeUserProfile,
  useUserProfileStore,
} from './user-profile-store';

test('resolveProfileModalCopy returns distinct contextual Indonesian copy for pesanan, survei, and general', () => {
  const orderCreate = resolveProfileModalCopy({ intent: 'pesanan' }, false);
  assert.equal(orderCreate.title, 'Data Pemesan');
  assert.equal(orderCreate.description, undefined);
  assert.match(orderCreate.submitLabel, /Lanjutkan/);

  const orderEdit = resolveProfileModalCopy({ intent: 'pesanan' }, true);
  assert.equal(orderEdit.title, 'Ubah Data Pemesan');
  assert.equal(orderEdit.submitLabel, 'Simpan Perubahan');

  const survey = resolveProfileModalCopy({ intent: 'survei' }, false);
  assert.equal(survey.title, 'Data Pemesan');
  assert.equal(survey.description, undefined);
  assert.equal(survey.submitLabel, 'Simpan & Lanjut');

  const general = resolveProfileModalCopy({ intent: 'general' }, false);
  assert.equal(general.title, 'Data Pengguna');
});

test('sanitizeUserProfile safely defaults malformed inputs', () => {
  const empty = sanitizeUserProfile(null);
  assert.equal(empty.fullName, '');
  assert.equal(empty.phone, '');
  assert.equal(empty.address, '');
  assert.equal(empty.coordinates, null);
  assert.ok(empty.profileId.length > 0);
});

test('isUserProfileComplete validates name, Indonesian phone, and address length', () => {
  assert.equal(
    isUserProfileComplete({
      fullName: 'Budi Santoso',
      phone: '081234567890',
      address: 'Jl. Veteran No. 12, Purwakarta',
    }),
    true
  );

  assert.equal(
    isUserProfileComplete({
      fullName: 'B',
      phone: '081234567890',
      address: 'Jl. Veteran No. 12, Purwakarta',
    }),
    false
  );

  assert.equal(
    isUserProfileComplete({
      fullName: 'Budi Santoso',
      phone: '123',
      address: 'Jl. Veteran No. 12, Purwakarta',
    }),
    false
  );

  assert.equal(
    isUserProfileComplete({
      fullName: 'Budi Santoso',
      phone: '081234567890',
      address: 'Pendek',
    }),
    false
  );
});

test('extractCityFromAddress identifies known cities or falls back cleanly', () => {
  assert.equal(extractCityFromAddress('Jl. K.K. Singawinata No. 88, Kab. Purwakarta'), 'Purwakarta');
  assert.equal(extractCityFromAddress('Perum Galuh Mas Blok A, Karawang Barat'), 'Karawang');
  assert.equal(extractCityFromAddress('Jl. Merdeka No. 10, Cirebon'), 'Cirebon');
  assert.equal(extractCityFromAddress('Rumah dekat taman kota'), 'Purwakarta');
});

test('resolveSafeInternalRedirect blocks external URLs, protocol-relative URLs, and self-loops', () => {
  assert.equal(resolveSafeInternalRedirect('/pesanan'), '/pesanan');
  assert.equal(resolveSafeInternalRedirect('/produk/custom?produk=kitchen-set'), '/produk/custom?produk=kitchen-set');
  assert.equal(resolveSafeInternalRedirect('https://evil.example'), null);
  assert.equal(resolveSafeInternalRedirect('//evil.example'), null);
  assert.equal(resolveSafeInternalRedirect('/profil'), null);
  assert.equal(resolveSafeInternalRedirect('/akun'), null);
  assert.equal(resolveSafeInternalRedirect('/pengaturan'), null);
});

test('buildSurveyRequestWhatsAppMessage and appendProfileToWhatsAppMessage include profile fields', () => {
  const profile = sanitizeUserProfile({
    profileId: 'prof123',
    fullName: 'Rina Kusuma',
    phone: '081299887766',
    normalizedPhone: '+6281299887766',
    address: 'Jl. Basuki Rahmat No. 14, Purwakarta',
    coordinates: {
      latitude: -6.5569,
      longitude: 107.4439,
      accuracyMeters: 15,
      capturedAtIso: '2026-11-23T10:00:00.000Z',
    },
    updatedAt: '2026-11-23T10:00:00.000Z',
  });

  const surveyMsg = buildSurveyRequestWhatsAppMessage({
    brandName: 'Shansus Dzar Indonesia',
    profile,
    surveyDateIso: '2026-11-28',
    surveyNotes: 'Kitchen set letter L',
  });
  assert.match(surveyMsg, /Rina Kusuma/);
  assert.match(surveyMsg, /\+6281299887766/);
  assert.match(surveyMsg, /Jl\. Basuki Rahmat No\. 14, Purwakarta/);
  assert.match(surveyMsg, /-6\.556900, 107\.443900/);
  assert.match(surveyMsg, /Detail Permintaan Survei:/);
  assert.match(surveyMsg, /- Tanggal Survei: 28 November 2026/);
  assert.match(surveyMsg, /- Catatan: Kitchen set letter L/);

  const appended = appendProfileToWhatsAppMessage('Halo Studio, saya mau tanya kitchen set.', profile);
  assert.match(appended, /Data Pemesan:/);
  assert.match(appended, /Rina Kusuma/);
});

test('requestSurvey opens profile modal first when incomplete, and opens survey modal directly when complete', () => {
  const store = useUserProfileStore.getState();
  store.clearProfile();
  store.closeProfileModal();
  store.closeSurveyModal();

  // Stage 1 when profile is incomplete
  store.requestSurvey({
    surveyContextLabel: 'Konteks survei test',
    surveyActivityNote: 'Catatan aktivitas test',
  });
  let state = useUserProfileStore.getState();
  assert.equal(state.surveyModalRequest, null);
  assert.equal(state.modalRequest?.intent, 'survei');
  assert.equal(state.modalRequest?.surveyContextLabel, 'Konteks survei test');

  // Save profile -> now complete
  const saveResult = state.saveProfile({
    fullName: 'Dewi Anggraini',
    phone: '081234567890',
    address: 'Jl. Ibrahim Singadilaga No. 22, Purwakarta',
    coordinates: null,
  });
  assert.equal(saveResult.ok, true);

  // Stage 2 directly when profile is already complete
  useUserProfileStore.getState().requestSurvey({
    surveyContextLabel: 'Konteks survei kedua',
    surveyActivityNote: 'Aktivitas kedua',
  });
  state = useUserProfileStore.getState();
  assert.equal(state.modalRequest, null);
  assert.equal(state.surveyModalRequest?.surveyContextLabel, 'Konteks survei kedua');

  useUserProfileStore.getState().closeSurveyModal();
  useUserProfileStore.getState().clearProfile();
});

test('upsertPublicProfileContact creates and updates admin marketing contact without duplicates', () => {
  const initial = upsertPublicProfileContact([], {
    profileId: 'abc123',
    fullName: 'Andi Wijaya',
    phone: '+6281311223344',
    normalizedPhoneDigits: '6281311223344',
    city: 'Karawang',
    address: 'Jl. Tuparev No. 9, Karawang',
    tags: ['profil-user'],
    activityNote: 'Menyimpan profil pelanggan via web',
    nowIso: '2026-11-23T10:00:00.000Z',
  });

  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'mkt-usr-abc123');
  assert.equal(initial[0].sumber, 'Form Pesanan Web');
  assert.equal(initial[0].kota, 'Karawang');
  assert.equal(initial[0].izinWhatsapp, true);

  const updated = upsertPublicProfileContact(initial, {
    profileId: 'abc123',
    fullName: 'Andi Wijaya Baru',
    phone: '+6281311223344',
    normalizedPhoneDigits: '6281311223344',
    city: 'Purwakarta',
    address: 'Jl. Veteran No. 45, Purwakarta',
    tags: ['profil-user', 'request-survei'],
    activityNote: 'Mengajukan request survei lokasi',
    nowIso: '2026-11-23T11:00:00.000Z',
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].nama, 'Andi Wijaya Baru');
  assert.equal(updated[0].kota, 'Purwakarta');
  assert.ok(updated[0].labelTag.includes('request-survei'));
  assert.match(updated[0].catatan, /Mengajukan request survei lokasi/);
});

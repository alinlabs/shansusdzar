import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computePortfolioAreaSqm,
  createEmptyPortfolioDraft,
  getPortfolioSlug,
  normalizePortfolioFromDraft,
  toPortfolioFormDraft,
  validatePortfolioDraft,
} from '../../../../../src/pages/admin/portofolio/proyek/logic';

test('validatePortfolioDraft catches missing required fields and title slug collisions', () => {
  const draft = createEmptyPortfolioDraft([]);
  assert.equal(draft.id, 'port-001');

  const invalid = validatePortfolioDraft(draft);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.deskripsi);

  const existing = [
    normalizePortfolioFromDraft({
      ...draft,
      id: 'port-001',
      judul: 'Kitchen Set Purwakarta',
      deskripsi: 'Renovasi dapur modern.',
    }),
  ];

  const colliding = validatePortfolioDraft(
    {
      ...createEmptyPortfolioDraft(existing),
      judul: 'Kitchen Set Purwakarta!',
      deskripsi: 'Duplikat slug.',
    },
    existing
  );
  assert.equal(colliding.valid, false);
  assert.ok(colliding.fieldErrors.judul);

  const valid = validatePortfolioDraft(
    {
      ...createEmptyPortfolioDraft(existing),
      judul: 'Wardrobe Karawang',
      deskripsi: 'Lemari kamar utama.',
    },
    existing
  );
  assert.equal(valid.valid, true);
});

test('normalizePortfolioFromDraft normalizes dimensi array, derives slug from judul, and parses multiline fields', () => {
  const draft = {
    ...createEmptyPortfolioDraft(2),
    id: 'port-002',
    produkId: 'katalog-lemari-pakaian-03',
    judul: 'Wardrobe Minimalis',
    dimensi: [{ panjang: 200, lebar: 60, tinggi: 220 }],
    deskripsi: 'Lemari panel rata 3 pintu.',
    materialsText: 'Multipleks\nHPL',
    galleryText: '/img1.webp\n/img2.webp',
  };

  const normalized = normalizePortfolioFromDraft(draft);
  assert.equal(normalized.id, 'port-002');
  assert.equal(normalized.produkId, 'katalog-lemari-pakaian-03');
  assert.equal(getPortfolioSlug(normalized), 'wardrobe-minimalis');
  assert.equal(computePortfolioAreaSqm(normalized.dimensi), 4.4);
  assert.deepEqual(normalized.materialDigunakan, ['Multipleks', 'HPL']);
  assert.deepEqual(normalized.galeriGambar, ['/img1.webp', '/img2.webp']);
  assert.equal('slug' in normalized, false);
  assert.equal('terbit' in normalized, false);
  assert.equal('urutan' in normalized, false);
  assert.equal('luasMeterPersegi' in normalized, false);

  const roundTrip = toPortfolioFormDraft(normalized);
  assert.equal(roundTrip.materialsText, 'Multipleks\nHPL');
  assert.equal(roundTrip.ulasanAktif, false);
});

test('validatePortfolioDraft enforces review fields only when ulasanAktif is enabled', () => {
  const base = {
    ...createEmptyPortfolioDraft(3),
    judul: 'Credenza Minimalis Bandung',
    deskripsi: 'Credenza ruang keluarga finishing HPL.',
  };

  assert.equal(validatePortfolioDraft(base).valid, true);

  const missingReviewInfo = validatePortfolioDraft({
    ...base,
    ulasanAktif: true,
    ulasanSapaan: 'Ibu',
    ulasanKlien: '',
    ulasanKomentar: '',
  });
  assert.equal(missingReviewInfo.valid, false);
  assert.ok(missingReviewInfo.fieldErrors.ulasanKlien);
  assert.ok(missingReviewInfo.fieldErrors.ulasanKomentar);

  const validWithReview = validatePortfolioDraft({
    ...base,
    ulasanAktif: true,
    ulasanSapaan: 'Ibu',
    ulasanKlien: 'Nadia Kusuma',
    ulasanPenilaian: 5,
    ulasanKomentar: 'Rapi dan sesuai ukuran ruang keluarga kami.',
  });
  assert.equal(validWithReview.valid, true);
});

test('normalizePortfolioFromDraft stores ulasan { sapaan, klien, penilaian, komentar } without namaKlien and round-trips cleanly', () => {
  const draft = {
    ...createEmptyPortfolioDraft(4),
    id: 'port-004',
    judul: 'Kabinet Kerja Bekasi',
    deskripsi: 'Meja kerja dan rak arsip custom.',
    ulasanAktif: true,
    ulasanSapaan: 'tn.',
    ulasanKlien: '  Dimas Saputra  ',
    ulasanPenilaian: 8,
    ulasanKomentar: '  Konsultasi mudah dan hasil pemasangan rapi.  ',
  };

  const normalized = normalizePortfolioFromDraft(draft);
  assert.equal('namaKlien' in normalized, false);
  assert.ok(normalized.ulasan);
  assert.equal(normalized.ulasan?.sapaan, 'Tn.');
  assert.equal(normalized.ulasan?.klien, 'Dimas Saputra');
  assert.equal(normalized.ulasan?.penilaian, 5);
  assert.equal(normalized.ulasan?.komentar, 'Konsultasi mudah dan hasil pemasangan rapi.');
  assert.equal('tampil' in normalized.ulasan, false);
  assert.equal('inisial' in normalized.ulasan, false);
  assert.equal('namaPengulas' in normalized.ulasan, false);

  const roundTrip = toPortfolioFormDraft(normalized);
  assert.equal(roundTrip.ulasanAktif, true);
  assert.equal(roundTrip.ulasanSapaan, 'Tn.');
  assert.equal(roundTrip.ulasanKlien, 'Dimas Saputra');
});

test('normalizePortfolioFromDraft and validatePortfolioDraft handle referensiHarga cleanly', () => {
  const base = {
    ...createEmptyPortfolioDraft(5),
    id: 'port-005',
    judul: 'Kitchen Set Premium Karawang',
    deskripsi: 'Kitchen set lengkap finishing HPL matte.',
  };

  const negativePrice = validatePortfolioDraft({
    ...base,
    referensiHarga: -500000,
  });
  assert.equal(negativePrice.valid, false);
  assert.ok(negativePrice.fieldErrors.referensiHarga);

  const normalizedValid = normalizePortfolioFromDraft({
    ...base,
    referensiHarga: 14500000.4,
  });
  assert.equal(normalizedValid.referensiHarga, 14500000);
  assert.equal(toPortfolioFormDraft(normalizedValid).referensiHarga, 14500000);

  const normalizedZero = normalizePortfolioFromDraft({ ...base, referensiHarga: 0 });
  assert.equal(normalizedZero.referensiHarga, null);
});

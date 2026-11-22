import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyPortfolioDraft,
  normalizePortfolioFromDraft,
  toPortfolioFormDraft,
  validatePortfolioDraft,
} from './logic';

test('validatePortfolioDraft catches missing required fields', () => {
  const draft = createEmptyPortfolioDraft(1);
  const invalid = validatePortfolioDraft(draft);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.deskripsi);

  const valid = validatePortfolioDraft({
    ...draft,
    judul: 'Kitchen Set Purwakarta',
    deskripsi: 'Renovasi dapur modern.',
  });
  assert.equal(valid.valid, true);
});

test('normalizePortfolioFromDraft deduplicates slugs and parses multiline fields', () => {
  const draft = {
    ...createEmptyPortfolioDraft(2),
    id: 'pf-new',
    judul: 'Wardrobe Minimalis',
    slug: 'wardrobe-minimalis',
    deskripsi: 'Lemari panel rata 3 pintu.',
    materialsText: 'Multipleks\nHPL',
    galleryText: '/img1.webp\n/img2.webp',
  };
  const existing = [
    {
      ...normalizePortfolioFromDraft({ ...draft, id: 'pf-other' }, []),
    },
  ];
  const normalized = normalizePortfolioFromDraft(draft, existing);
  assert.notEqual(normalized.slug, 'wardrobe-minimalis');
  assert.deepEqual(normalized.materialDigunakan, ['Multipleks', 'HPL']);
  assert.deepEqual(normalized.galeriGambar, ['/img1.webp', '/img2.webp']);

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
    ulasanNamaPengulas: '',
    ulasanKomentar: '',
  });
  assert.equal(missingReviewInfo.valid, false);
  assert.ok(missingReviewInfo.fieldErrors.ulasanNamaPengulas);
  assert.ok(missingReviewInfo.fieldErrors.ulasanKomentar);

  const validWithReview = validatePortfolioDraft({
    ...base,
    ulasanAktif: true,
    ulasanNamaPengulas: 'Nadia Kusuma',
    ulasanPenilaian: 5,
    ulasanKomentar: 'Rapi dan sesuai ukuran ruang keluarga kami.',
  });
  assert.equal(validWithReview.valid, true);
});

test('normalizePortfolioFromDraft normalizes embedded review, auto-derives initials, and round-trips', () => {
  const draft = {
    ...createEmptyPortfolioDraft(4),
    id: 'pf-with-review',
    judul: 'Kabinet Kerja Bekasi',
    deskripsi: 'Meja kerja dan rak arsip custom.',
    ulasanAktif: true,
    ulasanNamaPengulas: '  Dimas Saputra  ',
    ulasanInisial: '',
    ulasanPenilaian: 8,
    ulasanKomentar: '  Konsultasi mudah dan hasil pemasangan rapi.  ',
  };

  const normalized = normalizePortfolioFromDraft(draft, []);
  assert.ok(normalized.ulasan);
  assert.equal(normalized.ulasan?.tampil, true);
  assert.equal(normalized.ulasan?.namaPengulas, 'Dimas Saputra');
  assert.equal(normalized.ulasan?.inisial, 'DS');
  assert.equal(normalized.ulasan?.penilaian, 5);
  assert.equal(normalized.ulasan?.komentar, 'Konsultasi mudah dan hasil pemasangan rapi.');

  const roundTrip = toPortfolioFormDraft(normalized);
  assert.equal(roundTrip.ulasanAktif, true);
  assert.equal(roundTrip.ulasanNamaPengulas, 'Dimas Saputra');
  assert.equal(roundTrip.ulasanInisial, 'DS');
});

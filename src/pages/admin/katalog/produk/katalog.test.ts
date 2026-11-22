import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyProductDraft,
  normalizeProductFromDraft,
  slugifyProduct,
  toProductFormDraft,
  validateProductDraft,
} from './logic';

test('slugifyProduct strips symbols, trims whitespace, and converts spaces to hyphens', () => {
  assert.equal(slugifyProduct('  Kabinet Dapur & Pantry! '), 'kabinet-dapur-pantry');
  assert.equal(slugifyProduct('  Meja Kerja / Belajar (Custom)  '), 'meja-kerja-belajar-custom');
});

test('validateProductDraft checks required fields, derived slug uniqueness, multi-size referensiUkuran format, promo format, and positive tariff', () => {
  const empty = createEmptyProductDraft(3);
  const res1 = validateProductDraft(empty, []);
  assert.equal(res1.valid, false);
  assert.ok(res1.fieldErrors.name);
  assert.ok(res1.fieldErrors.shortDescription);

  const badSizeDraft = {
    ...empty,
    name: 'Kabinet Minimalis',
    category: 'Dapur & Kabinet',
    shortDescription: 'Kabinet dapur custom HPL.',
    referensiUkuranText: 'ukuran bebas',
  };
  const resSizeErr = validateProductDraft(badSizeDraft, []);
  assert.equal(resSizeErr.valid, false);
  assert.ok(resSizeErr.fieldErrors.referensiUkuranText);

  const zeroRateDraft = {
    ...badSizeDraft,
    referensiUkuranText: '200x300, 250x300',
    rateHplBlockboard: 0,
    rateHplMultipleks: 0,
    rateHplPvc: 0,
    rateDucoBlockboard: 0,
    rateDucoMultipleks: 0,
    rateDucoPvc: 0,
  };
  const resRateErr = validateProductDraft(zeroRateDraft, []);
  assert.equal(resRateErr.valid, false);
  assert.ok(resRateErr.fieldErrors.rateHplBlockboard);

  const badPromoDraft = {
    ...badSizeDraft,
    referensiUkuranText: '200x300, 250x300',
    promo: 'diskon besar',
  };
  const resPromoErr = validateProductDraft(badPromoDraft, []);
  assert.equal(resPromoErr.valid, false);
  assert.ok(resPromoErr.fieldErrors.promo);

  const existing = normalizeProductFromDraft({
    ...badSizeDraft,
    id: 'prod-existing',
    referensiUkuranText: '200x300',
  });
  const duplicateNameRes = validateProductDraft(
    {
      ...badSizeDraft,
      id: 'prod-other',
      name: 'Kabinet & Minimalis!',
      referensiUkuranText: '200x300',
    },
    [existing]
  );
  assert.equal(duplicateNameRes.valid, false);
  assert.ok(duplicateNameRes.fieldErrors.name);

  const validPct = validateProductDraft(
    {
      ...badSizeDraft,
      referensiUkuranText: '200x300, 250x300',
      promo: '10%',
    },
    []
  );
  assert.equal(validPct.valid, true);

  const validNominal = validateProductDraft(
    {
      ...badSizeDraft,
      referensiUkuranText: '200x300, 250x300',
      promo: '250000',
    },
    []
  );
  assert.equal(validNominal.valid, true);
});

test('normalizeProductFromDraft emits clean ProductItem fields without legacy properties or unggulan and round-trips cleanly', () => {
  const draft = {
    ...createEmptyProductDraft(2),
    name: 'Lemari Sliding (Minimalis)!',
    shortDescription: 'Lemari panel rata hemat ruang.',
    referensiUkuranText: '200x300, 250x300, 200x300',
    meterLari: true,
    rateHplBlockboard: 2500000,
    rateHplMultipleks: 0,
    rateHplPvc: 3500000,
    rateDucoBlockboard: 4500000,
    rateDucoMultipleks: 4500000,
    rateDucoPvc: 4500000,
    promo: '15%',
    gambarSampul: '/cover.webp',
    model3d: 'https://cdn.example.com/lemari-sliding.glb',
    mediaText: '/hero.webm\n  /a.webp \nhttps://youtu.be/dQw4w9WgXcQ\n/b.webp',
    customisasiItems: ['Lurus (Straight)', 'Sudut (L-Shape)', '  '],
    includeItems: ['Engsel soft-close', 'Rak dalam custom', 'Engsel soft-close'],
  };

  const normalized = normalizeProductFromDraft(draft);
  assert.equal(normalized.slug, 'lemari-sliding-minimalis');
  assert.equal(normalized.meterLari, true);
  assert.equal(normalized.promo, '15%');
  assert.deepEqual(normalized.referensiUkuran, ['200x300', '250x300']);
  assert.deepEqual(normalized.harga, {
    hpl: { blockboard: 2500000, pvc: 3500000 },
    duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
  });
  assert.equal(normalized.gambarSampul, '/cover.webp');
  assert.equal(normalized['3d'], 'https://cdn.example.com/lemari-sliding.glb');
  assert.deepEqual(normalized.media, [
    '/hero.webm',
    '/a.webp',
    'https://youtu.be/dQw4w9WgXcQ',
    '/b.webp',
  ]);
  assert.deepEqual(normalized.customisasi, ['Lurus (Straight)', 'Sudut (L-Shape)']);
  assert.deepEqual(normalized.include, ['Engsel soft-close', 'Rak dalam custom']);

  assert.equal('unggulan' in normalized, false);
  assert.equal('daftarGambar' in normalized, false);
  assert.equal('daftarVideo' in normalized, false);
  assert.equal('satuanTarif' in normalized, false);
  assert.equal('opsiKustom' in normalized, false);
  assert.equal('opsiTambahan' in normalized, false);
  assert.equal('tarifSatuan' in normalized, false);
  assert.equal('hargaMulai' in normalized, false);
  assert.equal('statusHarga' in normalized, false);
  assert.equal('ketersediaan' in normalized, false);
  assert.equal('urutan' in normalized, false);
  assert.equal('daftarMaterial' in normalized, false);
  assert.equal('dimensi' in normalized, false);
  assert.equal('produkContoh' in normalized, false);

  const roundTrip = toProductFormDraft(normalized);
  assert.equal(roundTrip.meterLari, true);
  assert.equal(roundTrip.promo, '15%');
  assert.equal(roundTrip.referensiUkuranText, '200x300, 250x300');
  assert.equal(roundTrip.rateHplBlockboard, 2500000);
  assert.equal(roundTrip.rateHplMultipleks, 0);
  assert.equal(roundTrip.rateHplPvc, 3500000);
  assert.equal(roundTrip.rateDucoBlockboard, 4500000);
  assert.equal(roundTrip.rateDucoMultipleks, 4500000);
  assert.equal(roundTrip.rateDucoPvc, 4500000);
  assert.equal(roundTrip.gambarSampul, '/cover.webp');
  assert.equal(roundTrip.model3d, 'https://cdn.example.com/lemari-sliding.glb');
  assert.equal(roundTrip.mediaText, '/hero.webm\n/a.webp\nhttps://youtu.be/dQw4w9WgXcQ\n/b.webp');
  assert.deepEqual(roundTrip.customisasiItems, ['Lurus (Straight)', 'Sudut (L-Shape)']);
  assert.deepEqual(roundTrip.includeItems, ['Engsel soft-close', 'Rak dalam custom']);

  const emptyImgNormalized = normalizeProductFromDraft({
    ...draft,
    promo: '  ',
    gambarSampul: '   ',
    model3d: '   ',
    mediaText: '   ',
  });
  assert.equal(emptyImgNormalized.promo, undefined);
  assert.equal(emptyImgNormalized.gambarSampul, undefined);
  assert.equal(emptyImgNormalized['3d'], undefined);
  assert.deepEqual(emptyImgNormalized.media, []);
});

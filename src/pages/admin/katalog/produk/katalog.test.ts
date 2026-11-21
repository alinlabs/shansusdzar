import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyProductDraft,
  normalizeProductFromDraft,
  slugifyProduct,
  toProductFormDraft,
  validateProductDraft,
} from './logic';

test('slugifyProduct normalizes spaces and punctuation cleanly', () => {
  assert.equal(slugifyProduct('  Kabinet Dapur & Pantry! '), 'kabinet-dapur-pantry');
});

test('validateProductDraft checks required fields, duplicate slug, and pricing mode', () => {
  const empty = createEmptyProductDraft(3);
  const res1 = validateProductDraft(empty, []);
  assert.equal(res1.valid, false);
  assert.ok(res1.fieldErrors.name);
  assert.ok(res1.fieldErrors.shortDescription);

  const validDraft = {
    ...empty,
    name: 'Kabinet Minimalis',
    slug: 'kabinet-minimalis',
    category: 'Dapur & Kabinet',
    shortDescription: 'Kabinet dapur custom HPL.',
    linkCustomPricing: false,
    priceStatus: 'tetap' as const,
    price: 0,
  };
  const resPriceErr = validateProductDraft(validDraft, []);
  assert.equal(resPriceErr.valid, false);
  assert.ok(resPriceErr.fieldErrors.price);

  const okFixed = validateProductDraft({ ...validDraft, price: 4500000 }, []);
  assert.equal(okFixed.valid, true);

  const okLinked = validateProductDraft(
    { ...empty, name: 'Kabinet Minimalis', slug: 'kabinet-minimalis', shortDescription: 'Kabinet custom.' },
    []
  );
  assert.equal(okLinked.valid, true);
});

test('normalizeProductFromDraft converts draft textareas and converts back via toProductFormDraft', () => {
  const draft = {
    ...createEmptyProductDraft(2),
    name: 'Lemari Sliding',
    slug: 'lemari-sliding',
    shortDescription: 'Lemari panel rata hemat ruang.',
    linkCustomPricing: false,
    priceStatus: 'mulai' as const,
    priceFrom: 6200000,
    widthCm: 180,
    depthCm: 60,
    heightCm: 240,
    imagesText: '/a.webp\n  /b.webp ',
    videosText: '/hero.webm\nhttps://youtu.be/dQw4w9WgXcQ',
    materialsText: 'Multipleks\nHPL',
  };
  const normalized = normalizeProductFromDraft(draft);
  assert.equal(normalized.harga, null);
  assert.equal(normalized.hargaMulai, 6200000);
  assert.equal(normalized.kaitkanHargaCustom, false);
  assert.deepEqual(normalized.daftarGambar, ['/a.webp', '/b.webp']);
  assert.deepEqual(normalized.daftarVideo, [
    { url: '/hero.webm' },
    { url: 'https://youtu.be/dQw4w9WgXcQ' },
  ]);
  assert.deepEqual(normalized.daftarMaterial, ['Multipleks', 'HPL']);

  const roundTrip = toProductFormDraft(normalized);
  assert.equal(roundTrip.widthCm, 180);
  assert.equal(roundTrip.priceFrom, 6200000);
  assert.equal(roundTrip.linkCustomPricing, false);
  assert.equal(roundTrip.videosText, '/hero.webm\nhttps://youtu.be/dQw4w9WgXcQ');

  const linkedNormalized = normalizeProductFromDraft({
    ...createEmptyProductDraft(5),
    name: 'Partisi Kisi',
    slug: 'partisi-kisi',
    shortDescription: 'Partisi kayu custom.',
    dimensionPresetsText: '2×3 m',
  });
  assert.equal(linkedNormalized.kaitkanHargaCustom, true);
  assert.equal(linkedNormalized.promoAktif, true);
  assert.equal(linkedNormalized.statusHarga, 'mulai');
  assert.equal(linkedNormalized.hargaMulai, 6 * 1350000);
  assert.equal(linkedNormalized.hargaMulaiSebelumPromo, 6 * 1650000);

  const manualPromoNormalized = normalizeProductFromDraft({
    ...draft,
    promoActive: true,
    priceFromBeforePromo: 7500000,
  });
  assert.equal(manualPromoNormalized.hargaMulaiSebelumPromo, 7500000);
  assert.equal(toProductFormDraft(manualPromoNormalized).priceFromBeforePromo, 7500000);

  const emptyImgNormalized = normalizeProductFromDraft({
    ...draft,
    imagesText: '   ',
    videosText: '   ',
  });
  assert.deepEqual(emptyImgNormalized.daftarGambar, []);
  assert.equal(emptyImgNormalized.daftarVideo, undefined);
});

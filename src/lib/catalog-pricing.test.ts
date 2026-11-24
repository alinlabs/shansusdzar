import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
} from './custom-pricing';
import {
  calculateCatalogVariantPrice,
  getAvailableFinishIdsFromTariff,
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialIdsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  getDefaultProductDimensionsCm,
  mapOptionLabelToFinishId,
  mapOptionLabelToMaterialId,
  parseProductPromo,
  resolveCatalogStartingPrice,
  resolveProductPromoMarkup,
} from './catalog-pricing';
import type { CustomInteriorPricingConfig } from '../types/cms';
import type { ProductItem } from '../types/product';

const SAMPLE_KITCHEN: ProductItem = {
  id: 'katalog-kitchen-set-01',
  slug: 'kitchen-set-kabinet-atas-bawah',
  nama: 'Kitchen set (kabinet atas & bawah)',
  kategori: 'Dapur & Bar',
  deskripsiSingkat: 'Sistem kabinet dapur atas dan bawah.',
  gambarSampul: '',
  media: [],
  pilihanWarna: [{ id: 'gading', nama: 'Gading Hangat', hex: '#EAE5DC' }],
  referensiUkuran: ['200x60', '250x60', '300x60'],
  harga: {
    hpl: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
    duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
  },
  customisasi: ['Lurus (Straight)', 'Sudut (L-Shape)'],
  include: [],
};

const SAMPLE_PARTISI: ProductItem = {
  ...SAMPLE_KITCHEN,
  id: 'katalog-partisi-01',
  slug: 'partisi-ruangan-kisi',
  nama: 'Sekat Ruangan / Partisi Minimalis',
  kategori: 'Ruang Tamu',
  referensiUkuran: ['200x240', '250x240'],
  harga: {
    hpl: { blockboard: 2500000, multipleks: 2500000, pvc: 3500000 },
    duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
  },
};

const SITE_PRICING: CustomInteriorPricingConfig = {
  hargaCustomTerkonfigurasi: INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi,
  persentaseDp: INDICATIVE_ESTIMATE_CONFIG.persentaseDp ?? 30,
  rules: structuredClone(INDICATIVE_WORKSHOP_ESTIMATE_RULES),
};

test('getDefaultProductDimensionsCm resolves recommended dimensions directly from first referensiUkuran', () => {
  assert.deepEqual(getDefaultProductDimensionsCm(SAMPLE_KITCHEN), {
    lengthCm: 200,
    widthCm: 60,
    lengthMeters: 2,
    areaSqm: 1.2,
  });
  assert.deepEqual(getDefaultProductDimensionsCm(SAMPLE_PARTISI), {
    lengthCm: 200,
    widthCm: 240,
    lengthMeters: 2,
    areaSqm: 4.8,
  });
});

test('option mapping and tariff helpers derive materials and finishes directly from harga', () => {
  assert.equal(mapOptionLabelToMaterialId('Blockboard'), 'blockboard');
  assert.equal(mapOptionLabelToMaterialId('Multipleks'), 'multipleks');
  assert.equal(mapOptionLabelToMaterialId('PVC Board'), 'pvc');
  assert.equal(mapOptionLabelToMaterialId('MDF'), null);
  assert.equal(mapOptionLabelToFinishId('HPL'), 'hpl');
  assert.equal(mapOptionLabelToFinishId('Cat Duco'), 'cat-duco');
  assert.equal(mapOptionLabelToFinishId('Taco Sheet'), null);

  assert.deepEqual(getAvailableMaterialIdsFromTariff(SAMPLE_KITCHEN), [
    'blockboard',
    'multipleks',
    'pvc',
  ]);
  assert.deepEqual(getAvailableMaterialLabelsFromTariff(SAMPLE_KITCHEN), [
    'Blockboard',
    'Multipleks',
    'PVC Board',
  ]);
  assert.deepEqual(getAvailableFinishIdsFromTariff(SAMPLE_KITCHEN), ['hpl', 'cat-duco']);
  assert.deepEqual(getAvailableFinishLabelsFromTariff(SAMPLE_KITCHEN), ['HPL', 'Cat Duco']);

  const blockboardOnlyProduct: ProductItem = {
    ...SAMPLE_KITCHEN,
    harga: {
      hpl: { blockboard: 1800000 },
      duco: {},
    },
  };
  assert.deepEqual(getAvailableMaterialLabelsFromTariff(blockboardOnlyProduct), ['Blockboard']);
  assert.deepEqual(getAvailableFinishLabelsFromTariff(blockboardOnlyProduct), ['HPL']);
});

test('calculateCatalogVariantPrice computes unified Design & Build (/m2 via Panjang x Tinggi) with Gratis Desain', () => {
  const kitchenBlockboard = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    areaSqm: 1.2,
    lengthCm: 200,
    materialLabel: 'Blockboard',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(kitchenBlockboard.serviceMode, 'design-and-build');
  assert.equal(kitchenBlockboard.pricingUnit, 'm2');
  assert.equal(kitchenBlockboard.measureQuantity, 1.2);
  assert.equal(kitchenBlockboard.designAmount, 0);
  assert.equal(kitchenBlockboard.unitPrice, Math.round(1.2 * 1800000));
  assert.equal(kitchenBlockboard.promoActive, false);
  assert.equal(kitchenBlockboard.compareAtUnitPrice, null);

  const kitchenDuco = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    areaSqm: 1.2,
    lengthCm: 200,
    materialLabel: 'PVC Board',
    finishLabel: 'Cat Duco',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(kitchenDuco.effectivePerSqmRate, 4500000);
  assert.equal(kitchenDuco.unitPrice, Math.round(1.2 * 4500000));

  const partisiCalc = calculateCatalogVariantPrice({
    product: SAMPLE_PARTISI,
    areaSqm: 4.8,
    lengthCm: 200,
    materialLabel: 'Multipleks',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(partisiCalc.pricingUnit, 'm2');
  assert.equal(partisiCalc.measureQuantity, 4.8);
  assert.equal(partisiCalc.unitPrice, 12000000);

  const linearDesk: ProductItem = {
    ...SAMPLE_KITCHEN,
    id: 'katalog-meja-kerja-11',
    slug: 'meja-kerja-belajar',
    nama: 'Meja kerja / meja belajar',
    referensiUkuran: ['120x75', '150x75'],
    meterLari: true,
  };
  const deskCalc = calculateCatalogVariantPrice({
    product: linearDesk,
    areaSqm: 0.9,
    lengthCm: 120,
    materialLabel: 'Blockboard',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(deskCalc.pricingUnit, 'm');
  assert.equal(deskCalc.measureQuantity, 1.2);
  assert.equal(deskCalc.unitPrice, Math.round(1.2 * 1800000));
  assert.equal(resolveCatalogStartingPrice(linearDesk, SITE_PRICING).numericPrice, 2160000);
});

test('resolveCatalogStartingPrice always computes cheapest tariff x first referensiUkuran m2 automatically', () => {
  const defaultStarting = resolveCatalogStartingPrice(SAMPLE_KITCHEN, SITE_PRICING);
  // 200x60 cm = 1.2 m2 * 1,800,000 = 2,160,000
  assert.equal(defaultStarting.numericPrice, 2160000);
  assert.equal(defaultStarting.isStartingFrom, true);
  assert.ok(defaultStarting.label.startsWith('Mulai dari Rp'));
  assert.equal(defaultStarting.promoActive, false);
  assert.equal(defaultStarting.compareAtNumericPrice, null);
  assert.equal(defaultStarting.discountPercent, null);

  const customTariffProduct: ProductItem = {
    ...SAMPLE_PARTISI,
    id: 'katalog-partisi-kustom',
    slug: 'partisi-ruangan-kustom',
    nama: 'Partisi Ruangan Kustom',
    referensiUkuran: ['200x300', '250x300'],
    harga: {
      hpl: { blockboard: 2250000, multipleks: 2750000, pvc: 3750000 },
      duco: { blockboard: 4800000, multipleks: 4800000, pvc: 4800000 },
    },
  };
  const computedFromSize = resolveCatalogStartingPrice(customTariffProduct, SITE_PRICING);
  assert.equal(computedFromSize.numericPrice, 6 * 2250000);
});

test('promo markup keeps actual price untouched and supports both % and nominal-to-% conversion', () => {
  assert.deepEqual(parseProductPromo('10%'), { kind: 'percent', value: 10 });
  assert.deepEqual(parseProductPromo('12,5%'), { kind: 'percent', value: 12.5 });
  assert.deepEqual(parseProductPromo('250000'), { kind: 'nominal', value: 250000 });
  assert.deepEqual(parseProductPromo('Rp 360.000'), { kind: 'nominal', value: 360000 });
  assert.equal(parseProductPromo(''), null);
  assert.equal(parseProductPromo('0%'), null);

  // Percentage promo marks up compare-at price without lowering actual price
  const pctProduct: ProductItem = { ...SAMPLE_KITCHEN, promo: '10%' };
  const pctStarting = resolveCatalogStartingPrice(pctProduct, SITE_PRICING);
  assert.equal(pctStarting.numericPrice, 2160000);
  assert.equal(pctStarting.promoActive, true);
  assert.equal(pctStarting.compareAtNumericPrice, 2376000);
  assert.equal(pctStarting.discountPercent, 10);
  assert.equal(pctStarting.discountPercentLabel, '10%');

  const pctVariant = calculateCatalogVariantPrice({
    product: pctProduct,
    areaSqm: 1.5,
    lengthCm: 250,
    materialLabel: 'Multipleks',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  // 1.5 m2 * 2,500,000 = 3,750,000 real price kept intact; compareAt = 3,750,000 + 375,000
  assert.equal(pctVariant.unitPrice, 3750000);
  assert.equal(pctVariant.compareAtUnitPrice, 4125000);
  assert.equal(pctVariant.promoPercent, 10);
  assert.equal(pctVariant.promoPercentLabel, '10%');

  // Nominal promo without % converts dynamically to % against the selected variant price
  const nominalProduct: ProductItem = { ...SAMPLE_KITCHEN, promo: '216000' };
  const nominalStarting = resolveCatalogStartingPrice(nominalProduct, SITE_PRICING);
  assert.equal(nominalStarting.numericPrice, 2160000);
  assert.equal(nominalStarting.compareAtNumericPrice, 2376000);
  assert.equal(nominalStarting.discountPercent, 10);
  assert.equal(nominalStarting.discountPercentLabel, '10%');

  // Double area (400x60 = 2.4 m2 -> 4,320,000), same 216,000 nominal markup converts to 5%
  const largerVariant = calculateCatalogVariantPrice({
    product: nominalProduct,
    areaSqm: 2.4,
    lengthCm: 400,
    materialLabel: 'Blockboard',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(largerVariant.unitPrice, 4320000);
  assert.equal(largerVariant.compareAtUnitPrice, 4536000);
  assert.equal(largerVariant.promoPercent, 5);
  assert.equal(largerVariant.promoPercentLabel, '5%');

  const smallPct = resolveProductPromoMarkup(10000000, 50000);
  assert.equal(smallPct.compareAtPrice, 10050000);
  assert.equal(smallPct.promoPercentLabel, '0,5%');
});

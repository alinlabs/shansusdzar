import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
} from './custom-pricing';
import {
  calculateCatalogVariantPrice,
  calculateDiscountPercent,
  getDefaultProductDimensionsCm,
  mapOptionLabelToFinishId,
  mapOptionLabelToMaterialId,
  parseDimensionPresetDimensions,
  resolveCatalogStartingPrice,
} from './catalog-pricing';
import type { CustomInteriorPricingConfig } from '../types/cms';
import type { ProductItem } from '../types/product';

const SAMPLE_KITCHEN: ProductItem = {
  id: 'katalog-kitchen-set-01',
  slug: 'kitchen-set-kabinet-atas-bawah',
  nama: 'Kitchen set (kabinet atas & bawah)',
  kategori: 'Dapur & Bar',
  deskripsiSingkat: 'Sistem kabinet dapur atas dan bawah.',
  daftarGambar: [],
  daftarMaterial: [
    'Material Utama: MDF, Blockboard, PVC, Multipleks, atau Particle Board',
    'Finishing/Laminasi: Cat Duco, Sheet, atau HPL',
  ],
  pilihanWarna: [{ id: 'gading', nama: 'Gading Hangat', hex: '#EAE5DC' }],
  dimensi: {
    lebarCm: null,
    kedalamanCm: null,
    tinggiCm: null,
    referensiUkuran: ['2×3 m', '3×4 m', '300×60 cm'],
  },
  harga: null,
  hargaMulai: 2430000,
  statusHarga: 'mulai',
  kaitkanHargaCustom: true,
  ketersediaan: 'konsultasi',
  unggulan: true,
  urutan: 1,
  opsiKustom: [
    { id: 'customisasi', label: 'Customisasi', daftarNilai: ['Lurus (Straight)', 'Sudut (L-Shape)'] },
    {
      id: 'material-utama',
      label: 'Material Utama',
      daftarNilai: ['MDF', 'Blockboard', 'PVC', 'Multipleks', 'Particle Board'],
    },
    { id: 'finishing', label: 'Finishing/Laminasi', daftarNilai: ['Cat Duco', 'Sheet', 'HPL'] },
  ],
  produkContoh: true,
};

const SITE_PRICING: CustomInteriorPricingConfig = {
  hargaCustomTerkonfigurasi: INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi,
  persentaseDp: INDICATIVE_ESTIMATE_CONFIG.persentaseDp ?? 30,
  rules: structuredClone(INDICATIVE_WORKSHOP_ESTIMATE_RULES),
};

test('parseDimensionPresetDimensions parses both meter and centimeter dimension presets accurately', () => {
  assert.deepEqual(parseDimensionPresetDimensions('2×3 m'), {
    lengthCm: 200,
    widthCm: 300,
    areaSqm: 6,
    label: '2×3 m',
  });
  assert.deepEqual(parseDimensionPresetDimensions('300×60 cm'), {
    lengthCm: 300,
    widthCm: 60,
    areaSqm: 1.8,
    label: '300×60 cm',
  });
  assert.deepEqual(parseDimensionPresetDimensions('45×40 cm'), {
    lengthCm: 45,
    widthCm: 40,
    areaSqm: 0.18,
    label: '45×40 cm',
  });
  assert.equal(getDefaultProductDimensionsCm(SAMPLE_KITCHEN).areaSqm, 6);
});

test('option mapping identifies material and finishing IDs across labels cleanly', () => {
  assert.equal(mapOptionLabelToMaterialId('Particle Board'), 'particle-board');
  assert.equal(mapOptionLabelToMaterialId('Multipleks'), 'multipleks');
  assert.equal(mapOptionLabelToMaterialId('PVC'), 'pvc');
  assert.equal(mapOptionLabelToFinishId('Cat Duco'), 'cat-duco');
  assert.equal(mapOptionLabelToFinishId('HPL'), 'hpl');
  assert.equal(mapOptionLabelToFinishId('Sheet'), 'sheet');
});

test('calculateCatalogVariantPrice computes Design Only, Build Only, and Design + Build strictly by area, material, and finishing', () => {
  // 2x3 m = 6 m², MDF (1.200.000/m²) + Cat Duco (850.000/m²) + Design (150.000/m²)
  const designOnly = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'design-only',
    areaSqm: 6,
    materialLabel: 'MDF',
    finishLabel: 'Cat Duco',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(designOnly.unitPrice, 6 * 150000);
  assert.equal(designOnly.designAmount, 900000);
  assert.equal(designOnly.buildAmount, 0);

  const buildOnly = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'build-only',
    areaSqm: 6,
    materialLabel: 'MDF',
    finishLabel: 'Cat Duco',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(buildOnly.unitPrice, 6 * (1200000 + 850000));
  assert.equal(buildOnly.materialRatePerSqm, 1200000);
  assert.equal(buildOnly.finishingRatePerSqm, 850000);

  const both = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'design-and-build',
    areaSqm: 6,
    materialLabel: 'Multipleks',
    finishLabel: 'HPL',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(both.unitPrice, 6 * (150000 + 1600000 + 650000));
  assert.equal(both.designAmount, 900000);
  assert.equal(both.buildAmount, 6 * (1600000 + 650000));
});

test('resolveCatalogStartingPrice always returns positive starting price and responds live to Admin custom pricing updates', () => {
  const defaultStarting = resolveCatalogStartingPrice(SAMPLE_KITCHEN, SITE_PRICING);
  // Smallest preset on SAMPLE_KITCHEN is 300x60 cm = 1.8 m², cheapest Particle Board (950k) + Sheet (400k) = 1.35M/m² -> 2.430.000
  assert.equal(defaultStarting.numericPrice, 2430000);
  assert.equal(defaultStarting.isStartingFrom, true);
  assert.ok(defaultStarting.label.startsWith('Mulai dari Rp'));

  const updatedSitePricing: CustomInteriorPricingConfig = {
    ...SITE_PRICING,
    rules: {
      ...SITE_PRICING.rules,
      hargaBahanPerMeterPersegi: {
        ...SITE_PRICING.rules.hargaBahanPerMeterPersegi,
        'particle-board': 1000000,
      },
    },
  };
  const liveUpdatedStarting = resolveCatalogStartingPrice(SAMPLE_KITCHEN, updatedSitePricing);
  assert.equal(liveUpdatedStarting.numericPrice, Math.round(1.8 * (1000000 + 400000)));
});

test('per-product tarifKustom overrides general pricing when specified, and fixed products honor fixed price', () => {
  const overriddenProduct: ProductItem = {
    ...SAMPLE_KITCHEN,
    tarifKustom: {
      bahanPerM2: { mdf: 1500000 },
    },
  };
  const customCalc = calculateCatalogVariantPrice({
    product: overriddenProduct,
    serviceMode: 'build-only',
    areaSqm: 2,
    materialLabel: 'MDF',
    finishLabel: 'Sheet',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(customCalc.unitPrice, 2 * (1500000 + 400000));

  const fixedProduct: ProductItem = {
    ...SAMPLE_KITCHEN,
    harga: 4500000,
    hargaMulai: null,
    statusHarga: 'tetap',
    kaitkanHargaCustom: false,
  };
  const fixedStarting = resolveCatalogStartingPrice(fixedProduct, SITE_PRICING);
  assert.equal(fixedStarting.numericPrice, 4500000);
  assert.equal(fixedStarting.isStartingFrom, false);
});

test('promo scheme calculates before-promo strikethrough prices per m² when enabled and hides them when disabled', () => {
  // Kitchen Set: 6 m² MDF + Cat Duco, Build Only:
  // Before promo: 6 * (1,400,000 + 1,000,000) = 14,400,000
  // Current:      6 * (1,200,000 + 850,000)   = 12,300,000
  const buildPromo = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'build-only',
    areaSqm: 6,
    materialLabel: 'MDF',
    finishLabel: 'Cat Duco',
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(buildPromo.promoActive, true);
  assert.equal(buildPromo.compareAtUnitPrice, 6 * (1400000 + 1000000));
  assert.equal(buildPromo.unitPrice, 6 * (1200000 + 850000));

  // Design Only 6 m²: before 6 * 200,000 = 1,200,000 vs current 6 * 150,000 = 900,000
  const designPromo = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'design-only',
    areaSqm: 6,
    siteCustomPricing: SITE_PRICING,
  });
  assert.equal(designPromo.promoActive, true);
  assert.equal(designPromo.compareAtUnitPrice, 1200000);
  assert.equal(designPromo.unitPrice, 900000);

  // Starting price with promo enabled: 1.8 m² * (1,150,000 + 500,000) = 2,970,000
  const startingPromo = resolveCatalogStartingPrice(SAMPLE_KITCHEN, SITE_PRICING);
  assert.equal(startingPromo.promoActive, true);
  assert.equal(startingPromo.compareAtNumericPrice, 2970000);
  assert.equal(startingPromo.numericPrice, 2430000);
  assert.equal(startingPromo.discountPercent, 18);

  // Turning off global promo disables strikethrough prices immediately
  const noGlobalPromo: CustomInteriorPricingConfig = {
    ...SITE_PRICING,
    rules: {
      ...SITE_PRICING.rules,
      promoAktif: false,
    },
  };
  const variantNoPromo = calculateCatalogVariantPrice({
    product: SAMPLE_KITCHEN,
    serviceMode: 'design-and-build',
    areaSqm: 6,
    materialLabel: 'Multipleks',
    finishLabel: 'HPL',
    siteCustomPricing: noGlobalPromo,
  });
  assert.equal(variantNoPromo.promoActive, false);
  assert.equal(variantNoPromo.compareAtUnitPrice, null);

  const startingNoPromo = resolveCatalogStartingPrice(SAMPLE_KITCHEN, noGlobalPromo);
  assert.equal(startingNoPromo.promoActive, false);
  assert.equal(startingNoPromo.compareAtNumericPrice, null);
  assert.equal(startingNoPromo.discountPercent, null);

  // Product-level opt-out (promoAktif: false) suppresses promo even when global promo is active
  const optedOutProduct: ProductItem = { ...SAMPLE_KITCHEN, promoAktif: false };
  assert.equal(
    calculateCatalogVariantPrice({
      product: optedOutProduct,
      serviceMode: 'build-only',
      areaSqm: 2,
      siteCustomPricing: SITE_PRICING,
    }).promoActive,
    false
  );
  const optedOutStarting = resolveCatalogStartingPrice(optedOutProduct, SITE_PRICING);
  assert.equal(optedOutStarting.promoActive, false);
  assert.equal(optedOutStarting.discountPercent, null);

  // Unlinked fixed product with hargaSebelumPromo
  const fixedPromoProduct: ProductItem = {
    ...SAMPLE_KITCHEN,
    harga: 4500000,
    hargaSebelumPromo: 5500000,
    promoAktif: true,
    statusHarga: 'tetap',
    kaitkanHargaCustom: false,
  };
  const fixedStarting = resolveCatalogStartingPrice(fixedPromoProduct, SITE_PRICING);
  assert.equal(fixedStarting.promoActive, true);
  assert.equal(fixedStarting.compareAtNumericPrice, 5500000);
  assert.equal(fixedStarting.numericPrice, 4500000);
  assert.equal(fixedStarting.discountPercent, 18);

  assert.equal(calculateDiscountPercent(2430000, 2970000), 18);
  assert.equal(calculateDiscountPercent(4500000, 4500000), null);
  assert.equal(calculateDiscountPercent(4500000, null), null);
});


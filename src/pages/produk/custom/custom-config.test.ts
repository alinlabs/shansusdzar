import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_FINISHES,
  CUSTOM_MATERIALS,
  convertUnitValue,
  customItemToDraft,
  formatConvertedDimensionDisplay,
  mapCatalogCategoryToProjectTypeId,
  mapCatalogProductsToSelectableItems,
  parseCustomServiceModeParam,
  toCentimeters,
  validateDimensionsInput,
} from './custom-config';
import type { ProductItem } from '../../../types/product';

test('unit conversions between cm and m are consistent', () => {
  assert.equal(toCentimeters(3.5, 'm'), 350);
  assert.equal(toCentimeters(240, 'cm'), 240);
  assert.equal(convertUnitValue(300, 'cm', 'm'), 3);
  assert.equal(convertUnitValue(2.5, 'm', 'cm'), 250);
});

test('validateDimensionsInput validates length × width only with null height', () => {
  const invalidZero = validateDimensionsInput({
    lengthInput: '0',
    widthInput: '200',
    unit: 'cm',
  });
  assert.equal(invalidZero.isValid, false);
  assert.ok(invalidZero.errors.length);

  const invalidBoundM = validateDimensionsInput({
    lengthInput: '0.1',
    widthInput: '2',
    unit: 'm',
  });
  assert.equal(invalidBoundM.isValid, false);
  assert.ok(invalidBoundM.errors.length);

  const validMeters = validateDimensionsInput({
    lengthInput: '3.2',
    widthInput: '2.4',
    unit: 'm',
  });
  assert.equal(validMeters.isValid, true);
  assert.ok(validMeters.normalized);
  assert.equal(validMeters.normalized.normalizedLengthCm, 320);
  assert.equal(validMeters.normalized.normalizedWidthCm, 240);
  assert.equal(validMeters.normalized.height, null);
  assert.equal(validMeters.normalized.normalizedHeightCm, null);
  assert.equal(formatConvertedDimensionDisplay(validMeters.normalized), 'Setara 320 × 240 cm');
});

test('custom configurator exposes strictly the 5 bahan dasar and 3 finishing options', () => {
  assert.deepEqual(
    CUSTOM_MATERIALS.map((m) => m.label),
    ['MDF', 'Blockboard', 'PVC', 'Multipleks', 'Particle Board']
  );
  assert.deepEqual(
    CUSTOM_FINISHES.map((f) => f.label),
    ['Cat Duco', 'Sheet', 'HPL']
  );

  const draft = customItemToDraft({
    kind: 'custom',
    lineId: 'custom-test',
    projectTypeId: 'dapur',
    projectTypeLabel: 'Dapur & Pantry',
    itemTypeId: 'kitchen-set',
    itemTypeLabel: 'Kitchen Set / Kabinet Dapur',
    dimensions: {
      length: 300,
      width: 250,
      height: null,
      unit: 'cm',
      normalizedLengthCm: 300,
      normalizedWidthCm: 250,
      normalizedHeightCm: null,
    },
    materialId: 'blockboard',
    materialLabel: 'Blockboard',
    finishId: 'cat-duco',
    finishLabel: 'Cat Duco',
    colorId: 'warm-oat',
    colorName: 'Gandum Hangat',
    colorHex: '#D8D1C7',
    additionalOptions: [],
    notes: '',
    quantity: 1,
    estimatedUnitTotal: 16500000,
    estimatedDpAmount: 4950000,
    estimateStatus: 'configured',
  });

  assert.equal(draft.materialId, 'blockboard');
  assert.equal(draft.finishId, 'cat-duco');
  assert.equal(draft.lengthInput, '300');
  assert.equal(draft.widthInput, '250');
  assert.equal(draft.serviceMode, 'build-only');

  const designDraft = customItemToDraft({
    kind: 'custom',
    lineId: 'custom-design-test',
    serviceMode: 'design-only',
    serviceModeLabel: 'Desain Saja',
    projectTypeId: 'ruang-tamu',
    projectTypeLabel: 'Ruang Tamu',
    itemTypeId: 'paket-ruang',
    itemTypeLabel: 'Paket Penataan Ruang',
    dimensions: {
      length: 400,
      width: 300,
      height: null,
      unit: 'cm',
      normalizedLengthCm: 400,
      normalizedWidthCm: 300,
      normalizedHeightCm: null,
    },
    materialId: 'multipleks',
    materialLabel: 'Multipleks',
    finishId: 'hpl',
    finishLabel: 'HPL',
    colorId: 'warm-oat',
    colorName: 'Gandum Hangat',
    colorHex: '#D8D1C7',
    additionalOptions: [],
    notes: '',
    quantity: 1,
    designAmount: 1800000,
    buildAmount: null,
    estimatedUnitTotal: 1800000,
    estimatedDpAmount: 540000,
    estimateStatus: 'configured',
  });
  assert.equal(designDraft.serviceMode, 'design-only');
});

test('parseCustomServiceModeParam and mapCatalogCategoryToProjectTypeId normalize URL and category values', () => {
  assert.equal(parseCustomServiceModeParam('design-only'), 'design-only');
  assert.equal(parseCustomServiceModeParam('build-only'), 'build-only');
  assert.equal(parseCustomServiceModeParam('design-and-build'), 'design-and-build');
  assert.equal(parseCustomServiceModeParam('invalid'), null);
  assert.equal(parseCustomServiceModeParam(null), null);

  assert.equal(mapCatalogCategoryToProjectTypeId('Dapur & Pantry'), 'dapur-pantry');
  assert.equal(mapCatalogCategoryToProjectTypeId('Kamar Tidur'), 'kamar-tidur');
  assert.equal(mapCatalogCategoryToProjectTypeId('Ruang Makan'), 'ruang-makan');
  assert.equal(mapCatalogCategoryToProjectTypeId('Ruang Kerja'), 'ruang-kerja');
  assert.equal(mapCatalogCategoryToProjectTypeId('Gerai Komersial'), 'komersial-lainnya');
  assert.equal(mapCatalogCategoryToProjectTypeId('Ruang Tamu'), 'ruang-tamu');
});

test('mapCatalogProductsToSelectableItems syncs catalog products and appends Paket Penataan Ruang', () => {
  const sampleProducts: ProductItem[] = [
    {
      id: 'prod-k1',
      slug: 'kabinet-dapur-modular',
      nama: 'Kabinet Dapur Modular',
      kategori: 'Dapur',
      deskripsiSingkat: 'Kabinet dapur custom modular.',
      harga: 4500000,
      hargaMulai: null,
      statusHarga: 'tetap',
      daftarMaterial: ['Multipleks', 'HPL'],
      dimensi: { lebarCm: 240, kedalamanCm: 60, tinggiCm: 210 },
      pilihanWarna: [{ id: 'putih-hangat', nama: 'Putih Hangat', hex: '#F3F1ED' }],
      opsiKustom: [],
      ketersediaan: 'pre-order',
      unggulan: false,
      urutan: 1,
      daftarGambar: [],
      produkContoh: false,
    },
  ];

  const mapped = mapCatalogProductsToSelectableItems(sampleProducts, () => 'Rp4.500.000');
  assert.equal(mapped[0].id, 'prod-k1');
  assert.equal(mapped[0].label, 'Kabinet Dapur Modular');
  assert.equal(mapped[0].produkSlug, 'kabinet-dapur-modular');
  assert.equal(mapped[0].hargaProdukLabel, 'Rp4.500.000');
  assert.ok(mapped.some((item) => item.id === 'paket-ruang'));
});


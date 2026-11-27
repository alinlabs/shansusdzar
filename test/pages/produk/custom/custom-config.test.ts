import test from 'node:test';
import assert from 'node:assert/strict';
import materialSpecsJson from '../../../../src/data/spesifikasi-material.json';
import {
  CUSTOM_FINISHES,
  CUSTOM_MATERIALS,
  applyProductSelectionToDraft,
  buildProductFinishOptions,
  buildProductMaterialOptions,
  convertUnitValue,
  createDefaultCustomDraft,
  customItemToDraft,
  filterCustomProducts,
  formatConvertedDimensionDisplay,
  mapCatalogProductsToSelectableItems,
  parseCustomServiceModeParam,
  resolveFittingGridColumns,
  toCentimeters,
  validateDimensionsInput,
} from '../../../../src/pages/produk/custom/custom-config';
import type { MaterialSpecItem } from '../../../../src/types/cms';
import type { ProductItem } from '../../../../src/types/product';

test('unit conversions between cm and m are consistent', () => {
  assert.equal(toCentimeters(3.5, 'm'), 350);
  assert.equal(toCentimeters(240, 'cm'), 240);
  assert.equal(convertUnitValue(300, 'cm', 'm'), 3);
  assert.equal(convertUnitValue(2.5, 'm', 'cm'), 250);
});

test('validateDimensionsInput rejects empty inputs and allows any positive dimensions freely without fixed bounds', () => {
  const emptyInputs = validateDimensionsInput({
    lengthInput: '',
    widthInput: '',
    unit: 'cm',
  });
  assert.equal(emptyInputs.isValid, false);
  assert.equal(emptyInputs.normalized, null);
  assert.ok(emptyInputs.errors.length);
  assert.ok(emptyInputs.errors.width);

  const invalidZero = validateDimensionsInput({
    lengthInput: '0',
    widthInput: '200',
    unit: 'cm',
  });
  assert.equal(invalidZero.isValid, false);
  assert.ok(invalidZero.errors.length);

  const compactValidM = validateDimensionsInput({
    lengthInput: '0.1',
    widthInput: '2',
    unit: 'm',
  });
  assert.equal(compactValidM.isValid, true);
  assert.equal(compactValidM.normalized?.normalizedLengthCm, 10);

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

test('custom configurator initializes empty cm dimensions and restores cart items cleanly in cm', () => {
  const specs = materialSpecsJson as MaterialSpecItem[];
  assert.deepEqual(
    CUSTOM_MATERIALS.map((m) => m.label),
    specs.filter((s) => s.kategori === 'papan').map((s) => s.nama)
  );
  assert.deepEqual(
    CUSTOM_FINISHES.map((f) => f.label),
    specs.filter((s) => s.kategori === 'finishing').map((s) => s.nama)
  );

  const defaultDraft = createDefaultCustomDraft();
  assert.equal(defaultDraft.selectedProductId, null);
  assert.equal(defaultDraft.lengthInput, '');
  assert.equal(defaultDraft.widthInput, '');
  assert.equal(defaultDraft.unit, 'cm');
  assert.equal(defaultDraft.customStyleValue, null);
  assert.equal(defaultDraft.serviceMode, 'design-and-build');

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

  assert.equal(draft.selectedProductId, 'kitchen-set');
  assert.equal(draft.materialId, 'blockboard');
  assert.equal(draft.finishId, 'cat-duco');
  assert.equal(draft.unit, 'cm');
  assert.equal(draft.lengthInput, '300');
  assert.equal(draft.widthInput, '250');
  assert.equal(draft.serviceMode, 'design-and-build');

  const designDraft = customItemToDraft({
    kind: 'custom',
    lineId: 'custom-design-test',
    serviceMode: 'design-only',
    serviceModeLabel: 'Desain & Build (Gratis Desain)',
    projectTypeId: 'ruang-tamu',
    projectTypeLabel: 'Ruang Tamu',
    itemTypeId: 'katalog-partisi-ruangan-13',
    itemTypeLabel: 'Partisi / penyekat ruangan',
    dimensions: {
      length: 4,
      width: 2.5,
      height: null,
      unit: 'm',
      normalizedLengthCm: 400,
      normalizedWidthCm: 250,
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
    designAmount: 0,
    buildAmount: 7200000,
    estimatedUnitTotal: 7200000,
    estimatedDpAmount: 2160000,
    estimateStatus: 'configured',
  });
  assert.equal(designDraft.serviceMode, 'design-and-build');
  assert.equal(designDraft.selectedProductId, 'katalog-partisi-ruangan-13');
  assert.equal(designDraft.unit, 'cm');
  assert.equal(designDraft.lengthInput, '400');
  assert.equal(designDraft.widthInput, '250');
});

test('parseCustomServiceModeParam normalizes URL mode values', () => {
  assert.equal(parseCustomServiceModeParam('design-only'), 'design-and-build');
  assert.equal(parseCustomServiceModeParam('build-only'), 'design-and-build');
  assert.equal(parseCustomServiceModeParam('design-and-build'), 'design-and-build');
  assert.equal(parseCustomServiceModeParam('invalid'), null);
  assert.equal(parseCustomServiceModeParam(null), null);
});

test('applyProductSelectionToDraft keeps user custom dimensions without loading reference presets and filterCustomProducts matches name/category', () => {
  const sampleProduct: ProductItem = {
    id: 'prod-k1',
    nama: 'Kabinet Dapur Modular',
    kategori: 'Dapur & Bar',
    deskripsiSingkat: 'Kabinet dapur custom modular.',
    referensiUkuran: ['250x60', '300x60'],
    harga: {
      hpl: { multipleks: 2500000, pvc: 3500000 },
      duco: { multipleks: 4500000, pvc: 4500000 },
    },
    customisasi: ['Bentuk L', 'Lurus'],
    include: ['Engsel & Rel Soft-Close', 'Rak Piring Tarik'],
    gambarSampul: '',
    media: [],
  };
  const secondProduct: ProductItem = {
    ...sampleProduct,
    id: 'prod-l1',
    nama: 'Lemari Pakaian Panel',
    kategori: 'Kamar Tidur',
  };

  const mapped = mapCatalogProductsToSelectableItems([sampleProduct]);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].id, 'prod-k1');
  assert.equal(mapped[0].label, 'Kabinet Dapur Modular');
  assert.equal(mapped[0].produkSlug, 'kabinet-dapur-modular');
  assert.equal('deskripsi' in mapped[0], false);
  assert.equal('hargaProdukLabel' in mapped[0], false);

  const defaultDraft = createDefaultCustomDraft();
  const populatedFromEmpty = applyProductSelectionToDraft(
    { ...defaultDraft, colorId: 'walnut-tua' },
    sampleProduct
  );
  assert.equal(populatedFromEmpty.selectedProductId, 'prod-k1');
  assert.equal(populatedFromEmpty.lengthInput, '');
  assert.equal(populatedFromEmpty.widthInput, '');
  assert.equal(populatedFromEmpty.unit, 'cm');
  assert.equal(populatedFromEmpty.materialId, 'multipleks');
  assert.equal(populatedFromEmpty.finishId, 'hpl');
  assert.equal(populatedFromEmpty.colorId, 'walnut-tua');
  assert.equal(populatedFromEmpty.customStyleValue, 'Bentuk L');
  assert.deepEqual(populatedFromEmpty.additionalOptionIds, ['Engsel & Rel Soft-Close', 'Rak Piring Tarik']);

  const populatedWithTypedDims = applyProductSelectionToDraft(
    { ...defaultDraft, lengthInput: '185', widthInput: '215' },
    sampleProduct
  );
  assert.equal(populatedWithTypedDims.lengthInput, '185');
  assert.equal(populatedWithTypedDims.widthInput, '215');

  const filteredByName = filterCustomProducts([sampleProduct, secondProduct], 'lemari');
  assert.deepEqual(
    filteredByName.map((p) => p.id),
    ['prod-l1']
  );
  const filteredByCategory = filterCustomProducts([sampleProduct, secondProduct], 'dapur');
  assert.deepEqual(
    filteredByCategory.map((p) => p.id),
    ['prod-k1']
  );
  assert.equal(filterCustomProducts([sampleProduct, secondProduct], '').length, 2);

  const roundTripEdit = customItemToDraft(
    {
      kind: 'custom',
      lineId: 'custom-rt',
      itemTypeId: 'prod-k1',
      itemTypeLabel: 'Kabinet Dapur Modular',
      dimensions: {
        length: 250,
        width: 60,
        height: null,
        unit: 'cm',
        normalizedLengthCm: 250,
        normalizedWidthCm: 60,
        normalizedHeightCm: null,
      },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'walnut-tua',
      colorName: 'Walnut Tua',
      colorHex: '#5C4332',
      additionalOptions: ['Model: Lurus', 'Engsel & Rel Soft-Close'],
      notes: '',
      quantity: 1,
      estimatedUnitTotal: 6250000,
      estimatedDpAmount: 1875000,
      estimateStatus: 'configured',
    },
    [sampleProduct]
  );
  assert.equal(roundTripEdit.customStyleValue, 'Lurus');
  assert.deepEqual(roundTripEdit.additionalOptionIds, ['Engsel & Rel Soft-Close', 'Rak Piring Tarik']);

  const restrictedProduct: ProductItem = {
    ...sampleProduct,
    id: 'prod-restricted',
    harga: {
      hpl: { blockboard: 1800000 },
      duco: {},
    },
  };
  assert.deepEqual(
    buildProductMaterialOptions(restrictedProduct).map((m) => m.id),
    ['blockboard']
  );
  assert.deepEqual(
    buildProductFinishOptions(restrictedProduct).map((f) => f.id),
    ['hpl']
  );

  const asymmetricTariffProduct: ProductItem = {
    ...sampleProduct,
    id: 'prod-asymmetric',
    harga: {
      hpl: { blockboard: 1800000 },
      duco: { multipleks: 4500000 },
    },
  };
  const switchedToAsymmetric = applyProductSelectionToDraft(
    { ...defaultDraft, materialId: 'blockboard', finishId: 'cat-duco' },
    asymmetricTariffProduct
  );
  assert.equal(switchedToAsymmetric.materialId, 'blockboard');
  assert.equal(switchedToAsymmetric.finishId, 'hpl');

  const tinyRoundedZero = validateDimensionsInput({
    lengthInput: '0.001',
    widthInput: '100',
    unit: 'cm',
  });
  assert.equal(tinyRoundedZero.isValid, false);
  assert.ok(tinyRoundedZero.errors.length);
});

test('resolveFittingGridColumns tries up to 4 full-width equal columns without wrapping and falls back cleanly to 3 or 2 columns', () => {
  // 4 short cards fit in 4 columns
  assert.equal(
    resolveFittingGridColumns({
      itemCount: 4,
      containerWidth: 600,
      maxRequiredItemWidth: 120,
      gapPx: 8,
    }),
    4
  );

  // 4 cards where card 3 is too wide for 4 columns (144px < 170px) -> drops to 3 columns (1-3 row 1, card 4 below card 1 with 1/3 width)
  assert.equal(
    resolveFittingGridColumns({
      itemCount: 4,
      containerWidth: 600,
      maxRequiredItemWidth: 170,
      gapPx: 8,
    }),
    3
  );

  // 5 cards also cap at 4 columns max when widths fit
  assert.equal(
    resolveFittingGridColumns({
      itemCount: 5,
      containerWidth: 600,
      maxRequiredItemWidth: 130,
      gapPx: 8,
    }),
    4
  );

  // 3 cards on narrow mobile where 3 cols would wrap (108px < 150px) -> drops to 2 columns
  assert.equal(
    resolveFittingGridColumns({
      itemCount: 3,
      containerWidth: 340,
      maxRequiredItemWidth: 150,
      gapPx: 8,
    }),
    2
  );
});



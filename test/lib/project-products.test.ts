import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyProjectProductItem } from '../../src/lib/project-documents-auto';
import {
  applyCatalogProductSelection,
  buildProjectProductSpecification,
  calculateProjectProductAutoPrice,
  computeProjectProductSubtotal,
  computeProjectProductTambahanTotal,
  getProjectProductOptionSets,
  recalculateProjectProductItem,
  resolveProjectProductName,
} from '../../src/lib/project-products';

test('applyCatalogProductSelection links catalog product id, resolves display name, picks defaults, and seeds include as Rp 0 tambahan', () => {
  const empty = createEmptyProjectProductItem(1);
  const selected = applyCatalogProductSelection(empty, 'katalog-kitchen-set-01');

  assert.equal(selected.id, 'katalog-kitchen-set-01');
  assert.equal(selected.namaProduk, undefined);
  assert.equal(resolveProjectProductName(selected), 'Kitchen Set');
  assert.equal(selected.customisasi, 'Lurus (Straight)');
  assert.equal(selected.material, 'Multipleks');
  assert.equal(selected.finishing, 'HPL');
  assert.ok(Array.isArray(selected.tambahan) && selected.tambahan.length >= 3);
  assert.equal(
    selected.tambahan!.every((addon) => addon.biaya === 0 && addon.jenis.trim().length > 0),
    true
  );
  assert.match(
    selected.spesifikasiMaterial,
    /^Lurus \(Straight\), Multipleks 18 MM, Finishing HPL, /
  );
});

test('getProjectProductOptionSets exposes product customisasi, materials, and finishings without duplicates', () => {
  const empty = createEmptyProjectProductItem(1);
  const selected = applyCatalogProductSelection(empty, 'katalog-island-table-02');
  const sets = getProjectProductOptionSets({
    id: 'katalog-island-table-02',
    nama: 'Island Table',
    kategori: 'Dapur',
    deskripsiSingkat: '',
    gambarSampul: '',
    '3d': '',
    media: [],
    referensiUkuran: [],
    meterLari: true,
    promo: '',
    customisasi: ['Top Table Granit + Laci', 'Kombinasi Meja Sarapan'],
    include: ['Rak Bumbu Tarik', 'Colokan Tanam Pop-Up', 'Finishing Sisi Belakang'],
    harga: {
      hpl: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
  });

  assert.equal(resolveProjectProductName(selected), 'Island Table');
  assert.deepEqual(sets.customisasiOptions, ['Top Table Granit + Laci', 'Kombinasi Meja Sarapan']);
  assert.deepEqual(sets.materialOptions, ['Blockboard', 'Multipleks', 'PVC Board']);
  assert.deepEqual(sets.finishingOptions, ['HPL', 'Cat Duco']);
});

test('calculateProjectProductAutoPrice matches custom interior calculator for m² and meter lari items', () => {
  // Kitchen Set: 360 x 250 cm = 9 m2 * 2,500,000 = 22,500,000 (Multipleks + HPL)
  const m2Price = calculateProjectProductAutoPrice({
    productId: 'katalog-kitchen-set-01',
    dimensi: '360 x 250',
    material: 'Multipleks',
    finishing: 'HPL',
  });
  assert.equal(m2Price.pricingUnit, 'm2');
  assert.equal(m2Price.unitPrice, 22500000);

  // Island Table (meterLari: true): 260 x 90 cm -> 2.6 m * 2,500,000 = 6,500,000
  const linearPrice = calculateProjectProductAutoPrice({
    productId: 'katalog-island-table-02',
    dimensi: '260 x 90',
    material: 'Multipleks',
    finishing: 'HPL',
  });
  assert.equal(linearPrice.pricingUnit, 'm');
  assert.equal(linearPrice.unitPrice, 6500000);

  // Kitchen Set 3-bagian P x L x T: 360 x 60 x 250 cm -> tetap dihitung P x T = 360 * 250 = 9 m2 * 2,500,000 = 22,500,000
  const m2PriceThreeParts = calculateProjectProductAutoPrice({
    productId: 'katalog-kitchen-set-01',
    dimensi: '360 x 60 x 250',
    material: 'Multipleks',
    finishing: 'HPL',
  });
  assert.equal(m2PriceThreeParts.pricingUnit, 'm2');
  assert.deepEqual(m2PriceThreeParts.areaPair, { lengthCm: 360, widthCm: 250 });
  assert.equal(m2PriceThreeParts.unitPrice, 22500000);

  // Island Table (meterLari: true) 3-bagian: 260 x 80 x 90 cm -> 2.6 m * 2,500,000 = 6,500,000
  const linearPriceThreeParts = calculateProjectProductAutoPrice({
    productId: 'katalog-island-table-02',
    dimensi: '260 x 80 x 90',
    material: 'Multipleks',
    finishing: 'HPL',
  });
  assert.equal(linearPriceThreeParts.pricingUnit, 'm');
  assert.deepEqual(linearPriceThreeParts.areaPair, { lengthCm: 260, widthCm: 90 });
  assert.equal(linearPriceThreeParts.unitPrice, 6500000);

  // Cat Duco: 9 m2 * 4,500,000 = 40,500,000
  const ducoPrice = calculateProjectProductAutoPrice({
    productId: 'katalog-kitchen-set-01',
    dimensi: '360 x 250',
    material: 'Multipleks',
    finishing: 'Cat Duco',
  });
  assert.equal(ducoPrice.unitPrice, 40500000);
});

test('recalculateProjectProductItem keeps auto spec live, honors manual price discounts, and sums tambahan costs', () => {
  const base = applyCatalogProductSelection(
    createEmptyProjectProductItem(1),
    'katalog-lemari-pakaian-03'
  );
  const withDims = recalculateProjectProductItem({
    ...base,
    dimensi: '240 x 280',
  });
  // 2.4 * 2.8 = 6.72 m2 * 2,500,000 = 16,800,000
  assert.equal(withDims.hargaSatuan, 16800000);

  // Add paid custom addon
  const withAddon = recalculateProjectProductItem({
    ...withDims,
    tambahan: [
      ...(withDims.tambahan ?? []),
      { jenis: 'Lampu LED Sensor Pintu', biaya: 850000 },
    ],
  });
  assert.equal(
    withAddon.spesifikasiMaterial,
    buildProjectProductSpecification(withAddon)
  );
  assert.match(withAddon.spesifikasiMaterial, /Lampu LED Sensor Pintu$/);
  assert.equal(computeProjectProductTambahanTotal(withAddon), 850000);
  assert.equal(computeProjectProductSubtotal(withAddon), 16800000 + 850000);

  // Manual discount override survives material change until hargaManual is cleared
  const discounted = recalculateProjectProductItem({
    ...withAddon,
    hargaSatuan: 15500000,
    hargaManual: true,
    material: 'PVC Board',
  });
  assert.equal(discounted.hargaSatuan, 15500000);
  assert.match(discounted.spesifikasiMaterial, /PVC Board 18 MM/);
  assert.equal(computeProjectProductSubtotal(discounted), 15500000 + 850000);

  const resetAuto = recalculateProjectProductItem({
    ...discounted,
    hargaManual: false,
  });
  // 6.72 * 3,500,000 (PVC Board HPL) = 23,520,000
  assert.equal(resetAuto.hargaSatuan, 23520000);

  const withColorCode = recalculateProjectProductItem({
    ...resetAuto,
    kodeWarna: 'TH 015 AA',
  });
  assert.match(withColorCode.spesifikasiMaterial, /Finishing HPL \(TH 015 AA\)/);
});

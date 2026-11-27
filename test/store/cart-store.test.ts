import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartSummary,
  removeCartItem,
  sanitizeCartItems,
  setCartItemQuantity,
  upsertCustomCartItem,
  upsertProductCartItem,
} from '../../src/store/cart-store';

test('upsertProductCartItem merges identical product options and keeps distinct options separate', () => {
  let items = upsertProductCartItem([], {
    productId: 'sofa-01',
    slug: 'sofa-01',
    name: 'Sofa Minimalis (Contoh)',
    category: 'Ruang Tamu',
    image: null,
    selectedColorName: 'Abu Batu',
    selectedColorHex: '#999697',
    selectedOptions: { dudukan: '3 Dudukan' },
    quantity: 1,
    unitPrice: null,
    priceStatus: 'konsultasi',
  });

  items = upsertProductCartItem(items, {
    productId: 'sofa-01',
    slug: 'sofa-01',
    name: 'Sofa Minimalis (Contoh)',
    category: 'Ruang Tamu',
    image: null,
    selectedColorName: 'Abu Batu',
    selectedColorHex: '#999697',
    selectedOptions: { dudukan: '3 Dudukan' },
    quantity: 2,
    unitPrice: null,
    priceStatus: 'konsultasi',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);

  items = upsertProductCartItem(items, {
    productId: 'sofa-01',
    slug: 'sofa-01',
    name: 'Sofa Minimalis (Contoh)',
    category: 'Ruang Tamu',
    image: null,
    selectedColorName: 'Gandum Hangat',
    selectedColorHex: '#D8D1C7',
    selectedOptions: { dudukan: '2 Dudukan' },
    quantity: 1,
    unitPrice: null,
    priceStatus: 'konsultasi',
  });

  assert.equal(items.length, 2);
});

test('setCartItemQuantity and removeCartItem enforce minimums and deletions', () => {
  const initial = upsertProductCartItem([], {
    productId: 'meja-01',
    slug: 'meja-01',
    name: 'Meja Makan (Contoh)',
    category: 'Ruang Makan',
    image: null,
    selectedColorName: null,
    selectedColorHex: null,
    selectedOptions: {},
    quantity: 2,
    unitPrice: 3500000,
    priceStatus: 'tetap',
  });

  const lineId = initial[0].lineId;
  const updated = setCartItemQuantity(initial, lineId, 4);
  assert.equal(updated[0].quantity, 4);

  const summary = calculateCartSummary(updated);
  assert.equal(summary.totalQuantity, 4);
  assert.equal(summary.pricedSubtotal, 14000000);
  assert.equal(summary.hasUnpricedItems, false);

  const zeroed = setCartItemQuantity(updated, lineId, 0);
  assert.equal(zeroed.length, 0);

  const removed = removeCartItem(updated, lineId);
  assert.equal(removed.length, 0);
});

test('calculateCartSummary separates priced items from unpriced/contact items honestly', () => {
  let items = upsertCustomCartItem([], {
    lineId: 'custom-1',
    projectTypeId: 'ruang-tamu',
    projectTypeLabel: 'Ruang Tamu',
    itemTypeId: 'kabinet',
    itemTypeLabel: 'Kabinet Dinding',
    dimensions: {
      length: 200,
      width: 45,
      height: null,
      unit: 'cm',
      normalizedLengthCm: 200,
      normalizedWidthCm: 45,
      normalizedHeightCm: null,
    },
    materialId: 'multipleks',
    materialLabel: 'Multipleks',
    finishId: 'hpl',
    finishLabel: 'HPL',
    colorId: 'stone',
    colorName: 'Abu Batu',
    colorHex: '#999697',
    additionalOptions: [],
    notes: '',
    quantity: 1,
    estimatedUnitTotal: null,
    estimatedDpAmount: null,
    estimateStatus: 'contact',
  });

  const summary = calculateCartSummary(items);
  assert.equal(summary.lineCount, 1);
  assert.equal(summary.totalQuantity, 1);
  assert.equal(summary.pricedSubtotal, null);
  assert.equal(summary.hasUnpricedItems, true);
});

test('sanitizeCartItems ignores malformed persisted entries gracefully', () => {
  const sanitized = sanitizeCartItems([
    null,
    { kind: 'product', lineId: 'bad' },
    {
      kind: 'product',
      lineId: 'ok-1',
      productId: 'p1',
      slug: 'p1',
      name: 'Produk Valid',
      category: 'Ruang Tamu',
      quantity: 2,
      unitPrice: 0,
      priceStatus: 'fixed',
    },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].kind, 'product');
  if (sanitized[0].kind === 'product') {
    assert.equal(sanitized[0].unitPrice, null);
    assert.equal(sanitized[0].priceStatus, 'konsultasi');
  }
});

test('sanitizeCartItems preserves serviceMode, designAmount, buildAmount and defaults legacy custom items to design-and-build', () => {
  const sanitized = sanitizeCartItems([
    {
      kind: 'custom',
      lineId: 'custom-legacy',
      projectTypeId: 'dapur-pantry',
      projectTypeLabel: 'Dapur & Pantry',
      itemTypeId: 'kabinet',
      itemTypeLabel: 'Kabinet Dapur',
      dimensions: { length: 300, width: 200, height: null, unit: 'cm' },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'gandum',
      colorName: 'Gandum Hangat',
      colorHex: '#D8D1C7',
      additionalOptions: [],
      notes: '',
      quantity: 1,
      estimatedUnitTotal: 14000000,
      estimatedDpAmount: 4200000,
      estimateStatus: 'configured',
    },
    {
      kind: 'custom',
      lineId: 'custom-design-combo',
      serviceMode: 'design-and-build',
      projectTypeId: 'ruang-tamu',
      projectTypeLabel: 'Ruang Tamu',
      itemTypeId: 'credenza',
      itemTypeLabel: 'Credenza TV',
      dimensions: { length: 200, width: 150, height: null, unit: 'cm' },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'gandum',
      colorName: 'Gandum Hangat',
      colorHex: '#D8D1C7',
      additionalOptions: [],
      notes: '',
      quantity: 1,
      designAmount: 450000,
      buildAmount: 7500000,
      estimatedUnitTotal: 7950000,
      estimatedDpAmount: 2385000,
      estimateStatus: 'configured',
    },
  ]);

  assert.equal(sanitized.length, 2);
  if (sanitized[0].kind === 'custom') {
    assert.equal(sanitized[0].serviceMode, 'design-and-build');
    assert.equal(sanitized[0].serviceModeLabel, 'Desain & Build (Gratis Desain)');
    assert.equal(sanitized[0].designAmount, null);
    assert.equal(sanitized[0].buildAmount, null);
  }
  if (sanitized[1].kind === 'custom') {
    assert.equal(sanitized[1].serviceMode, 'design-and-build');
    assert.equal(sanitized[1].serviceModeLabel, 'Desain & Build (Gratis Desain)');
    assert.equal(sanitized[1].designAmount, 450000);
    assert.equal(sanitized[1].buildAmount, 7500000);
  }

  const withoutRoomArea = sanitizeCartItems([
    {
      kind: 'custom',
      lineId: 'custom-no-room',
      itemTypeId: 'kabinet-dapur',
      itemTypeLabel: 'Kabinet Dapur Modular',
      dimensions: { length: 200, width: 60, height: null, unit: 'cm' },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'gandum',
      colorName: 'Gandum Hangat',
      colorHex: '#D8D1C7',
      additionalOptions: [],
      notes: '',
      quantity: 1,
      estimatedUnitTotal: 5000000,
      estimatedDpAmount: 1500000,
      estimateStatus: 'configured',
    },
  ]);
  assert.equal(withoutRoomArea.length, 1);
  if (withoutRoomArea[0].kind === 'custom') {
    assert.equal(withoutRoomArea[0].projectTypeLabel, undefined);
  }
});


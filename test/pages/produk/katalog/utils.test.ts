import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProductItem } from '../../../../src/types/product';
import {
  ALL_CATEGORIES_VALUE,
  extractAvailableCategories,
  extractBaseMaterialBadges,
  extractDimensionBadges,
  extractFinishingBadges,
  filterAndSortProducts,
  formatDimensionsSummary,
  selectTopCollageProducts,
} from '../../../../src/pages/produk/katalog/utils';

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    slug: 'sofa-minimalis',
    nama: 'Sofa Minimalis',
    kategori: 'Ruang Tamu',
    deskripsiSingkat: 'Sofa tiga dudukan dengan rangka Multipleks.',
    media: ['/img/sofa.webp'],
    pilihanWarna: [{ id: 'oat', nama: 'Gandum', hex: '#D8D1C7' }],
    referensiUkuran: ['210x85', '240x85'],
    harga: {
      hpl: { multipleks: 2500000 },
      duco: {},
    },
    customisasi: [],
    include: [],
  },
  {
    id: 'p2',
    slug: 'meja-makan',
    nama: 'Meja Makan Minimalis',
    kategori: 'Ruang Makan',
    deskripsiSingkat: 'Meja makan keluarga.',
    media: ['/img/meja.webp'],
    pilihanWarna: [],
    referensiUkuran: ['200x90'],
    harga: {
      hpl: { blockboard: 1800000 },
      duco: { blockboard: 4500000 },
    },
    customisasi: [],
    include: [],
  },
  {
    id: 'p3',
    slug: 'kabinet-pantry',
    nama: 'Kabinet Pantry',
    kategori: 'Ruang Tamu',
    deskripsiSingkat: 'Kabinet serbaguna.',
    media: ['/img/pantry.webp'],
    pilihanWarna: [],
    referensiUkuran: ['150x60'],
    harga: {
      hpl: { pvc: 2000000 },
      duco: {},
    },
    customisasi: [],
    include: [],
  },
];

test('extractAvailableCategories returns unique categories driven by catalog data', () => {
  const categories = extractAvailableCategories(SAMPLE_PRODUCTS);
  assert.deepEqual(categories, [ALL_CATEGORIES_VALUE, 'Ruang Tamu', 'Ruang Makan']);
});

test('filterAndSortProducts filters by category and derives searchable materials from harga', () => {
  const byCategory = filterAndSortProducts(SAMPLE_PRODUCTS, {
    searchQuery: '',
    category: 'Ruang Tamu',
    sortBy: 'featured',
  });
  assert.equal(byCategory.length, 2);

  const byMaterial = filterAndSortProducts(SAMPLE_PRODUCTS, {
    searchQuery: 'pvc',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'featured',
  });
  assert.equal(byMaterial.length, 1);
  assert.equal(byMaterial[0].id, 'p3');
});

test('filterAndSortProducts sorts by lowest computed per-meter starting price cleanly', () => {
  const sorted = filterAndSortProducts(SAMPLE_PRODUCTS, {
    searchQuery: '',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'price-asc',
  });
  // p2 = 1.8M/m, p3 = 2.0M/m, p1 = 2.5M/m
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['p2', 'p3', 'p1']
  );
});

test('formatDimensionsSummary parses referensiUkuran strings or arrays in cm', () => {
  assert.equal(formatDimensionsSummary('210x85'), 'P 210 cm × L 85 cm');
  assert.equal(
    formatDimensionsSummary(['200x60', '250x60']),
    'P 200 cm × L 60 cm · P 250 cm × L 60 cm'
  );
  assert.equal(formatDimensionsSummary([]), 'Dimensi dikonfirmasi sesuai kebutuhan ruangan.');
});

test('badge extractors derive Custom dimensions and available materials/finishing from harga', () => {
  assert.deepEqual(extractDimensionBadges(''), ['Custom']);
  assert.deepEqual(extractDimensionBadges(['200x60', '250x60']), [
    'Custom',
    '200×60 cm',
    '250×60 cm',
  ]);

  const fullSpecProduct: ProductItem = {
    ...SAMPLE_PRODUCTS[0],
    harga: {
      hpl: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
  };
  assert.deepEqual(extractBaseMaterialBadges(fullSpecProduct), [
    'Blockboard',
    'Multipleks',
    'PVC Board',
  ]);
  assert.deepEqual(extractFinishingBadges(fullSpecProduct), ['HPL', 'Cat Duco']);
  assert.deepEqual(extractBaseMaterialBadges(SAMPLE_PRODUCTS[0]), ['Multipleks']);
  assert.deepEqual(extractFinishingBadges(SAMPLE_PRODUCTS[0]), ['HPL']);
});

test('selectTopCollageProducts picks the 3 highest per-meter catalog products descending without hardcoded overrides', () => {
  const mixedPriceCatalog: ProductItem[] = [
    ...SAMPLE_PRODUCTS,
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'expensive-partition',
      nama: 'Partisi Premium',
      kategori: 'Ruang Keluarga',
      referensiUkuran: ['250x240'],
      harga: { hpl: { blockboard: 3200000 }, duco: {} }, // 3.2M/m2
      gambarSampul: '/img/partisi.webp',
    },
    {
      ...SAMPLE_PRODUCTS[0],
      id: 'no-image-super-expensive',
      nama: 'Produk Tanpa Gambar',
      kategori: 'Lainnya',
      media: [],
      gambarSampul: '',
      referensiUkuran: ['500x300'],
      harga: { hpl: { blockboard: 5000000 }, duco: {} },
    },
  ];

  // Expected descending order among items with cover images:
  // expensive-partition (3.2M/m2), p1 (2.5M/m), p3 (2.0M/m), [p2 is 1.8M/m], [no-image excluded before cover items]
  const top3 = selectTopCollageProducts(mixedPriceCatalog, 3);
  assert.deepEqual(
    top3.map((p) => p.id),
    ['expensive-partition', 'p1', 'p3']
  );

  // Sample products alone: p1 (2.5M) > p3 (2.0M) > p2 (1.8M)
  assert.deepEqual(
    selectTopCollageProducts(SAMPLE_PRODUCTS, 3).map((p) => p.id),
    ['p1', 'p3', 'p2']
  );

  assert.deepEqual(selectTopCollageProducts([], 3), []);
});


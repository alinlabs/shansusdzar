import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProductItem } from '../../../types/product';
import {
  ALL_CATEGORIES_VALUE,
  extractAvailableCategories,
  extractBaseMaterialBadges,
  extractDimensionBadges,
  extractFinishingBadges,
  filterAndSortProducts,
  formatDimensionsSummary,
} from './utils';

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    slug: 'sofa-minimalis',
    nama: 'Sofa Minimalis',
    kategori: 'Ruang Tamu',
    deskripsiSingkat: 'Sofa tiga dudukan dengan rangka Multipleks.',
    media: [],
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
    media: [],
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
    media: [],
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

test('filterAndSortProducts sorts by lowest computed starting price cleanly', () => {
  const sorted = filterAndSortProducts(SAMPLE_PRODUCTS, {
    searchQuery: '',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'price-asc',
  });
  // p3 = 1.5m * 2.0M = 3.0M, p2 = 2.0m * 1.8M = 3.6M, p1 = 2.1m * 2.5M = 5.25M
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['p3', 'p2', 'p1']
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

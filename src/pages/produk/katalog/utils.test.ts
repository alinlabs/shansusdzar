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
  getAvailabilityLabel,
} from './utils';

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'p1',
    slug: 'sofa-minimalis',
    nama: 'Sofa Minimalis',
    kategori: 'Ruang Tamu',
    deskripsiSingkat: 'Sofa tiga dudukan dengan rangka Multipleks.',
    daftarGambar: [],
    daftarMaterial: ['Multipleks', 'HPL'],
    pilihanWarna: [{ id: 'oat', nama: 'Gandum', hex: '#D8D1C7' }],
    dimensi: { lebarCm: 210, kedalamanCm: 85, tinggiCm: 78 },
    harga: null,
    hargaMulai: null,
    statusHarga: 'konsultasi',
    kaitkanHargaCustom: false,
    ketersediaan: 'konsultasi',
    unggulan: true,
    urutan: 1,
    opsiKustom: [],
    produkContoh: true,
  },
  {
    id: 'p2',
    slug: 'meja-makan',
    nama: 'Meja Makan Minimalis',
    kategori: 'Ruang Makan',
    deskripsiSingkat: 'Meja makan keluarga.',
    daftarGambar: [],
    daftarMaterial: ['Blockboard', 'Cat Duco'],
    pilihanWarna: [],
    dimensi: { lebarCm: null, kedalamanCm: null, tinggiCm: null, catatan: 'Custom ukuran' },
    harga: 5500000,
    hargaMulai: null,
    statusHarga: 'tetap',
    ketersediaan: 'pre-order',
    unggulan: false,
    urutan: 2,
    opsiKustom: [],
    produkContoh: true,
  },
  {
    id: 'p3',
    slug: 'kabinet-pantry',
    nama: 'Kabinet Pantry PVC',
    kategori: 'Ruang Tamu',
    deskripsiSingkat: 'Kabinet serbaguna.',
    daftarGambar: [],
    daftarMaterial: ['PVC', 'Sheet'],
    pilihanWarna: [],
    dimensi: { lebarCm: null, kedalamanCm: null, tinggiCm: null },
    harga: null,
    hargaMulai: 2100000,
    statusHarga: 'mulai',
    ketersediaan: 'tersedia',
    unggulan: false,
    urutan: 3,
    opsiKustom: [],
    produkContoh: true,
  },
];

test('extractAvailableCategories returns unique categories driven by catalog data', () => {
  const categories = extractAvailableCategories(SAMPLE_PRODUCTS);
  assert.deepEqual(categories, [ALL_CATEGORIES_VALUE, 'Ruang Tamu', 'Ruang Makan']);
});

test('filterAndSortProducts filters by category and search query across fields', () => {
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

test('filterAndSortProducts sorts by price placing priced items before contact-only', () => {
  const sorted = filterAndSortProducts(SAMPLE_PRODUCTS, {
    searchQuery: '',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'price-asc',
  });
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['p3', 'p2', 'p1']
  );
});

test('formatDimensionsSummary and getAvailabilityLabel return clean Indonesian text', () => {
  assert.equal(
    formatDimensionsSummary({ lebarCm: 210, kedalamanCm: 85, tinggiCm: 78 }),
    'P 210 cm × L 85 cm × T 78 cm'
  );
  assert.equal(
    formatDimensionsSummary({ lebarCm: null, kedalamanCm: null, tinggiCm: null, catatan: 'Custom ukuran' }),
    'Custom ukuran'
  );
  assert.equal(getAvailabilityLabel('konsultasi'), 'Sesuai pesanan & konsultasi');
});

test('badge extractors always include Custom dimension and split materials from finishing', () => {
  assert.deepEqual(
    extractDimensionBadges({
      lebarCm: null,
      kedalamanCm: null,
      tinggiCm: null,
      referensiUkuran: ['2×3 m', '3×4 m'],
    }),
    ['Custom', '2×3 m', '3×4 m']
  );
  assert.deepEqual(
    extractDimensionBadges({ lebarCm: 200, kedalamanCm: 60, tinggiCm: null }),
    ['Custom', '200×60 cm']
  );

  const specProduct: ProductItem = {
    ...SAMPLE_PRODUCTS[0],
    daftarMaterial: [
      'Material Utama: MDF, Blockboard, PVC, Multipleks, atau Particle Board',
      'Finishing/Laminasi: Cat Duco, Sheet, atau HPL',
    ],
  };
  assert.deepEqual(extractBaseMaterialBadges(specProduct), [
    'MDF',
    'Blockboard',
    'PVC',
    'Multipleks',
    'Particle Board',
  ]);
  assert.deepEqual(extractFinishingBadges(specProduct), ['Cat Duco', 'Sheet', 'HPL']);
});

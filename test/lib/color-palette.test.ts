import assert from 'node:assert/strict';
import test from 'node:test';
import { filterColorOptions, UNIVERSAL_COLOR_PALETTE } from '../../src/lib/color-palette.ts';

test('filterColorOptions mengembalikan semua warna saat query kosong atau spasi', () => {
  assert.equal(filterColorOptions(UNIVERSAL_COLOR_PALETTE, '').length, UNIVERSAL_COLOR_PALETTE.length);
  assert.equal(filterColorOptions(UNIVERSAL_COLOR_PALETTE, '   ').length, UNIVERSAL_COLOR_PALETTE.length);
});

test('filterColorOptions mencocokkan nama warna tanpa memperhatikan kapitalisasi', () => {
  const result = filterColorOptions(UNIVERSAL_COLOR_PALETTE, 'walnut');
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'walnut-tua');
});

test('filterColorOptions mencocokkan catatan nuansa dan beberapa kata kunci sekaligus', () => {
  const result = filterColorOptions(UNIVERSAL_COLOR_PALETTE, 'kayu hangat');
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'kayu-muda');
});

test('filterColorOptions mengembalikan array kosong jika tidak ada warna yang cocok', () => {
  const result = filterColorOptions(UNIVERSAL_COLOR_PALETTE, 'merah neon');
  assert.deepEqual(result, []);
});

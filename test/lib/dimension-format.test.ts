import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractDimensionAreaPairCm,
  formatDimensionParts,
  formatDocumentDimensionDisplay,
  normalizeDimensionString,
  parseDimensionParts,
  sanitizeDimensionColumnInput,
} from '../../src/lib/dimension-format';

test('parseDimensionParts extracts P, L, T in cm while stripping units and separators', () => {
  assert.deepEqual(parseDimensionParts('320 x 60 x 85 cm'), ['320', '60', '85']);
  assert.deepEqual(parseDimensionParts('250 × 220 cm'), ['250', '220', '']);
  assert.deepEqual(parseDimensionParts('180×60×110CM'), ['180', '60', '110']);
  assert.deepEqual(parseDimensionParts('240 * 45 * 200'), ['240', '45', '200']);
  assert.deepEqual(parseDimensionParts('120,5 x 60 x 85 cm'), ['120.5', '60', '85']);
  assert.deepEqual(parseDimensionParts('Sesuai Gambar Kerja Lapangan'), ['', '', '']);
  assert.deepEqual(parseDimensionParts(''), ['', '', '']);
});

test('formatDimensionParts formats non-empty numeric columns cleanly without cm', () => {
  assert.equal(formatDimensionParts(['320', '60', '85']), '320 x 60 x 85');
  assert.equal(formatDimensionParts(['250', '220', '']), '250 x 220');
  assert.equal(formatDimensionParts(['180', '', '']), '180');
  assert.equal(formatDimensionParts(['', '', '']), '');
});

test('normalizeDimensionString and formatDocumentDimensionDisplay strip cm and preserve prose fallbacks', () => {
  assert.equal(normalizeDimensionString('  320 × 60 × 85 cm  '), '320 x 60 x 85');
  assert.equal(normalizeDimensionString('200x60cm'), '200 x 60');
  assert.equal(normalizeDimensionString('120 cm'), '120');
  assert.equal(normalizeDimensionString('Sesuai Gambar Kerja Lapangan'), 'Sesuai Gambar Kerja Lapangan');
  assert.equal(normalizeDimensionString('   '), '');
  assert.equal(formatDocumentDimensionDisplay('380 x 60 x 220 cm'), '380 x 60 x 220');
});

test('sanitizeDimensionColumnInput preserves live numeric decimals safely', () => {
  assert.equal(sanitizeDimensionColumnInput('320cm'), '320');
  assert.equal(sanitizeDimensionColumnInput('60,5'), '60.5');
  assert.equal(sanitizeDimensionColumnInput('085'), '85');
  assert.equal(sanitizeDimensionColumnInput('120.'), '120.');
  assert.equal(sanitizeDimensionColumnInput('abc'), '');
});

test('extractDimensionAreaPairCm computes P x T pair from 2-part and 3-part strings', () => {
  assert.deepEqual(extractDimensionAreaPairCm('250 x 220'), { lengthCm: 250, widthCm: 220 });
  assert.deepEqual(extractDimensionAreaPairCm('320 x 60 x 85'), { lengthCm: 320, widthCm: 85 });
  assert.equal(extractDimensionAreaPairCm('Sesuai Gambar Kerja Lapangan'), null);
});

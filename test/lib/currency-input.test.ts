import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatNominalDigits,
  formatNominalNumber,
  formatNominalWithCaret,
  parseNominalInput,
} from '../../src/lib/currency-input';

test('formatNominalDigits formats thousands with Indonesian dot separators', () => {
  assert.equal(formatNominalDigits(''), '');
  assert.equal(formatNominalDigits('0'), '0');
  assert.equal(formatNominalDigits('1000'), '1.000');
  assert.equal(formatNominalDigits('10000'), '10.000');
  assert.equal(formatNominalDigits('100000'), '100.000');
  assert.equal(formatNominalDigits('1000000'), '1.000.000');
  assert.equal(formatNominalDigits('10000000'), '10.000.000');
  assert.equal(formatNominalDigits('1000000000'), '1.000.000.000');
  assert.equal(formatNominalDigits('000500'), '500');
});

test('parseNominalInput separates numeric value cleanly from formatted display', () => {
  assert.deepEqual(parseNominalInput(''), { numericValue: null, formatted: '' });
  assert.deepEqual(parseNominalInput('0'), { numericValue: 0, formatted: '0' });
  assert.deepEqual(parseNominalInput('Rp 1.500.000'), {
    numericValue: 1500000,
    formatted: '1.500.000',
  });
  assert.deepEqual(parseNominalInput('2500000'), {
    numericValue: 2500000,
    formatted: '2.500.000',
  });
});

test('formatNominalNumber respects zeroAsEmpty option', () => {
  assert.equal(formatNominalNumber(null), '');
  assert.equal(formatNominalNumber(0, { zeroAsEmpty: false }), '0');
  assert.equal(formatNominalNumber(0, { zeroAsEmpty: true }), '');
  assert.equal(formatNominalNumber(4850000), '4.850.000');
});

test('formatNominalWithCaret preserves caret across thousand separator insertions', () => {
  // User typed '5' inside "1.000.000" after '1' -> raw "15.000.000" with caret at 2
  const res = formatNominalWithCaret({
    rawValue: '15.000.000',
    rawCaret: 2,
  });
  assert.equal(res.formatted, '15.000.000');
  assert.equal(res.numericValue, 15000000);
  assert.equal(res.caret, 2);

  // User typed '0' at end of "100.000" -> raw "100.0000" caret at 8 -> formatted "1.000.000", caret at 9
  const appended = formatNominalWithCaret({
    rawValue: '100.0000',
    rawCaret: 8,
  });
  assert.equal(appended.formatted, '1.000.000');
  assert.equal(appended.numericValue, 1000000);
  assert.equal(appended.caret, 9);
});

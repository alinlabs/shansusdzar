import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocumentPhoneDisplay,
  formatIndonesianSubscriberGroups,
  formatPhoneWithCaret,
  normalizePastedPhone,
  parseIndonesianPhoneInput,
  validateIndonesianPhoneNumber,
} from '../../src/lib/phone-format';

test('formatIndonesianSubscriberGroups applies 3-4-4-4 grouping without trailing hyphens', () => {
  assert.equal(formatIndonesianSubscriberGroups(''), '');
  assert.equal(formatIndonesianSubscriberGroups('8'), '8');
  assert.equal(formatIndonesianSubscriberGroups('812'), '812');
  assert.equal(formatIndonesianSubscriberGroups('8123'), '812-3');
  assert.equal(formatIndonesianSubscriberGroups('8123456'), '812-3456');
  assert.equal(formatIndonesianSubscriberGroups('81234567890'), '812-3456-7890');
  assert.equal(formatIndonesianSubscriberGroups('8123456789012'), '812-3456-7890-12');
});

test('typing 0, 6, 8, or raw digits into empty field auto-prefixes +62 without duplication', () => {
  assert.equal(parseIndonesianPhoneInput('0', { preservePrefixOnly: true }).formatted, '+62 ');
  assert.equal(parseIndonesianPhoneInput('6', { preservePrefixOnly: true }).formatted, '+62 ');
  assert.equal(parseIndonesianPhoneInput('8').formatted, '+62 8');
  assert.equal(parseIndonesianPhoneInput('12345679').formatted, '+62 123-4567-9');
  assert.equal(parseIndonesianPhoneInput('081234567890').formatted, '+62 812-3456-7890');
  assert.equal(parseIndonesianPhoneInput('081234567890').e164, '+6281234567890');
});

test('normalizePastedPhone handles all clipboard variations cleanly', () => {
  const expectedE164 = '+6281234567890';
  const expectedFormatted = '+62 812-3456-7890';

  for (const sample of [
    '081234567890',
    '6281234567890',
    '+6281234567890',
    '+62 812-3456-7890',
    '81234567890',
    '+62 0812 3456 7890',
    '+62 62 812-3456-7890',
  ]) {
    const res = normalizePastedPhone(sample);
    assert.equal(res.e164, expectedE164, `Failed e164 for ${sample}`);
    assert.equal(res.formatted, expectedFormatted, `Failed formatted for ${sample}`);
  }
});

test('formatPhoneWithCaret preserves caret when inserting or deleting digits in the middle', () => {
  // User had "+62 812-3456-7890", inserted '9' after '3' -> raw "+62 812-39456-7890", caret after '9' (index 10)
  const inserted = formatPhoneWithCaret({
    rawValue: '+62 812-39456-7890',
    rawCaret: 10,
    previousFormatted: '+62 812-3456-7890',
  });
  assert.equal(inserted.formatted, '+62 812-3945-6789-0');
  assert.equal(inserted.caret, 10);

  // Clearing "+62 " empties field completely
  const cleared = formatPhoneWithCaret({
    rawValue: '+62',
    rawCaret: 3,
    previousFormatted: '+62 ',
  });
  assert.equal(cleared.formatted, '');
  assert.equal(cleared.e164, '');
  assert.equal(cleared.caret, 0);
});

test('validateIndonesianPhoneNumber enforces Indonesian digit lengths and rejects invalid input', () => {
  assert.deepEqual(validateIndonesianPhoneNumber('085797184059'), {
    isValid: true,
    normalized: '+6285797184059',
  });
  assert.deepEqual(validateIndonesianPhoneNumber('+62 812-3456-7890'), {
    isValid: true,
    normalized: '+6281234567890',
  });
  assert.equal(validateIndonesianPhoneNumber('08123').isValid, false);
  assert.equal(validateIndonesianPhoneNumber('0812abc789').isValid, false);
  assert.equal(validateIndonesianPhoneNumber('   ').isValid, false);
});

test('formatDocumentPhoneDisplay formats Indonesian client phones to 08xx-xxxx-xxxx for documents only', () => {
  assert.equal(formatDocumentPhoneDisplay('+6281388204410'), '0813-8820-4410');
  assert.equal(formatDocumentPhoneDisplay('+62 812-3456-7890'), '0812-3456-7890');
  assert.equal(formatDocumentPhoneDisplay('6281294401122'), '0812-9440-1122');
  assert.equal(formatDocumentPhoneDisplay('08119200450'), '0811-9200-450');
  assert.equal(formatDocumentPhoneDisplay('8156022310'), '0815-6022-310');
  assert.equal(formatDocumentPhoneDisplay('085797184059'), '0857-9718-4059');
  assert.equal(formatDocumentPhoneDisplay('+65 9123 4567'), '+6591234567');
  assert.equal(formatDocumentPhoneDisplay(''), '');
  assert.equal(formatDocumentPhoneDisplay('-'), '');
  assert.equal(formatDocumentPhoneDisplay(null), '');
});

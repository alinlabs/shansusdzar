import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeolocationErrorMessage,
  formatCoordinatesLabel,
  normalizeIndonesianPhone,
  validateCustomerForm,
} from '../../../src/pages/pesanan/utils';

test('normalizeIndonesianPhone handles local, +62, 62, and international formats cleanly', () => {
  assert.deepEqual(normalizeIndonesianPhone('085797184059'), {
    isValid: true,
    normalized: '+6285797184059',
  });
  assert.deepEqual(normalizeIndonesianPhone('+62 812-3456-7890'), {
    isValid: true,
    normalized: '+6281234567890',
  });
  assert.deepEqual(normalizeIndonesianPhone('6281398765432'), {
    isValid: true,
    normalized: '+6281398765432',
  });
  assert.deepEqual(normalizeIndonesianPhone('+65 9123 4567'), {
    isValid: true,
    normalized: '+6591234567',
  });
  assert.equal(normalizeIndonesianPhone('08123').isValid, false);
  assert.equal(normalizeIndonesianPhone('0812abc789').isValid, false);
  assert.equal(normalizeIndonesianPhone('   ').isValid, false);
});

test('validateCustomerForm requires name, valid phone, and address while keeping notes optional', () => {
  const invalid = validateCustomerForm({
    fullName: '',
    phone: '123',
    address: 'Jl. A',
    notes: '',
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.fullName);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.address);

  const valid = validateCustomerForm({
    fullName: 'Budi Santoso',
    phone: '085797184059',
    address: 'Kp. Tegal Jati, Cibogohilir, Purwakarta',
    notes: '',
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.normalizedPhone, '+6285797184059');
});

test('buildGeolocationErrorMessage covers permission, unavailable, timeout, and unsupported states', () => {
  assert.ok(buildGeolocationErrorMessage(1).includes('belum diizinkan'));
  assert.ok(buildGeolocationErrorMessage(2).includes('tidak dapat ditentukan'));
  assert.ok(buildGeolocationErrorMessage(3).includes('batas waktu'));
  assert.ok(buildGeolocationErrorMessage('unsupported').includes('tidak mendukung'));
});

test('formatCoordinatesLabel formats latitude, longitude, and rounded accuracy', () => {
  const label = formatCoordinatesLabel({
    latitude: -6.5569123,
    longitude: 107.4439456,
    accuracyMeters: 18.4,
    capturedAtIso: '2026-11-18T00:00:00.000Z',
  });
  assert.equal(label, '-6.556912, 107.443946 (±18 m)');
});

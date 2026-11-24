import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOrderFormCache } from './order-form-cache';

test('sanitizeOrderFormCache restores valid form values and coordinates cleanly', () => {
  const restored = sanitizeOrderFormCache({
    schemaVersion: 1,
    values: {
      fullName: 'Budi Santoso',
      phone: '085797184059',
      address: 'Kp. Tegal Jati, Purwakarta',
      notes: 'Tolong hubungi sebelum kirim',
    },
    coordinates: {
      latitude: -6.5569,
      longitude: 107.4439,
      accuracyMeters: 15,
      capturedAtIso: '2026-11-18T12:00:00.000Z',
    },
  });

  assert.equal(restored.values.fullName, 'Budi Santoso');
  assert.equal(restored.values.phone, '085797184059');
  assert.equal(restored.values.address, 'Kp. Tegal Jati, Purwakarta');
  assert.equal(restored.values.notes, 'Tolong hubungi sebelum kirim');
  assert.deepEqual(restored.coordinates, {
    latitude: -6.5569,
    longitude: 107.4439,
    accuracyMeters: 15,
    capturedAtIso: '2026-11-18T12:00:00.000Z',
  });
});

test('sanitizeOrderFormCache safely handles malformed inputs and invalid coordinates', () => {
  const malformed = sanitizeOrderFormCache('corrupt');
  assert.deepEqual(malformed, {
    values: { fullName: '', phone: '', address: '', notes: '' },
    coordinates: null,
  });

  const partial = sanitizeOrderFormCache({
    values: { fullName: 'Siti', phone: 123, address: null, notes: 'Catatan' },
    coordinates: { latitude: 'NaN', longitude: 107.4 },
  });
  assert.deepEqual(partial, {
    values: { fullName: 'Siti', phone: '', address: '', notes: 'Catatan' },
    coordinates: null,
  });
});

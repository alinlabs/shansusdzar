import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrencyIDR,
  formatPreliminaryEstimate,
  formatProductPrice,
} from '../../src/lib/price-format';

test('formatCurrencyIDR formats positive numbers in IDR and rejects zero/null', () => {
  assert.equal(formatCurrencyIDR(null), null);
  assert.equal(formatCurrencyIDR(undefined), null);
  assert.equal(formatCurrencyIDR(0), null);
  assert.equal(formatCurrencyIDR(-50000), null);
  const formatted = formatCurrencyIDR(4500000);
  assert.ok(formatted && formatted.includes('4.500.000'));
});

test('formatProductPrice handles fixed, from, and contact states honestly', () => {
  const contact = formatProductPrice({ price: null, priceFrom: null, priceStatus: 'konsultasi' });
  assert.equal(contact.label, 'Hubungi kami untuk harga');
  assert.equal(contact.isAvailable, false);

  const zeroFixed = formatProductPrice({ price: 0, priceFrom: null, priceStatus: 'tetap' });
  assert.equal(zeroFixed.label, 'Hubungi kami untuk harga');
  assert.equal(zeroFixed.isAvailable, false);

  const validFrom = formatProductPrice({ price: null, priceFrom: 2500000, priceStatus: 'mulai' });
  assert.ok(validFrom.label.startsWith('Mulai dari'));
  assert.ok(validFrom.label.includes('2.500.000'));
  assert.equal(validFrom.isAvailable, true);
});

test('formatPreliminaryEstimate never displays Rp0 when unconfigured', () => {
  assert.equal(formatPreliminaryEstimate(null), 'Hubungi kami untuk estimasi');
  assert.equal(formatPreliminaryEstimate(0), 'Hubungi kami untuk estimasi');
  assert.ok(formatPreliminaryEstimate(3000000).includes('Estimasi'));
});

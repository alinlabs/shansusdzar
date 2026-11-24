import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultPaymentForm,
  createEmptyInvoice,
  normalizeInvoicePayload,
  validateInvoiceDraft,
  validatePaymentForm,
} from './logic';

test('validateInvoiceDraft catches missing fields and zero value', () => {
  const draft = createEmptyInvoice(50);
  const res = validateInvoiceDraft(draft);
  assert.equal(res.valid, false);
  assert.ok(res.fieldErrors.namaProyek);
  assert.ok(res.fieldErrors.namaKlien);
  assert.ok(res.fieldErrors.nilaiTotalKontrak);
});

test('normalizeInvoicePayload cleans empty lineItems and trims text', () => {
  const draft = createEmptyInvoice(51);
  draft.namaProyek = '  Kitchen Set L-Shape  ';
  draft.namaKlien = '  Ibu Rina  ';
  draft.nilaiTotalKontrak = 18500000;
  draft.rincianItem = [
    { id: '1', deskripsi: '  Kabinet Atas ', jumlah: 2, hargaSatuan: 4500000 },
    { id: '2', deskripsi: '   ', jumlah: 1, hargaSatuan: 0 },
  ];
  assert.equal(validateInvoiceDraft(draft).valid, true);
  const normalized = normalizeInvoicePayload(draft);
  assert.equal(normalized.namaProyek, 'Kitchen Set L-Shape');
  assert.equal(normalized.rincianItem?.length, 1);
});

test('createDefaultPaymentForm suggests stage 1 Down Payment 30% then Termin 2 Progress Produksi 40% from payment scheme', () => {
  const draft = createEmptyInvoice(52);
  draft.nilaiTotalKontrak = 10000000;
  const paymentForm = createDefaultPaymentForm(draft);
  assert.equal(paymentForm.label, 'Termin 1 : Down Payment 30%');
  assert.equal(paymentForm.amount, 3000000);
  assert.equal(validatePaymentForm(paymentForm).valid, true);

  draft.riwayatPembayaran = [
    {
      id: 'p1',
      tanggal: '2026-11-20',
      label: paymentForm.label,
      nominal: 3000000,
      metodePembayaran: 'Transfer Bank',
      catatan: '',
    },
  ];
  const nextForm = createDefaultPaymentForm(draft);
  assert.equal(nextForm.label, 'Termin 2 : Progress Produksi 40%');
  assert.equal(nextForm.amount, 4000000);

  nextForm.amount = 0;
  assert.equal(validatePaymentForm(nextForm).valid, false);
});

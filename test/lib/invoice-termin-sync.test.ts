import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PROJECT_INVOICES,
  computeInvoiceProgress,
} from '../../src/lib/finance-utils';
import {
  applyInvoiceMasterStatusChange,
  applyInvoiceStageStatusChange,
} from '../../src/lib/invoice-termin-sync';
import {
  DEFAULT_PAYMENT_SCHEME,
  evaluateInvoicePaymentSchedule,
} from '../../src/lib/payment-scheme';

test('applyInvoiceStageStatusChange marks a specific unpaid termin Lunas and updates cashflow transactions', () => {
  const inv2 = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-005');
  assert.ok(inv2, 'Expected auto-inv-K-005');

  // inv-042 has Termin 1 (7.2M) and Termin 2 (9.6M) paid out of 24M; Termin 3 target = 4.8M
  const res = applyInvoiceStageStatusChange({
    invoice: inv2,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    stageIndex: 2,
    targetStatus: 'Lunas',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
    paymentDate: '2026-11-25',
    nowIso: '2026-11-25T10:00:00.000Z',
  });

  assert.equal(res.changed, true);
  assert.equal(computeInvoiceProgress(res.invoice).paidAmount, 21_600_000);
  assert.equal(res.invoice.status, 'Berjalan');
  assert.equal(res.transactions.length, DEFAULT_FINANCE_TRANSACTIONS.length + 1);
  assert.match(res.transactions[0].judul, /Termin 3/i);
  assert.equal(res.transactions[0].nominal, 4_800_000);

  const schedule = evaluateInvoicePaymentSchedule(
    res.invoice.nilaiTotalKontrak,
    res.invoice.riwayatPembayaran,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(schedule.stages[0].status, 'Lunas');
  assert.equal(schedule.stages[1].status, 'Lunas');
  assert.equal(schedule.stages[2].status, 'Lunas');
  assert.equal(schedule.stages[3].status, 'Belum Dibayar');
});

test('applyInvoiceStageStatusChange can mark an earlier paid termin back to Belum Dibayar without disturbing later paid termins', () => {
  const inv2 = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-005');
  assert.ok(inv2, 'Expected auto-inv-K-005');

  // Mark Termin 1 back to Belum Dibayar while Termin 2 (9.6M) stays paid
  const res = applyInvoiceStageStatusChange({
    invoice: inv2,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    stageIndex: 0,
    targetStatus: 'Belum Dibayar',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  assert.equal(res.changed, true);
  assert.equal(computeInvoiceProgress(res.invoice).paidAmount, 9_600_000);

  const schedule = evaluateInvoicePaymentSchedule(
    res.invoice.nilaiTotalKontrak,
    res.invoice.riwayatPembayaran,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(schedule.stages[0].status, 'Belum Dibayar');
  assert.equal(schedule.stages[0].paidAmount, 0);
  assert.equal(schedule.stages[1].status, 'Lunas');
  assert.equal(schedule.stages[1].paidAmount, 9_600_000);
  assert.equal(schedule.stages[2].status, 'Belum Dibayar');
  assert.equal(schedule.stages[3].status, 'Belum Dibayar');
});

test('applyInvoiceMasterStatusChange toggles all stages between Belum Dibayar and Lunas cleanly', () => {
  const inv4 = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-004');
  assert.ok(inv4, 'Expected auto-inv-K-004 (unpaid 16.8M)');

  const toPaid = applyInvoiceMasterStatusChange({
    invoice: inv4,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    targetStatus: 'Lunas',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
    paymentDate: '2026-11-25',
  });

  assert.equal(toPaid.changed, true);
  assert.equal(toPaid.invoice.status, 'Lunas');
  assert.equal(computeInvoiceProgress(toPaid.invoice).paidAmount, 16_800_000);
  assert.equal(toPaid.invoice.riwayatPembayaran.length, 4);
  assert.equal(toPaid.transactions.length, DEFAULT_FINANCE_TRANSACTIONS.length + 4);

  const backToUnpaid = applyInvoiceMasterStatusChange({
    invoice: toPaid.invoice,
    transactions: toPaid.transactions,
    targetStatus: 'Belum Dibayar',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  assert.equal(backToUnpaid.changed, true);
  assert.equal(backToUnpaid.invoice.status, 'Menunggu DP');
  assert.equal(backToUnpaid.invoice.riwayatPembayaran.length, 0);
  assert.equal(backToUnpaid.transactions.length, DEFAULT_FINANCE_TRANSACTIONS.length);
});

test('applyInvoiceStageStatusChange handles non-sequential Lunas toggle and removes matching cashflow transaction on revert', () => {
  const inv3 = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-002');
  assert.ok(inv3, 'Expected auto-inv-K-002 (Termin 1 paid, 2-4 unpaid)');

  // Mark Termin 3 (index 2, 20% of 22.5M = 4.5M) Lunas while Termin 2 stays unpaid
  const paidT3 = applyInvoiceStageStatusChange({
    invoice: inv3,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    stageIndex: 2,
    targetStatus: 'Lunas',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
    paymentDate: '2026-11-25',
  });

  const schedulePaid = evaluateInvoicePaymentSchedule(
    paidT3.invoice.nilaiTotalKontrak,
    paidT3.invoice.riwayatPembayaran,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(schedulePaid.stages[0].status, 'Lunas');
  assert.equal(schedulePaid.stages[1].status, 'Belum Dibayar');
  assert.equal(schedulePaid.stages[2].status, 'Lunas');
  assert.equal(schedulePaid.stages[2].paidAmount, 4_500_000);

  // Revert Termin 1 (index 0) — should also remove fin-tx-003 (Termin 1 of inv-043)
  const revertedT1 = applyInvoiceStageStatusChange({
    invoice: paidT3.invoice,
    transactions: paidT3.transactions,
    stageIndex: 0,
    targetStatus: 'Belum Dibayar',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  assert.equal(
    revertedT1.transactions.some((tx) => tx.id === 'fin-tx-003'),
    false
  );
  const scheduleAfterRevert = evaluateInvoicePaymentSchedule(
    revertedT1.invoice.nilaiTotalKontrak,
    revertedT1.invoice.riwayatPembayaran,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(scheduleAfterRevert.stages[0].status, 'Belum Dibayar');
  assert.equal(scheduleAfterRevert.stages[2].status, 'Lunas');
});

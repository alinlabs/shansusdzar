import assert from 'node:assert/strict';
import test from 'node:test';
import paymentSchemeJson from '../../src/data/skema-pembayaran.json';
import {
  DEFAULT_PAYMENT_SCHEME,
  buildAgreementPaymentClauseText,
  calculatePaymentSchemeBreakdown,
  computeFinanceScheduleSummary,
  computePaymentSchemeTotalPercent,
  deriveLegacyThreeStagePercentages,
  evaluateInvoicePaymentSchedule,
  formatPaymentSchemeSummary,
  formatPaymentStageTerminName,
  resolveEffectivePaymentScheme,
  resolvePaymentSchemeDpPercentage,
  sanitizePaymentScheme,
  stripPaymentStageTerminPrefix,
} from '../../src/lib/payment-scheme';

test('DEFAULT_PAYMENT_SCHEME matches 30% DP, 40% production, 20% pre-install, 10% BAST and JSON only has tahap, persentase, ketentuan', () => {
  assert.equal(Array.isArray(paymentSchemeJson), true);
  assert.equal(paymentSchemeJson.length, 4);
  for (const row of paymentSchemeJson) {
    assert.deepEqual(Object.keys(row).sort(), ['ketentuan', 'persentase', 'tahap']);
    assert.equal(/^termin\s*\d*/i.test(row.tahap), false);
  }

  assert.equal(DEFAULT_PAYMENT_SCHEME.tahapan.length, 4);
  assert.deepEqual(
    DEFAULT_PAYMENT_SCHEME.tahapan.map((t) => t.nama),
    [
      'Termin 1 : Down Payment',
      'Termin 2 : Progress Produksi',
      'Termin 3 : Pra-Instalasi',
      'Termin 4 : Serah Terima',
    ]
  );
  assert.equal(computePaymentSchemeTotalPercent(DEFAULT_PAYMENT_SCHEME.tahapan), 100);
  assert.deepEqual(
    DEFAULT_PAYMENT_SCHEME.tahapan.map((t) => t.persentase),
    [30, 40, 20, 10]
  );
  assert.equal(resolvePaymentSchemeDpPercentage(DEFAULT_PAYMENT_SCHEME), 30);
});

test('stripPaymentStageTerminPrefix & formatPaymentStageTerminName normalize stage titles automatically', () => {
  assert.equal(stripPaymentStageTerminPrefix('Termin 1 : Down Payment'), 'Down Payment');
  assert.equal(stripPaymentStageTerminPrefix('Down Payment'), 'Down Payment');
  assert.equal(stripPaymentStageTerminPrefix('Termin 5'), '');
  assert.equal(formatPaymentStageTerminName('Down Payment', 1), 'Termin 1 : Down Payment');
  assert.equal(
    formatPaymentStageTerminName('Termin 3 : Progress Produksi', 2),
    'Termin 2 : Progress Produksi'
  );
});

test('calculatePaymentSchemeBreakdown allocates exact Rupiah totals summing to 100%', () => {
  const breakdown = calculatePaymentSchemeBreakdown(10_000_000, DEFAULT_PAYMENT_SCHEME);
  assert.deepEqual(
    breakdown.map((b) => b.amount),
    [3_000_000, 4_000_000, 2_000_000, 1_000_000]
  );

  // Check rounding residual safety on non-round totals
  const oddTotal = 9_999_997;
  const oddBreakdown = calculatePaymentSchemeBreakdown(oddTotal, DEFAULT_PAYMENT_SCHEME);
  const sum = oddBreakdown.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  assert.equal(sum, oddTotal);
});

test('calculatePaymentSchemeBreakdown returns null amounts when total is missing or non-positive', () => {
  const unset = calculatePaymentSchemeBreakdown(null, DEFAULT_PAYMENT_SCHEME);
  assert.equal(unset.length, 4);
  assert.ok(unset.every((item) => item.amount === null));
});

test('sanitizePaymentScheme preserves valid edits, auto-prefixes Termin N :, and falls back cleanly on malformed inputs', () => {
  const invalid = sanitizePaymentScheme({ tahapan: [{ nama: '', persentase: 200 }] });
  assert.deepEqual(invalid, DEFAULT_PAYMENT_SCHEME);

  const edited = sanitizePaymentScheme({
    judul: 'Skema Khusus Proyek',
    catatan: 'Transfer resmi',
    tahapan: [
      { id: 't2', urutan: 2, nama: 'Pelunasan', persentase: 60, keterangan: 'Saat BAST' },
      { id: 't1', urutan: 1, nama: 'DP', persentase: 40, keterangan: 'Saat kontrak' },
    ],
  });
  assert.equal(edited.tahapan[0].nama, 'Termin 1 : DP');
  assert.equal(edited.tahapan[0].urutan, 1);
  assert.equal(edited.tahapan[1].nama, 'Termin 2 : Pelunasan');
  assert.equal(edited.tahapan[1].urutan, 2);
  assert.ok(formatPaymentSchemeSummary(edited).includes('Termin 1 : DP 40%'));
});

test('deriveLegacyThreeStagePercentages & buildAgreementPaymentClauseText map 4-stage scheme accurately', () => {
  const legacy = deriveLegacyThreeStagePercentages(DEFAULT_PAYMENT_SCHEME.tahapan);
  assert.deepEqual(legacy, {
    persenDp: 30,
    persenProgres: 60,
    persenPelunasan: 10,
  });

  const clause = buildAgreementPaymentClauseText(
    DEFAULT_PAYMENT_SCHEME.tahapan,
    DEFAULT_PAYMENT_SCHEME.catatan
  );
  assert.match(clause, /30%/);
  assert.match(clause, /40%/);
  assert.match(clause, /20%/);
  assert.match(clause, /10%/);
  assert.match(clause, /BAST/i);
});

test('evaluateInvoicePaymentSchedule tracks paid, partial, unpaid stages and next/final stage', () => {
  const schedule = evaluateInvoicePaymentSchedule(
    10_000_000,
    [{ nominal: 5_000_000 }],
    DEFAULT_PAYMENT_SCHEME
  );

  assert.equal(schedule.stages[0].status, 'Lunas');
  assert.equal(schedule.stages[0].paidAmount, 3_000_000);
  assert.equal(schedule.stages[1].status, 'Sebagian');
  assert.equal(schedule.stages[1].paidAmount, 2_000_000);
  assert.equal(schedule.stages[1].remainingAmount, 2_000_000);
  assert.equal(schedule.stages[1].progressPercent, 50);
  assert.equal(schedule.stages[2].status, 'Belum Dibayar');
  assert.equal(schedule.stages[3].status, 'Belum Dibayar');
  assert.equal(schedule.nextStage?.id, schedule.stages[1].id);
  assert.equal(schedule.finalStage?.persentase, 10);
  assert.equal(schedule.finalStage?.targetAmount, 1_000_000);
});

test('computeFinanceScheduleSummary aggregates stage receivables across invoices', () => {
  const effective = resolveEffectivePaymentScheme(null, DEFAULT_PAYMENT_SCHEME);
  const summary = computeFinanceScheduleSummary(
    [
      {
        nilaiTotalKontrak: 10_000_000,
        riwayatPembayaran: [{ nominal: 10_000_000 }],
        skemaPembayaran: effective.tahapan,
      },
      {
        nilaiTotalKontrak: 20_000_000,
        riwayatPembayaran: [{ nominal: 6_000_000 }],
      },
    ],
    DEFAULT_PAYMENT_SCHEME
  );

  assert.equal(summary.length, 4);
  // Stage 1 (30%): 3jt + 6jt = 9jt target, 9jt collected, 0 remaining
  assert.equal(summary[0].totalTarget, 9_000_000);
  assert.equal(summary[0].totalCollected, 9_000_000);
  assert.equal(summary[0].totalRemaining, 0);
  assert.equal(summary[0].pendingInvoiceCount, 0);

  // Stage 2 (40%): 4jt + 8jt = 12jt target, 4jt collected, 8jt remaining, 1 pending invoice
  assert.equal(summary[1].totalTarget, 12_000_000);
  assert.equal(summary[1].totalCollected, 4_000_000);
  assert.equal(summary[1].totalRemaining, 8_000_000);
  assert.equal(summary[1].pendingInvoiceCount, 1);

  // Stage 4 (10% BAST): 1jt + 2jt = 3jt target, 1jt collected, 2jt remaining
  assert.equal(summary[3].totalTarget, 3_000_000);
  assert.equal(summary[3].totalCollected, 1_000_000);
  assert.equal(summary[3].totalRemaining, 2_000_000);
});

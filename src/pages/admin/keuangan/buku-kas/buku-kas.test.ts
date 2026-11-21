import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFilteredLedgerTotals,
  createEmptyTransaction,
  normalizeTransactionPayload,
  resolveCategoryForType,
  validateTransactionDraft,
} from './logic';

test('resolveCategoryForType switches incompatible category when flow type changes', () => {
  assert.equal(resolveCategoryForType('pengeluaran', 'DP Proyek'), 'Bahan & Material');
  assert.equal(resolveCategoryForType('pengeluaran', 'Upah Produksi'), 'Upah Produksi');
  assert.equal(resolveCategoryForType('pemasukan', 'Bahan & Material'), 'DP Proyek');
});

test('validateTransactionDraft and normalizeTransactionPayload enforce required fields', () => {
  const empty = createEmptyTransaction();
  const invalid = validateTransactionDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.title || invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.counterparty || invalid.fieldErrors.pihakTerkait);
  assert.ok(invalid.fieldErrors.amount || invalid.fieldErrors.nominal);

  const valid = normalizeTransactionPayload({
    ...empty,
    judul: '  DP Kitchen  ',
    pihakTerkait: '  Bapak Andi  ',
    referensiProyek: ' INV-1 ',
    nominal: 5000000.6,
  });
  assert.equal(valid.judul, 'DP Kitchen');
  assert.equal(valid.pihakTerkait, 'Bapak Andi');
  assert.equal(valid.referensiProyek, 'INV-1');
  assert.equal(valid.nominal, 5000001);
});

test('computeFilteredLedgerTotals sums income and expense separately', () => {
  const base = createEmptyTransaction();
  const totals = computeFilteredLedgerTotals([
    { ...base, id: '1', jenis: 'pemasukan', nominal: 7000000 },
    { ...base, id: '2', jenis: 'pengeluaran', nominal: 2500000 },
    { ...base, id: '3', jenis: 'pemasukan', nominal: 3000000 },
  ]);
  assert.equal(totals.income, 10000000);
  assert.equal(totals.expense, 2500000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { FinanceTransaction } from '../../../../types/finance';
import {
  computePurchaseStats,
  createEmptyPurchase,
  filterPurchases,
  normalizePurchasePayload,
  validatePurchaseDraft,
} from './logic';

const SAMPLE_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: 'tx-1',
    tanggal: '2026-11-18',
    jenis: 'pengeluaran',
    kategori: 'Bahan & Material',
    judul: 'Multipleks 18mm',
    referensiProyek: 'INV-SDI-2026-041',
    pihakTerkait: 'TB Sumber Jaya',
    metodePembayaran: 'Transfer Bank',
    nominal: 3500000,
    status: 'Selesai',
    catatan: 'Nota #12',
    dibuatPada: '2026-11-18T00:00:00Z',
  },
  {
    id: 'tx-2',
    tanggal: '2026-11-19',
    jenis: 'pengeluaran',
    kategori: 'Upah Produksi',
    judul: 'Upah Tukang Finishing',
    referensiProyek: '',
    pihakTerkait: 'Tim Tukang',
    metodePembayaran: 'Cash Workshop',
    nominal: 1500000,
    status: 'Tertunda',
    catatan: '',
    dibuatPada: '2026-11-19T00:00:00Z',
  },
  {
    id: 'tx-3',
    tanggal: '2026-11-20',
    jenis: 'pemasukan',
    kategori: 'DP Proyek',
    judul: 'DP Kitchen Set',
    referensiProyek: 'INV-SDI-2026-041',
    pihakTerkait: 'Klien',
    metodePembayaran: 'Transfer Bank',
    nominal: 10000000,
    status: 'Selesai',
    catatan: '',
    dibuatPada: '2026-11-20T00:00:00Z',
  },
];

test('filterPurchases only includes expense entries sorted newest first and filters by query/status', () => {
  const all = filterPurchases(SAMPLE_TRANSACTIONS, {
    search: '',
    category: 'all',
    status: 'all',
  });
  assert.equal(all.length, 2);
  assert.equal(all[0].id, 'tx-2');
  assert.equal(all[1].id, 'tx-1');

  const pendingOnly = filterPurchases(SAMPLE_TRANSACTIONS, {
    search: 'tukang',
    category: 'Upah Produksi',
    status: 'Tertunda',
  });
  assert.equal(pendingOnly.length, 1);
  assert.equal(pendingOnly[0].id, 'tx-2');
});

test('computePurchaseStats separates completed, material spend, and pending totals', () => {
  const expenses = SAMPLE_TRANSACTIONS.filter((t) => t.jenis === 'pengeluaran');
  const stats = computePurchaseStats(expenses);
  assert.equal(stats.totalCompleted, 3500000);
  assert.equal(stats.materialSpend, 3500000);
  assert.equal(stats.totalPending, 1500000);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.totalCount, 2);
});

test('validatePurchaseDraft rejects missing fields and accepts valid payload', () => {
  const empty = createEmptyPurchase('INV-SDI-2026-099');
  const invalid = validatePurchaseDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.pihakTerkait);
  assert.ok(invalid.fieldErrors.nominal);

  const validDraft: FinanceTransaction = {
    ...empty,
    judul: '  Finishing HPL  ',
    pihakTerkait: '  TB Maju  ',
    nominal: 450000.4,
    catatan: '  Faktur A  ',
  };
  assert.equal(validatePurchaseDraft(validDraft).valid, true);
  const normalized = normalizePurchasePayload(validDraft);
  assert.equal(normalized.jenis, 'pengeluaran');
  assert.equal(normalized.judul, 'Finishing HPL');
  assert.equal(normalized.pihakTerkait, 'TB Maju');
  assert.equal(normalized.nominal, 450000);
  assert.equal(normalized.catatan, 'Faktur A');
});

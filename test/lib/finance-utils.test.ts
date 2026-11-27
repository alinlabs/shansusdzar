import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PROJECT_INVOICES,
  buildFinanceCsv,
  computeCategoryBreakdown,
  computeFinanceSummary,
  computeInvoiceProgress,
  computeMonthlyCashflow,
  extractAvailableMonths,
  filterFinanceTransactions,
  formatFinanceMonthLabel,
  syncInvoicesOnTransactionDelete,
  syncInvoicesOnTransactionUpsert,
} from '../../src/lib/finance-utils';
import type { FinanceTransaction, ProjectInvoice } from '../../src/types/finance';

test('computeFinanceSummary calculates completed income, expense, net cashflow, and receivables', () => {
  const txs: FinanceTransaction[] = [
    {
      id: '1',
      tanggal: '2026-11-10',
      jenis: 'pemasukan',
      kategori: 'DP Proyek',
      judul: 'DP A',
      referensiProyek: 'INV-1',
      pihakTerkait: 'Klien A',
      metodePembayaran: 'Transfer Bank',
      nominal: 10000000,
      status: 'Selesai',
      catatan: '',
      dibuatPada: '2026-11-10T08:00:00Z',
    },
    {
      id: '2',
      tanggal: '2026-11-11',
      jenis: 'pengeluaran',
      kategori: 'Bahan & Material',
      judul: 'Beli HPL',
      referensiProyek: 'INV-1',
      pihakTerkait: 'Toko B',
      metodePembayaran: 'Transfer Bank',
      nominal: 3500000,
      status: 'Selesai',
      catatan: '',
      dibuatPada: '2026-11-11T08:00:00Z',
    },
    {
      id: '3',
      tanggal: '2026-11-12',
      jenis: 'pengeluaran',
      kategori: 'Logistik & Pengiriman',
      judul: 'Kirim Tertunda',
      referensiProyek: 'INV-1',
      pihakTerkait: 'Ekspedisi',
      metodePembayaran: 'Cash Workshop',
      nominal: 500000,
      status: 'Tertunda',
      catatan: '',
      dibuatPada: '2026-11-12T08:00:00Z',
    },
  ];

  const invoices: ProjectInvoice[] = [
    {
      id: 'inv-1',
      nomorInvoice: 'INV-1',
      namaProyek: 'Kitchen Set',
      namaKlien: 'Klien A',
      lokasi: 'Purwakarta',
      nilaiTotalKontrak: 20000000,
      tanggalJatuhTempo: '2026-12-01',
      status: 'Berjalan',
      riwayatPembayaran: [
        {
          id: 'p1',
          tanggal: '2026-11-10',
          label: 'DP',
          nominal: 10000000,
          metodePembayaran: 'Transfer Bank',
          catatan: '',
        },
      ],
      catatan: '',
    },
  ];

  const summary = computeFinanceSummary(txs, invoices);
  assert.equal(summary.totalIncome, 10000000);
  assert.equal(summary.totalExpense, 3500000);
  assert.equal(summary.netCashflow, 6500000);
  assert.equal(summary.pendingExpense, 500000);
  assert.equal(summary.pendingReceivables, 10000000);
  assert.equal(summary.completedTransactionsCount, 2);
  assert.equal(summary.activeInvoicesCount, 1);
});

test('computeMonthlyCashflow groups and sorts completed transactions chronologically', () => {
  const buckets = computeMonthlyCashflow(DEFAULT_FINANCE_TRANSACTIONS);
  assert.equal(buckets.length >= 3, true);
  assert.equal(buckets[0].monthKey, '2026-09');
  assert.equal(buckets[0].label, 'Sep 2026');
  assert.equal(buckets[buckets.length - 1].monthKey, '2026-11');
  assert.equal(formatFinanceMonthLabel('2026-10'), 'Okt 2026');
});

test('computeInvoiceProgress determines paid, remaining, percentage, and computed status', () => {
  const lunas = computeInvoiceProgress(DEFAULT_PROJECT_INVOICES[0]);
  assert.equal(lunas.computedStatus, 'Lunas');
  assert.equal(lunas.remainingAmount, 0);
  assert.equal(lunas.progressPercent, 100);

  const pendingDp = computeInvoiceProgress(DEFAULT_PROJECT_INVOICES[4]);
  assert.equal(pendingDp.computedStatus, 'Menunggu DP');
  assert.equal(pendingDp.paidAmount, 0);
  assert.equal(pendingDp.remainingAmount, 16800000);
  assert.equal(pendingDp.progressPercent, 0);
});

test('filterFinanceTransactions filters by type, month, status, and search query', () => {
  const novExpenses = filterFinanceTransactions(DEFAULT_FINANCE_TRANSACTIONS, {
    type: 'pengeluaran',
    month: '2026-11',
    status: 'Selesai',
  });
  assert.equal(novExpenses.every((tx) => tx.jenis === 'pengeluaran' && tx.status === 'Selesai'), true);
  assert.equal(novExpenses.length, 2);

  const searchResult = filterFinanceTransactions(DEFAULT_FINANCE_TRANSACTIONS, {
    search: 'hendra',
  });
  assert.equal(searchResult.length, 4);
  assert.equal(searchResult[0].tanggal >= searchResult[1].tanggal, true);
});

test('computeCategoryBreakdown and extractAvailableMonths work cleanly', () => {
  const expenseBreakdown = computeCategoryBreakdown(DEFAULT_FINANCE_TRANSACTIONS, 'pengeluaran');
  assert.equal(expenseBreakdown[0].category, 'Bahan & Material');
  assert.equal(expenseBreakdown[0].amount, 15600000);

  const months = extractAvailableMonths(DEFAULT_FINANCE_TRANSACTIONS);
  assert.deepEqual(months, ['2026-11', '2026-10', '2026-09']);
});

test('buildFinanceCsv escapes quotes and commas properly', () => {
  const csv = buildFinanceCsv([
    {
      id: 'tx-csv',
      tanggal: '2026-11-20',
      jenis: 'pemasukan',
      kategori: 'DP Proyek',
      judul: 'Kitchen Set "L-Shape", Purwakarta',
      referensiProyek: 'INV-099',
      pihakTerkait: 'Bapak Budi',
      metodePembayaran: 'Transfer Bank',
      nominal: 5000000,
      status: 'Selesai',
      catatan: 'Catatan, penting',
      dibuatPada: '2026-11-20T09:00:00Z',
    },
  ]);

  assert.match(csv, /^ID,Tanggal,/m);
  assert.match(csv, /"Kitchen Set ""L-Shape"", Purwakarta"/);
  assert.match(csv, /"Catatan, penting"/);
});

test('DEFAULT_PROJECT_INVOICES auto-generates invoices from proyek.json, skema-pembayaran.json, and transaksi.json', () => {
  assert.equal(DEFAULT_PROJECT_INVOICES.length, 5);
  assert.deepEqual(
    DEFAULT_PROJECT_INVOICES.map((inv) => ({
      id: inv.id,
      projectId: inv.projectId,
      status: inv.status,
      payments: inv.riwayatPembayaran.length,
    })),
    [
      { id: 'auto-inv-K-003', projectId: 'K-003', status: 'Lunas', payments: 4 },
      { id: 'auto-inv-K-001', projectId: 'K-001', status: 'Menunggu DP', payments: 0 },
      { id: 'auto-inv-K-005', projectId: 'K-005', status: 'Berjalan', payments: 2 },
      { id: 'auto-inv-K-002', projectId: 'K-002', status: 'Berjalan', payments: 1 },
      { id: 'auto-inv-K-004', projectId: 'K-004', status: 'Menunggu DP', payments: 0 },
    ]
  );

  // K-001 has alamat.detail preserved in generated invoice lokasi
  const k001Inv = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-001');
  assert.ok(k001Inv);
  assert.match(k001Inv.lokasi, /Perumahan Bukit Indah Blok C4/);
});

test('syncInvoicesOnTransactionUpsert and Delete keep project invoices synced with Buku Kas transactions', () => {
  const baseInvoices = structuredClone(DEFAULT_PROJECT_INVOICES);
  const dpTx: FinanceTransaction = {
    id: 'fin-tx-k001-dp',
    projectId: 'K-001',
    tanggal: '2026-11-28',
    jenis: 'pemasukan',
    kategori: 'DP Proyek',
    judul: 'Termin 1 : Down Payment 30% Kitchen Set',
    referensiProyek: 'INV/SDI-K/001/XI/2026',
    pihakTerkait: 'Ibu Ratna Dewi',
    metodePembayaran: 'Transfer Bank',
    nominal: 7950000,
    status: 'Selesai',
    catatan: 'Masuk rekening',
    dibuatPada: '2026-11-28T09:00:00Z',
  };

  const afterAdd = syncInvoicesOnTransactionUpsert(
    baseInvoices,
    DEFAULT_FINANCE_TRANSACTIONS,
    dpTx
  );
  const k001AfterAdd = afterAdd.find((inv) => inv.projectId === 'K-001')!;
  assert.equal(k001AfterAdd.riwayatPembayaran.length, 1);
  assert.equal(k001AfterAdd.riwayatPembayaran[0].nominal, 7950000);
  assert.equal(k001AfterAdd.status, 'Berjalan');

  const afterPending = syncInvoicesOnTransactionUpsert(
    afterAdd,
    [dpTx, ...DEFAULT_FINANCE_TRANSACTIONS],
    { ...dpTx, status: 'Tertunda' }
  );
  const k001Pending = afterPending.find((inv) => inv.projectId === 'K-001')!;
  assert.equal(k001Pending.riwayatPembayaran.length, 0);
  assert.equal(k001Pending.status, 'Menunggu DP');

  const afterDelete = syncInvoicesOnTransactionDelete(afterAdd, dpTx);
  const k001Deleted = afterDelete.find((inv) => inv.projectId === 'K-001')!;
  assert.equal(k001Deleted.riwayatPembayaran.length, 0);
  assert.equal(k001Deleted.status, 'Menunggu DP');
});


import financeLookupsData from '../data/referensi-keuangan.json';
import defaultFinanceTransactionsData from '../data/transaksi-keuangan.json';
import defaultProjectInvoicesData from '../data/invoice-proyek.json';
import type {
  CategoryBreakdownItem,
  FinanceFilterOptions,
  FinancePaymentMethod,
  FinanceSummaryMetrics,
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
  FinanceTransactionType,
  InvoiceProgressMetrics,
  MonthlyCashflowBucket,
  ProjectInvoice,
  ProjectInvoiceStatus,
} from '../types/finance';

export const INCOME_CATEGORIES: FinanceTransactionCategory[] =
  financeLookupsData.kategoriPemasukan as FinanceTransactionCategory[];

export const EXPENSE_CATEGORIES: FinanceTransactionCategory[] =
  financeLookupsData.kategoriPengeluaran as FinanceTransactionCategory[];

export const ALL_FINANCE_CATEGORIES: FinanceTransactionCategory[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

export const FINANCE_PAYMENT_METHODS: FinancePaymentMethod[] =
  financeLookupsData.metodePembayaran as FinancePaymentMethod[];

export const FINANCE_TRANSACTION_STATUSES: FinanceTransactionStatus[] =
  financeLookupsData.statusTransaksi as FinanceTransactionStatus[];

export const DEFAULT_FINANCE_TRANSACTIONS: FinanceTransaction[] =
  defaultFinanceTransactionsData as FinanceTransaction[];

export const DEFAULT_PROJECT_INVOICES: ProjectInvoice[] =
  defaultProjectInvoicesData as ProjectInvoice[];

const SHORT_MONTHS_ID: string[] = financeLookupsData.namaBulanSingkat;

export function formatFinanceMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const shortMonth = SHORT_MONTHS_ID[monthIdx];
  if (!shortMonth) return monthKey;
  return `${shortMonth} ${year}`;
}

export function formatShortDateId(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return dateStr;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = match[3];
  const shortMonth = SHORT_MONTHS_ID[monthIdx];
  if (!shortMonth) return dateStr;
  return `${day} ${shortMonth} ${year}`;
}

export function computeInvoiceProgress(invoice: ProjectInvoice): InvoiceProgressMetrics {
  const paidAmount = invoice.riwayatPembayaran.reduce((sum, item) => sum + Math.max(0, item.nominal), 0);
  const total = Math.max(0, invoice.nilaiTotalKontrak);
  const remainingAmount = Math.max(0, total - paidAmount);
  const progressPercent = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;

  let computedStatus: ProjectInvoiceStatus = 'Menunggu DP';
  if (paidAmount >= total && total > 0) {
    computedStatus = 'Lunas';
  } else if (paidAmount > 0) {
    computedStatus = 'Berjalan';
  }

  return {
    paidAmount,
    remainingAmount,
    progressPercent,
    computedStatus,
  };
}

export function computeFinanceSummary(
  transactions: readonly FinanceTransaction[],
  invoices: readonly ProjectInvoice[]
): FinanceSummaryMetrics {
  let totalIncome = 0;
  let totalExpense = 0;
  let pendingExpense = 0;
  let completedTransactionsCount = 0;

  for (const tx of transactions) {
    const amount = Math.max(0, tx.nominal);
    if (tx.status === 'Selesai') {
      completedTransactionsCount += 1;
      if (tx.jenis === 'pemasukan') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    } else if (tx.jenis === 'pengeluaran') {
      pendingExpense += amount;
    }
  }

  let pendingReceivables = 0;
  let activeInvoicesCount = 0;

  for (const inv of invoices) {
    const progress = computeInvoiceProgress(inv);
    pendingReceivables += progress.remainingAmount;
    if (progress.computedStatus !== 'Lunas') {
      activeInvoicesCount += 1;
    }
  }

  return {
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    pendingExpense,
    pendingReceivables,
    completedTransactionsCount,
    activeInvoicesCount,
  };
}

export function computeMonthlyCashflow(
  transactions: readonly FinanceTransaction[]
): MonthlyCashflowBucket[] {
  const bucketMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    if (tx.status !== 'Selesai') continue;
    const monthKey = tx.tanggal.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    const current = bucketMap.get(monthKey) ?? { income: 0, expense: 0 };
    const amount = Math.max(0, tx.nominal);
    if (tx.jenis === 'pemasukan') {
      current.income += amount;
    } else {
      current.expense += amount;
    }
    bucketMap.set(monthKey, current);
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, totals]) => ({
      monthKey,
      label: formatFinanceMonthLabel(monthKey),
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }));
}

export function computeCategoryBreakdown(
  transactions: readonly FinanceTransaction[],
  type: FinanceTransactionType
): CategoryBreakdownItem[] {
  const map = new Map<FinanceTransactionCategory, { amount: number; count: number }>();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.status !== 'Selesai' || tx.jenis !== type) continue;
    const amount = Math.max(0, tx.nominal);
    grandTotal += amount;
    const existing = map.get(tx.kategori) ?? { amount: 0, count: 0 };
    existing.amount += amount;
    existing.count += 1;
    map.set(tx.kategori, existing);
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: grandTotal > 0 ? Math.round((data.amount / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function extractAvailableMonths(transactions: readonly FinanceTransaction[]): string[] {
  const set = new Set<string>();
  for (const tx of transactions) {
    const key = tx.tanggal.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key)) {
      set.add(key);
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function filterFinanceTransactions(
  transactions: readonly FinanceTransaction[],
  options: FinanceFilterOptions = {}
): FinanceTransaction[] {
  const query = (options.search ?? '').trim().toLowerCase();
  const typeFilter = options.type ?? 'all';
  const categoryFilter = options.category ?? 'all';
  const monthFilter = options.month ?? 'all';
  const statusFilter = options.status ?? 'all';

  return transactions
    .filter((tx) => {
      if (typeFilter !== 'all' && tx.jenis !== typeFilter) return false;
      if (categoryFilter !== 'all' && tx.kategori !== categoryFilter) return false;
      if (monthFilter !== 'all' && !tx.tanggal.startsWith(monthFilter)) return false;
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      if (query) {
        const haystack = [
          tx.judul,
          tx.pihakTerkait,
          tx.referensiProyek,
          tx.kategori,
          tx.catatan,
          tx.metodePembayaran,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateCmp = b.tanggal.localeCompare(a.tanggal);
      if (dateCmp !== 0) return dateCmp;
      return b.dibuatPada.localeCompare(a.dibuatPada);
    });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildFinanceCsv(transactions: readonly FinanceTransaction[]): string {
  const headers = [
    'ID',
    'Tanggal',
    'Jenis',
    'Kategori',
    'Judul Transaksi',
    'Referensi Proyek',
    'Pihak Terkait',
    'Metode Pembayaran',
    'Nominal (IDR)',
    'Status',
    'Catatan',
  ];

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.tanggal,
      tx.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
      tx.kategori,
      tx.judul,
      tx.referensiProyek,
      tx.pihakTerkait,
      tx.metodePembayaran,
      tx.nominal,
      tx.status,
      tx.catatan,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

const idrExactFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiahSigned(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp 0';
  const rounded = Math.round(amount);
  if (rounded < 0) {
    return `-${idrExactFormatter.format(Math.abs(rounded))}`;
  }
  return idrExactFormatter.format(rounded);
}


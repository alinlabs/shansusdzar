import defaultFinanceTransactionsData from '../data/transaksi.json';
import defaultProjectsData from '../data/proyek.json';
import { formatDocumentDimensionDisplay, normalizeDimensionString } from './dimension-format';
import { formatWorkshopDocumentNumber, resolveProjectClientDigits } from './document-numbering';
import {
  DEFAULT_PAYMENT_SCHEME,
  clonePaymentSchemeStages,
  matchPaymentStageIndex,
} from './payment-scheme';
import {
  buildProjectProductSpecification,
  computeProjectProductSubtotal,
  computeProjectProductTambahanTotal,
  resolveProjectProductName,
} from './project-products';
import { formatFullWilayahAddress } from './wilayah-indonesia';
import type { PaymentSchemeConfig } from '../types/cms';
import type {
  CategoryBreakdownItem,
  FinanceFilterOptions,
  FinancePaymentMethod,
  FinanceSummaryMetrics,
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
  FinanceTransactionType,
  InvoiceLineItem,
  InvoiceProgressMetrics,
  MonthlyCashflowBucket,
  ProjectInvoice,
  ProjectInvoicePayment,
  ProjectInvoiceStatus,
  WorkshopProject,
} from '../types/finance';

export const INCOME_CATEGORIES: FinanceTransactionCategory[] = [
  'DP Proyek',
  'Termin Proyek',
  'Pelunasan Proyek',
  'Penjualan Katalog',
];

export const EXPENSE_CATEGORIES: FinanceTransactionCategory[] = [
  'Bahan & Material',
  'Hardware & Aksesoris',
  'Logistik & Pengiriman',
  'Operasional Workshop',
];

export const ALL_FINANCE_CATEGORIES: FinanceTransactionCategory[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

export const FINANCE_PAYMENT_METHODS: FinancePaymentMethod[] = [
  'Transfer Bank',
  'Termin Proyek',
  'Cash Workshop',
  'QRIS',
];

export const FINANCE_TRANSACTION_STATUSES: FinanceTransactionStatus[] = [
  'Selesai',
  'Tertunda',
];

export const DEFAULT_FINANCE_TRANSACTIONS: FinanceTransaction[] =
  defaultFinanceTransactionsData as FinanceTransaction[];

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

export interface AccountingRupiahParts {
  symbol: string;
  amount: string;
}

export function splitAccountingRupiahDisplay(raw: string): AccountingRupiahParts | null {
  if (!raw) return null;
  const normalized = raw.replace(/\u00a0/g, ' ').trim();
  const match = /^([+-])?\s*Rp\.?\s*([+-])?\s*([0-9][0-9.,]*)$/i.exec(normalized);
  if (!match) return null;
  const sign = match[1] || match[2] || '';
  return {
    symbol: `${sign}Rp`,
    amount: match[3],
  };
}

function buildInvoicePaymentFromTransaction(
  tx: FinanceTransaction,
  skemaPembayaran: ReturnType<typeof clonePaymentSchemeStages>
): ProjectInvoicePayment {
  let matchedIdx = matchPaymentStageIndex({ label: tx.judul }, skemaPembayaran);
  if (matchedIdx < 0 && skemaPembayaran.length > 0) {
    if (tx.kategori === 'DP Proyek') {
      matchedIdx = 0;
    } else if (tx.kategori === 'Pelunasan Proyek') {
      matchedIdx = skemaPembayaran.length - 1;
    }
  }
  const matchedStage = matchedIdx >= 0 ? skemaPembayaran[matchedIdx] : undefined;
  const label = matchedStage ? `${matchedStage.nama} ${matchedStage.persentase}%` : tx.judul;

  return {
    id: tx.id,
    tanggal: tx.tanggal,
    label,
    nominal: Math.max(0, Math.round(tx.nominal)),
    metodePembayaran: tx.metodePembayaran,
    catatan: tx.catatan,
  };
}

function transactionMatchesInvoice(tx: FinanceTransaction, inv: ProjectInvoice): boolean {
  if (inv.projectId && tx.projectId) {
    return tx.projectId === inv.projectId;
  }
  if (tx.projectId && !inv.projectId) {
    return false;
  }
  const refUpper = tx.referensiProyek.trim().toUpperCase();
  if (!refUpper) return false;
  if (inv.nomorInvoice && refUpper === inv.nomorInvoice.trim().toUpperCase()) return true;
  if (inv.projectId && refUpper === inv.projectId.trim().toUpperCase()) return true;
  return false;
}

function removeTransactionPaymentFromInvoice(
  inv: ProjectInvoice,
  tx: FinanceTransaction
): ProjectInvoice {
  const directIdx = inv.riwayatPembayaran.findIndex((p) => p.id === tx.id);
  let nextPayments: ProjectInvoicePayment[];
  if (directIdx >= 0) {
    nextPayments = inv.riwayatPembayaran.filter((p) => p.id !== tx.id);
  } else {
    let removedOne = false;
    nextPayments = inv.riwayatPembayaran.filter((p) => {
      if (
        !removedOne &&
        p.tanggal === tx.tanggal &&
        p.nominal === Math.max(0, Math.round(tx.nominal)) &&
        p.metodePembayaran === tx.metodePembayaran
      ) {
        removedOne = true;
        return false;
      }
      return true;
    });
  }
  if (nextPayments.length === inv.riwayatPembayaran.length) {
    return inv;
  }
  const draft: ProjectInvoice = {
    ...inv,
    riwayatPembayaran: nextPayments,
  };
  return {
    ...draft,
    status: computeInvoiceProgress(draft).computedStatus,
  };
}

export function syncInvoicesOnTransactionUpsert(
  invoices: readonly ProjectInvoice[],
  prevTransactions: readonly FinanceTransaction[],
  nextTx: FinanceTransaction,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): ProjectInvoice[] {
  const prevTx = prevTransactions.find((t) => t.id === nextTx.id) ?? null;

  return invoices.map((inv) => {
    let currentInv = inv;

    if (prevTx && prevTx.jenis === 'pemasukan' && transactionMatchesInvoice(prevTx, inv)) {
      const stillMatches =
        nextTx.jenis === 'pemasukan' &&
        nextTx.status === 'Selesai' &&
        transactionMatchesInvoice(nextTx, inv);
      if (!stillMatches) {
        return removeTransactionPaymentFromInvoice(inv, prevTx);
      }
    }

    if (nextTx.jenis !== 'pemasukan' || nextTx.status !== 'Selesai') {
      return currentInv;
    }
    if (!transactionMatchesInvoice(nextTx, currentInv)) {
      return currentInv;
    }

    const effectiveScheme = clonePaymentSchemeStages(
      currentInv.skemaPembayaran && currentInv.skemaPembayaran.length > 0
        ? { ...paymentScheme, tahapan: currentInv.skemaPembayaran }
        : paymentScheme
    );
    const paymentEntry = buildInvoicePaymentFromTransaction(nextTx, effectiveScheme);

    const existingIdx = currentInv.riwayatPembayaran.findIndex(
      (p) =>
        p.id === nextTx.id ||
        (prevTx !== null &&
          p.tanggal === prevTx.tanggal &&
          p.nominal === Math.max(0, Math.round(prevTx.nominal)) &&
          p.metodePembayaran === prevTx.metodePembayaran)
    );

    const nextPayments =
      existingIdx >= 0
        ? currentInv.riwayatPembayaran.map((p, idx) =>
            idx === existingIdx ? { ...paymentEntry, id: p.id } : p
          )
        : [...currentInv.riwayatPembayaran, paymentEntry].sort((a, b) =>
            a.tanggal.localeCompare(b.tanggal)
          );

    const draft: ProjectInvoice = {
      ...currentInv,
      riwayatPembayaran: nextPayments,
    };
    return {
      ...draft,
      status: computeInvoiceProgress(draft).computedStatus,
    };
  });
}

export function syncInvoicesOnTransactionDelete(
  invoices: readonly ProjectInvoice[],
  deletedTx: FinanceTransaction | undefined
): ProjectInvoice[] {
  if (!deletedTx || deletedTx.jenis !== 'pemasukan') {
    return [...invoices];
  }
  return invoices.map((inv) =>
    transactionMatchesInvoice(deletedTx, inv)
      ? removeTransactionPaymentFromInvoice(inv, deletedTx)
      : inv
  );
}

export function buildAutoInvoiceForProject(
  project: WorkshopProject,
  transactions: readonly FinanceTransaction[] = DEFAULT_FINANCE_TRANSACTIONS,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): ProjectInvoice {
  const d = project.tanggalDokumen;
  const issueDate =
    d?.tanggalSpk?.trim() ||
    d?.tanggalPenawaran?.trim() ||
    project.dibuatPada?.trim() ||
    project.tanggalMulai?.trim() ||
    new Date().toISOString().slice(0, 10);
  const digits = resolveProjectClientDigits(project);
  const nomorInvoice = formatWorkshopDocumentNumber('INV', {
    clientCodeOrSeq: digits,
    date: issueDate,
  });
  const nomorSpkReferensi = formatWorkshopDocumentNumber('SPK', {
    clientCodeOrSeq: digits,
    date: issueDate,
  });
  const nomorBastReferensi = formatWorkshopDocumentNumber('BST', {
    clientCodeOrSeq: digits,
    date: issueDate,
  });

  const skemaPembayaran = clonePaymentSchemeStages(paymentScheme);
  const tanggalJatuhTempo =
    d?.tanggalJatuhTempo?.trim() ||
    d?.tanggalTermin4?.trim() ||
    project.tanggalTargetSelesai?.trim() ||
    '';
  const fallbackDates = [
    d?.tanggalTermin1?.trim() || d?.tanggalPenawaran?.trim() || project.tanggalMulai?.trim() || '',
    d?.tanggalTermin2?.trim() || d?.tanggalSpk?.trim() || project.tanggalMulai?.trim() || '',
    d?.tanggalTermin3?.trim() || d?.tanggalKirim?.trim() || project.tanggalTargetSelesai?.trim() || '',
    d?.tanggalTermin4?.trim() || tanggalJatuhTempo,
  ];
  const tanggalTermin = skemaPembayaran.map(
    (_, idx) => fallbackDates[idx] || tanggalJatuhTempo || project.tanggalTargetSelesai?.trim() || ''
  );

  const products = project.daftarProduk ?? [];
  const productsTotal = products.reduce((sum, item) => sum + computeProjectProductSubtotal(item), 0);
  const nilaiTotalKontrak =
    products.length > 0 && productsTotal > 0
      ? productsTotal
      : Math.max(0, Math.round(project.nilaiKontrak || 0));

  const rincianItem: InvoiceLineItem[] = products.map((item, idx) => {
    const namaProduk = resolveProjectProductName(item) || project.namaProyek || 'Unit Custom Workshop';
    const dimensi = normalizeDimensionString(item.dimensi) || 'Sesuai Gambar Kerja Lapangan';
    const autoSpec = buildProjectProductSpecification(item);
    const baseSpec = item.spesifikasiMaterial?.trim() || autoSpec || 'Multipleks 18 MM, Finishing HPL';
    const paidAddons = (item.tambahan ?? [])
      .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
      .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
    const specText =
      paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
        ? `${baseSpec} [${paidAddons.join(', ')}]`
        : baseSpec;
    const qty = Math.max(1, Math.round(item.jumlah || 1));
    const subtotal = computeProjectProductSubtotal(item);
    const effectiveUnitPrice = Math.max(0, Math.round(subtotal / qty));
    const formattedDim = formatDocumentDimensionDisplay(dimensi);

    return {
      id: `auto-inv-li-${project.id}-${idx + 1}`,
      namaProduk,
      dimensi,
      customisasi: item.customisasi?.trim() || undefined,
      material: item.material?.trim() || undefined,
      finishing: item.finishing?.trim() || undefined,
      kodeWarna: item.kodeWarna?.trim() || undefined,
      tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
      spesifikasiMaterial: specText,
      satuan: item.satuan?.trim() || 'Unit',
      deskripsi: formattedDim
        ? `${namaProduk} (${formattedDim}) — ${specText}`
        : `${namaProduk} — ${specText}`,
      jumlah: qty,
      hargaSatuan: effectiveUnitPrice,
      subtotal,
    };
  });

  const nomorInvUpper = nomorInvoice.toUpperCase();
  const projectIdUpper = project.id.trim().toUpperCase();
  const riwayatPembayaran: ProjectInvoicePayment[] = transactions
    .filter(
      (tx) =>
        tx.jenis === 'pemasukan' &&
        tx.status === 'Selesai' &&
        (tx.projectId === project.id ||
          (!tx.projectId &&
            (tx.referensiProyek.trim().toUpperCase() === nomorInvUpper ||
              tx.referensiProyek.trim().toUpperCase() === projectIdUpper)))
    )
    .sort((a, b) => {
      const dateCmp = a.tanggal.localeCompare(b.tanggal);
      if (dateCmp !== 0) return dateCmp;
      const createdCmp = a.dibuatPada.localeCompare(b.dibuatPada);
      return createdCmp !== 0 ? createdCmp : a.id.localeCompare(b.id);
    })
    .map((tx) => buildInvoicePaymentFromTransaction(tx, skemaPembayaran));

  const draft: ProjectInvoice = {
    id: `auto-inv-${project.id}`,
    projectId: project.id,
    nomorInvoice,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    lokasi: formatFullWilayahAddress(project.alamat),
    nilaiTotalKontrak,
    tanggalJatuhTempo,
    status: 'Menunggu DP',
    riwayatPembayaran,
    catatan: '',
    ...(rincianItem.length > 0 ? { rincianItem } : {}),
    skemaPembayaran,
    tanggalTermin,
    nomorSpkReferensi,
    nomorBastReferensi,
  };

  const progress = computeInvoiceProgress(draft);
  return {
    ...draft,
    status: progress.computedStatus,
  };
}

export function extractProjectInvoicesFromProjects(
  projects: readonly WorkshopProject[],
  transactions: readonly FinanceTransaction[] = DEFAULT_FINANCE_TRANSACTIONS,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): ProjectInvoice[] {
  return projects.map((project) =>
    buildAutoInvoiceForProject(project, transactions, paymentScheme)
  );
}

export const DEFAULT_PROJECT_INVOICES: ProjectInvoice[] = extractProjectInvoicesFromProjects(
  defaultProjectsData as WorkshopProject[],
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PAYMENT_SCHEME
);

const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;
const LONG_MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

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

export function formatLongDateId(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return dateStr;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = match[3];
  const longMonth = LONG_MONTHS_ID[monthIdx];
  if (!longMonth) return dateStr;
  return `${day} ${longMonth} ${year}`;
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


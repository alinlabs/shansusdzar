import { EXPENSE_CATEGORIES } from '../../../../lib/finance-utils';
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
} from '../../../../types/finance';

export interface PurchaseStats {
  totalCompleted: number;
  totalPending: number;
  pendingCount: number;
  materialSpend: number;
  totalCount: number;
}

export interface PurchaseFilterOptions {
  search: string;
  category: 'all' | FinanceTransactionCategory;
  status: 'all' | FinanceTransactionStatus;
}

export interface PurchaseValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyPurchase(projectRef = ''): FinanceTransaction {
  return {
    id: `fin-buy-${Date.now()}`,
    tanggal: new Date().toISOString().slice(0, 10),
    jenis: 'pengeluaran',
    kategori: EXPENSE_CATEGORIES[0] ?? 'Bahan & Material',
    judul: '',
    referensiProyek: projectRef,
    pihakTerkait: '',
    metodePembayaran: 'Transfer Bank',
    nominal: 0,
    status: 'Selesai',
    catatan: '',
    dibuatPada: new Date().toISOString(),
  };
}

export function computePurchaseStats(allPurchases: readonly FinanceTransaction[]): PurchaseStats {
  const completed = allPurchases.filter((p) => p.status === 'Selesai');
  const pending = allPurchases.filter((p) => p.status === 'Tertunda');
  const materialSpend = completed
    .filter((p) => p.kategori === 'Bahan & Material' || p.kategori === 'Hardware & Aksesoris')
    .reduce((sum, p) => sum + p.nominal, 0);

  return {
    totalCompleted: completed.reduce((sum, p) => sum + p.nominal, 0),
    totalPending: pending.reduce((sum, p) => sum + p.nominal, 0),
    pendingCount: pending.length,
    materialSpend,
    totalCount: allPurchases.length,
  };
}

export function filterPurchases(
  transactions: readonly FinanceTransaction[],
  options: PurchaseFilterOptions
): FinanceTransaction[] {
  const q = options.search.trim().toLowerCase();
  return transactions
    .filter((tx) => tx.jenis === 'pengeluaran')
    .filter((tx) => {
      if (options.category !== 'all' && tx.kategori !== options.category) return false;
      if (options.status !== 'all' && tx.status !== options.status) return false;
      if (q) {
        const hay = `${tx.judul} ${tx.pihakTerkait} ${tx.referensiProyek} ${tx.catatan}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

export function validatePurchaseDraft(draft: FinanceTransaction): PurchaseValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};

  if (!draft.tanggal.trim()) {
    fieldErrors.tanggal = 'Tanggal pembelian wajib diisi.';
  }
  if (!draft.judul.trim()) {
    fieldErrors.judul = 'Item pembelian atau pekerjaan wajib diisi.';
  }
  if (!draft.pihakTerkait.trim()) {
    fieldErrors.pihakTerkait = 'Nama supplier, toko, atau penerima wajib diisi.';
  }
  if (!Number.isFinite(draft.nominal) || draft.nominal <= 0) {
    fieldErrors.nominal = 'Nominal pembelian harus lebih dari Rp 0.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Periksa kembali kolom wajib: tanggal, item pembelian, supplier, dan nominal.'
      : null,
    fieldErrors,
  };
}

export function normalizePurchasePayload(draft: FinanceTransaction): FinanceTransaction {
  return {
    ...draft,
    jenis: 'pengeluaran',
    judul: draft.judul.trim(),
    pihakTerkait: draft.pihakTerkait.trim(),
    referensiProyek: draft.referensiProyek.trim(),
    nominal: Math.max(0, Math.round(draft.nominal)),
    catatan: draft.catatan.trim(),
  };
}

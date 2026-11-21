import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../../lib/finance-utils';
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionType,
} from '../../../../types/finance';

export function createEmptyTransaction(): FinanceTransaction {
  return {
    id: `fin-tx-${Date.now()}`,
    tanggal: new Date().toISOString().slice(0, 10),
    jenis: 'pemasukan',
    kategori: 'DP Proyek',
    judul: '',
    referensiProyek: '',
    pihakTerkait: '',
    metodePembayaran: 'Transfer Bank',
    nominal: 0,
    status: 'Selesai',
    catatan: '',
    dibuatPada: new Date().toISOString(),
  };
}

export function resolveCategoryForType(
  nextType: FinanceTransactionType,
  currentCategory: FinanceTransactionCategory
): FinanceTransactionCategory {
  const validCategories = nextType === 'pemasukan' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return validCategories.includes(currentCategory) ? currentCategory : validCategories[0];
}

export function computeFilteredLedgerTotals(transactions: readonly FinanceTransaction[]) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.jenis === 'pemasukan') income += tx.nominal;
    else expense += tx.nominal;
  }
  return { income, expense };
}

export function validateTransactionDraft(draft: FinanceTransaction): {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
} {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.tanggal.trim()) {
    fieldErrors.tanggal = 'Tanggal transaksi wajib diisi.';
  }
  if (!draft.judul.trim()) {
    fieldErrors.judul = 'Judul atau uraian transaksi wajib diisi.';
  }
  if (!draft.pihakTerkait.trim()) {
    fieldErrors.pihakTerkait = 'Pihak terkait (klien/supplier) wajib diisi.';
  }
  if (!Number.isFinite(draft.nominal) || draft.nominal <= 0) {
    fieldErrors.nominal = 'Nominal transaksi harus lebih dari Rp 0.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Judul transaksi, pihak terkait, dan nominal lebih dari Rp 0 wajib diisi.'
      : null,
    fieldErrors,
  };
}

export function normalizeTransactionPayload(draft: FinanceTransaction): FinanceTransaction {
  return {
    ...draft,
    judul: draft.judul.trim(),
    referensiProyek: draft.referensiProyek.trim(),
    pihakTerkait: draft.pihakTerkait.trim(),
    catatan: draft.catatan.trim(),
    nominal: Math.max(0, Math.round(draft.nominal)),
  };
}

import { create } from 'zustand';
import defaultProjectsData from '../data/proyek.json';
import { BUSINESS_CONFIG } from '../lib/business-config';
import { migrateLegacyProjectId } from '../lib/document-numbering';
import {
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PROJECT_INVOICES,
  computeInvoiceProgress,
  syncInvoicesOnTransactionDelete,
  syncInvoicesOnTransactionUpsert,
} from '../lib/finance-utils';
import {
  applyInvoiceMasterStatusChange,
  applyInvoiceStageStatusChange,
  type TerminToggleTargetStatus,
} from '../lib/invoice-termin-sync';
import {
  readLocalCacheItem,
  registerStoreReloadHandler,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import { DEFAULT_PAYMENT_SCHEME } from '../lib/payment-scheme';
import { buildSeededAutoDocumentsForProjects } from '../lib/project-documents-auto';
import type { PaymentSchemeConfig } from '../types/cms';
import type {
  FinancePaymentMethod,
  FinanceTransaction,
  ProjectInvoice,
  ProjectInvoicePayment,
  WorkshopProject,
} from '../types/finance';

const SEEDED_AUTO_INVOICES: ProjectInvoice[] = buildSeededAutoDocumentsForProjects(
  defaultProjectsData as WorkshopProject[],
  DEFAULT_PROJECT_INVOICES,
  BUSINESS_CONFIG,
  DEFAULT_PAYMENT_SCHEME
).invoices;

export const FINANCE_STORAGE_KEY = 'shansusdzar-finance-v1';

interface PersistedFinancePayload {
  schemaVersion: number;
  updatedAt: string;
  transactions: FinanceTransaction[];
  invoices: ProjectInvoice[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CURRENT_FINANCE_SCHEMA_VERSION = 9;

function sanitizeLegacyTransactions(rawList: unknown[]): FinanceTransaction[] {
  const sanitized = rawList
    .filter((item): item is FinanceTransaction => isRecord(item) && typeof item.id === 'string')
    .filter((tx) => !(tx.id === 'fin-tx-005' && (tx.kategori as string) === 'Upah Produksi'))
    .map((tx) => {
      const migratedProjectId = migrateLegacyProjectId(tx.projectId);
      const nextKategori =
        (tx.kategori as string) === 'Upah Produksi' ? 'Operasional Workshop' : tx.kategori;
      if (migratedProjectId !== tx.projectId || nextKategori !== tx.kategori) {
        return { ...tx, projectId: migratedProjectId, kategori: nextKategori };
      }
      return tx;
    });

  const existingIds = new Set(sanitized.map((tx) => tx.id));
  const missingDefaults = DEFAULT_FINANCE_TRANSACTIONS.filter((tx) => !existingIds.has(tx.id));
  return missingDefaults.length > 0
    ? [...sanitized, ...structuredClone(missingDefaults)]
    : sanitized;
}

function sanitizeInvoiceLineAddons<T extends { tambahan?: unknown }>(item: T): T {
  const legacy = item as T & { kodeProduk?: unknown };
  const { kodeProduk: _kp, ...rest } = legacy;
  void _kp;
  if (!Array.isArray(item.tambahan)) {
    return rest as unknown as T;
  }
  return {
    ...(rest as unknown as T),
    tambahan: item.tambahan
      .filter((addon): addon is { jenis: string; biaya?: number } => isRecord(addon) && typeof addon.jenis === 'string')
      .map((addon) => ({
        jenis: addon.jenis.trim(),
        biaya: Math.max(0, Math.round(Number(addon.biaya) || 0)),
      })),
  };
}

function hydrateSeededInvoices(existing: ProjectInvoice[]): ProjectInvoice[] {
  const hydrated = existing.map((inv) => {
    const legacy = inv as ProjectInvoice & { kodeKlien?: string };
    const { kodeKlien: _kk, ...cleanInv } = legacy;
    void _kk;

    const seed = SEEDED_AUTO_INVOICES.find(
      (item) => item.id === cleanInv.id || (cleanInv.projectId && item.projectId === cleanInv.projectId)
    );

    const rincianSource =
      cleanInv.rincianItem && cleanInv.rincianItem.length > 0
        ? cleanInv.rincianItem
        : seed?.rincianItem;

    const mergedBase: ProjectInvoice = {
      ...cleanInv,
      ...(rincianSource ? { rincianItem: rincianSource.map(sanitizeInvoiceLineAddons) } : {}),
      tanggalTermin:
        cleanInv.tanggalTermin && cleanInv.tanggalTermin.length > 0
          ? cleanInv.tanggalTermin
          : seed?.tanggalTermin
            ? structuredClone(seed.tanggalTermin)
            : cleanInv.tanggalTermin,
      riwayatPembayaran:
        seed && seed.riwayatPembayaran.length > (cleanInv.riwayatPembayaran?.length ?? 0)
          ? structuredClone(seed.riwayatPembayaran)
          : cleanInv.riwayatPembayaran ?? [],
    };
    return {
      ...mergedBase,
      status: computeInvoiceProgress(mergedBase).computedStatus,
    };
  });
  const coveredProjectIds = new Set(
    hydrated.map((inv) => inv.projectId).filter((id): id is string => Boolean(id))
  );
  const missing = SEEDED_AUTO_INVOICES.filter(
    (seed) => seed.projectId && !coveredProjectIds.has(seed.projectId)
  );
  return missing.length > 0 ? [...hydrated, ...structuredClone(missing)] : hydrated;
}

function loadFinanceState(): PersistedFinancePayload {
  const fallback: PersistedFinancePayload = {
    schemaVersion: CURRENT_FINANCE_SCHEMA_VERSION,
    updatedAt: '2026-11-25T09:00:00.000Z',
    transactions: structuredClone(DEFAULT_FINANCE_TRANSACTIONS),
    invoices: structuredClone(SEEDED_AUTO_INVOICES),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(FINANCE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      (parsed.schemaVersion !== 7 &&
        parsed.schemaVersion !== 8 &&
        parsed.schemaVersion !== CURRENT_FINANCE_SCHEMA_VERSION)
    ) {
      return fallback;
    }

    const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : null;
    const transactions = rawTransactions
      ? parsed.schemaVersion !== CURRENT_FINANCE_SCHEMA_VERSION
        ? sanitizeLegacyTransactions(rawTransactions)
        : (rawTransactions as FinanceTransaction[])
      : fallback.transactions;

    const baseInvoices = Array.isArray(parsed.invoices)
      ? (parsed.invoices as ProjectInvoice[]).map((inv) => ({
          ...inv,
          projectId: migrateLegacyProjectId(inv.projectId),
        }))
      : fallback.invoices;
    const invoices =
      parsed.schemaVersion !== CURRENT_FINANCE_SCHEMA_VERSION
        ? hydrateSeededInvoices(baseInvoices)
        : baseInvoices;
    const updatedAt =
      typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt;

    const migrated: PersistedFinancePayload = {
      schemaVersion: CURRENT_FINANCE_SCHEMA_VERSION,
      updatedAt,
      transactions,
      invoices,
    };
    if (parsed.schemaVersion !== CURRENT_FINANCE_SCHEMA_VERSION) {
      saveFinanceState(migrated);
    }
    return migrated;
  } catch {
    return fallback;
  }
}

function saveFinanceState(payload: PersistedFinancePayload): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(FINANCE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization errors
  }
}

export interface RecordInvoicePaymentInput {
  invoiceId: string;
  date: string;
  label: string;
  amount: number;
  paymentMethod: FinancePaymentMethod;
  notes: string;
  alsoRecordCashTransaction: boolean;
}

interface FinanceStoreState extends PersistedFinancePayload {
  upsertTransaction: (transaction: FinanceTransaction) => void;
  deleteTransaction: (transactionId: string) => void;
  upsertProjectInvoice: (invoice: ProjectInvoice) => void;
  recordInvoicePayment: (input: RecordInvoicePaymentInput) => void;
  setInvoiceTerminStageStatus: (
    invoiceId: string,
    stageIndex: number,
    targetStatus: TerminToggleTargetStatus,
    paymentScheme?: PaymentSchemeConfig
  ) => void;
  setInvoiceMasterPaymentStatus: (
    invoiceId: string,
    targetStatus: TerminToggleTargetStatus,
    paymentScheme?: PaymentSchemeConfig
  ) => void;
  deleteProjectInvoice: (invoiceId: string) => void;
  reloadFromStorage: () => void;
  resetFinanceDefaults: () => void;
}

function persistFromState(state: FinanceStoreState): void {
  saveFinanceState({
    schemaVersion: CURRENT_FINANCE_SCHEMA_VERSION,
    updatedAt: state.updatedAt,
    transactions: state.transactions,
    invoices: state.invoices,
  });
}

const initialFinance = loadFinanceState();

export const useFinanceStore = create<FinanceStoreState>((set, get) => ({
  ...initialFinance,

  upsertTransaction: (transaction) => {
    const state = get();
    const exists = state.transactions.some((item) => item.id === transaction.id);
    const nextTransactions = exists
      ? state.transactions.map((item) => (item.id === transaction.id ? transaction : item))
      : [transaction, ...state.transactions];
    const nextInvoices = syncInvoicesOnTransactionUpsert(
      state.invoices,
      state.transactions,
      transaction,
      DEFAULT_PAYMENT_SCHEME
    );

    set({
      updatedAt: new Date().toISOString(),
      transactions: nextTransactions,
      invoices: nextInvoices,
    });
    persistFromState(get());
  },

  deleteTransaction: (transactionId) => {
    const state = get();
    const deletedTx = state.transactions.find((item) => item.id === transactionId);
    const nextTransactions = state.transactions.filter((item) => item.id !== transactionId);
    const nextInvoices = syncInvoicesOnTransactionDelete(state.invoices, deletedTx);

    set({
      updatedAt: new Date().toISOString(),
      transactions: nextTransactions,
      invoices: nextInvoices,
    });
    persistFromState(get());
  },

  upsertProjectInvoice: (invoice) => {
    const state = get();
    const progress = computeInvoiceProgress(invoice);
    const normalized: ProjectInvoice = {
      ...invoice,
      status: progress.computedStatus,
    };
    const exists = state.invoices.some((item) => item.id === normalized.id);
    const nextInvoices = exists
      ? state.invoices.map((item) => (item.id === normalized.id ? normalized : item))
      : [normalized, ...state.invoices];

    set({
      updatedAt: new Date().toISOString(),
      invoices: nextInvoices,
    });
    persistFromState(get());
  },

  recordInvoicePayment: (input) => {
    const state = get();
    const target = state.invoices.find((item) => item.id === input.invoiceId);
    if (!target || input.amount <= 0) return;

    const payment: ProjectInvoicePayment = {
      id: `pay-${Date.now()}`,
      tanggal: input.date,
      label: input.label.trim() || 'Pembayaran Termin',
      nominal: Math.round(input.amount),
      metodePembayaran: input.paymentMethod,
      catatan: input.notes.trim(),
    };

    const nextPayments = [...target.riwayatPembayaran, payment];
    const updatedInvoiceDraft: ProjectInvoice = {
      ...target,
      riwayatPembayaran: nextPayments,
    };
    const progress = computeInvoiceProgress(updatedInvoiceDraft);
    const updatedInvoice: ProjectInvoice = {
      ...updatedInvoiceDraft,
      status: progress.computedStatus,
    };

    const nextInvoices = state.invoices.map((inv) =>
      inv.id === updatedInvoice.id ? updatedInvoice : inv
    );

    let nextTransactions = state.transactions;
    if (input.alsoRecordCashTransaction) {
      const labelLower = payment.label.toLowerCase();
      const category =
        progress.computedStatus === 'Lunas' ||
        labelLower.includes('serah terima') ||
        labelLower.includes('termin 4') ||
        labelLower.includes('bast') ||
        labelLower.includes('pelunasan')
          ? 'Pelunasan Proyek'
          : labelLower.includes('down payment') ||
              labelLower.includes('termin 1') ||
              labelLower.includes('dp') ||
              labelLower.includes('uang muka')
            ? 'DP Proyek'
            : 'Termin Proyek';

      const cashTx: FinanceTransaction = {
        id: `fin-tx-${Date.now()}`,
        projectId: target.projectId,
        tanggal: payment.tanggal,
        jenis: 'pemasukan',
        kategori: category,
        judul: `${payment.label} — ${target.namaProyek}`,
        referensiProyek: target.nomorInvoice,
        pihakTerkait: target.namaKlien,
        metodePembayaran: payment.metodePembayaran,
        nominal: payment.nominal,
        status: 'Selesai',
        catatan: payment.catatan || `Pembayaran otomatis dari modul tagihan ${target.nomorInvoice}.`,
        dibuatPada: new Date().toISOString(),
      };
      nextTransactions = [cashTx, ...state.transactions];
    }

    set({
      updatedAt: new Date().toISOString(),
      invoices: nextInvoices,
      transactions: nextTransactions,
    });
    persistFromState(get());
  },

  setInvoiceTerminStageStatus: (invoiceId, stageIndex, targetStatus, paymentScheme) => {
    const state = get();
    const target = state.invoices.find((item) => item.id === invoiceId);
    if (!target) return;

    const result = applyInvoiceStageStatusChange({
      invoice: target,
      transactions: state.transactions,
      stageIndex,
      targetStatus,
      paymentScheme,
    });
    if (!result.changed) return;

    set({
      updatedAt: new Date().toISOString(),
      invoices: state.invoices.map((inv) =>
        inv.id === result.invoice.id ? result.invoice : inv
      ),
      transactions: result.transactions,
    });
    persistFromState(get());
  },

  setInvoiceMasterPaymentStatus: (invoiceId, targetStatus, paymentScheme) => {
    const state = get();
    const target = state.invoices.find((item) => item.id === invoiceId);
    if (!target) return;

    const result = applyInvoiceMasterStatusChange({
      invoice: target,
      transactions: state.transactions,
      targetStatus,
      paymentScheme,
    });
    if (!result.changed) return;

    set({
      updatedAt: new Date().toISOString(),
      invoices: state.invoices.map((inv) =>
        inv.id === result.invoice.id ? result.invoice : inv
      ),
      transactions: result.transactions,
    });
    persistFromState(get());
  },

  deleteProjectInvoice: (invoiceId) => {
    set({
      updatedAt: new Date().toISOString(),
      invoices: get().invoices.filter((inv) => inv.id !== invoiceId),
    });
    persistFromState(get());
  },

  reloadFromStorage: () => {
    set(loadFinanceState());
  },

  resetFinanceDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      transactions: structuredClone(DEFAULT_FINANCE_TRANSACTIONS),
      invoices: structuredClone(SEEDED_AUTO_INVOICES),
    });
    persistFromState(get());
  },
}));

registerStoreReloadHandler(() => {
  useFinanceStore.getState().reloadFromStorage();
});

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(FINANCE_STORAGE_KEY, () => {
    useFinanceStore.setState(loadFinanceState());
  });
}

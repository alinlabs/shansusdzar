import { create } from 'zustand';
import {
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PROJECT_INVOICES,
  computeInvoiceProgress,
} from '../lib/finance-utils';
import type {
  FinancePaymentMethod,
  FinanceTransaction,
  ProjectInvoice,
  ProjectInvoicePayment,
} from '../types/finance';

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

function loadFinanceState(): PersistedFinancePayload {
  const fallback: PersistedFinancePayload = {
    schemaVersion: 2,
    updatedAt: '2026-11-20T09:00:00.000Z',
    transactions: structuredClone(DEFAULT_FINANCE_TRANSACTIONS),
    invoices: structuredClone(DEFAULT_PROJECT_INVOICES),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(FINANCE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return fallback;

    const transactions = Array.isArray(parsed.transactions)
      ? (parsed.transactions as FinanceTransaction[])
      : fallback.transactions;
    const invoices = Array.isArray(parsed.invoices)
      ? (parsed.invoices as ProjectInvoice[])
      : fallback.invoices;
    const updatedAt =
      typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt;

    return {
      schemaVersion: 2,
      updatedAt,
      transactions,
      invoices,
    };
  } catch {
    return fallback;
  }
}

function saveFinanceState(payload: PersistedFinancePayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
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
  deleteProjectInvoice: (invoiceId: string) => void;
  resetFinanceDefaults: () => void;
}

function persistFromState(state: FinanceStoreState): void {
  saveFinanceState({
    schemaVersion: 2,
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

    set({
      updatedAt: new Date().toISOString(),
      transactions: nextTransactions,
    });
    persistFromState(get());
  },

  deleteTransaction: (transactionId) => {
    set({
      updatedAt: new Date().toISOString(),
      transactions: get().transactions.filter((item) => item.id !== transactionId),
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
      const category =
        progress.computedStatus === 'Lunas'
          ? 'Pelunasan Proyek'
          : payment.label.toLowerCase().includes('dp')
            ? 'DP Proyek'
            : 'Termin Proyek';

      const cashTx: FinanceTransaction = {
        id: `fin-tx-${Date.now()}`,
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

  deleteProjectInvoice: (invoiceId) => {
    set({
      updatedAt: new Date().toISOString(),
      invoices: get().invoices.filter((inv) => inv.id !== invoiceId),
    });
    persistFromState(get());
  },

  resetFinanceDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      transactions: structuredClone(DEFAULT_FINANCE_TRANSACTIONS),
      invoices: structuredClone(DEFAULT_PROJECT_INVOICES),
    });
    persistFromState(get());
  },
}));

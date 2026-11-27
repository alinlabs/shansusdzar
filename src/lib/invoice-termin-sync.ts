import { computeInvoiceProgress } from './finance-utils';
import { formatTerminDocumentNumber } from './document-numbering';
import {
  DEFAULT_PAYMENT_SCHEME,
  evaluateInvoicePaymentSchedule,
  matchPaymentStageIndex,
  resolveEffectivePaymentScheme,
} from './payment-scheme';
import type { PaymentSchemeConfig } from '../types/cms';
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  ProjectInvoice,
  ProjectInvoicePayment,
} from '../types/finance';

export type TerminToggleTargetStatus = 'Lunas' | 'Belum Dibayar';

export function getLocalTodayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveCategoryForStage(
  stageIndex: number,
  totalStages: number,
  stageLabel: string
): FinanceTransactionCategory {
  const lower = stageLabel.toLowerCase();
  if (
    stageIndex === totalStages - 1 ||
    lower.includes('serah terima') ||
    lower.includes('bast') ||
    lower.includes('pelunasan')
  ) {
    return 'Pelunasan Proyek';
  }
  if (
    stageIndex === 0 ||
    lower.includes('down payment') ||
    lower.includes('dp') ||
    lower.includes('uang muka')
  ) {
    return 'DP Proyek';
  }
  return 'Termin Proyek';
}

function transactionBelongsToInvoice(
  tx: FinanceTransaction,
  invoice: ProjectInvoice
): boolean {
  if (tx.jenis !== 'pemasukan') return false;
  if (invoice.projectId && tx.projectId === invoice.projectId) return true;
  if (
    invoice.nomorInvoice &&
    tx.referensiProyek.trim().toLowerCase() === invoice.nomorInvoice.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

function transactionMatchesStage(
  tx: FinanceTransaction,
  invoice: ProjectInvoice,
  stageIndex: number
): boolean {
  if (!transactionBelongsToInvoice(tx, invoice)) return false;
  const terminPattern = new RegExp(`\\btermin\\s*${stageIndex + 1}\\b`, 'i');
  return terminPattern.test(tx.judul);
}

export function applyInvoiceStageStatusChange(params: {
  invoice: ProjectInvoice;
  transactions: readonly FinanceTransaction[];
  stageIndex: number;
  targetStatus: TerminToggleTargetStatus;
  paymentScheme?: PaymentSchemeConfig;
  paymentDate?: string;
  nowIso?: string;
}): {
  invoice: ProjectInvoice;
  transactions: FinanceTransaction[];
  changed: boolean;
} {
  const {
    invoice,
    transactions,
    stageIndex,
    targetStatus,
    paymentScheme = DEFAULT_PAYMENT_SCHEME,
    paymentDate = getLocalTodayIsoDate(),
    nowIso = new Date().toISOString(),
  } = params;

  const effectiveScheme = resolveEffectivePaymentScheme(
    invoice.skemaPembayaran,
    paymentScheme
  );
  const currentSchedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveScheme
  );
  const stage = currentSchedule.stages[stageIndex];
  if (!stage) {
    return { invoice, transactions: [...transactions], changed: false };
  }

  if (targetStatus === 'Lunas') {
    if (stage.remainingAmount <= 0) {
      return { invoice, transactions: [...transactions], changed: false };
    }

    const amountToAdd = stage.remainingAmount;
    const stageLabel = `${stage.nama} ${stage.persentase}%`;
    const payment: ProjectInvoicePayment = {
      id: `pay-${invoice.id}-t${stageIndex + 1}-${Date.now()}`,
      tanggal: paymentDate,
      label: stageLabel,
      nominal: amountToAdd,
      metodePembayaran: 'Transfer Bank',
      catatan: stage.keterangan || `Pelunasan ${stage.nama}.`,
    };

    const updatedDraft: ProjectInvoice = {
      ...invoice,
      riwayatPembayaran: [...invoice.riwayatPembayaran, payment],
    };
    const progress = computeInvoiceProgress(updatedDraft);
    const updatedInvoice: ProjectInvoice = {
      ...updatedDraft,
      status: progress.computedStatus,
    };

    const cashTx: FinanceTransaction = {
      id: `fin-tx-${invoice.id}-t${stageIndex + 1}-${Date.now()}`,
      projectId: invoice.projectId,
      tanggal: paymentDate,
      jenis: 'pemasukan',
      kategori: resolveCategoryForStage(
        stageIndex,
        currentSchedule.stages.length,
        stageLabel
      ),
      judul: `${stageLabel} — ${invoice.namaProyek}`,
      referensiProyek: invoice.nomorInvoice,
      pihakTerkait: invoice.namaKlien,
      metodePembayaran: 'Transfer Bank',
      nominal: amountToAdd,
      status: 'Selesai',
      catatan: `Pembayaran ${formatTerminDocumentNumber(invoice.nomorInvoice, stageIndex)} ditandai Lunas.`,
      dibuatPada: nowIso,
    };

    return {
      invoice: updatedInvoice,
      transactions: [cashTx, ...transactions],
      changed: true,
    };
  }

  // targetStatus === 'Belum Dibayar'
  if (stage.paidAmount <= 0) {
    return { invoice, transactions: [...transactions], changed: false };
  }

  let nextPayments = invoice.riwayatPembayaran.filter(
    (p) => matchPaymentStageIndex(p, currentSchedule.stages) !== stageIndex
  );

  // Guard against unlabeled/overflow pool payments that still credit this stage
  const checkAfterDirectFilter = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    nextPayments,
    effectiveScheme
  );
  if ((checkAfterDirectFilter.stages[stageIndex]?.paidAmount ?? 0) > 0) {
    nextPayments = currentSchedule.stages
      .map((st, idx) => ({ st, idx }))
      .filter(({ st, idx }) => idx !== stageIndex && st.paidAmount > 0)
      .map(({ st, idx }) => {
        const existingForStage = invoice.riwayatPembayaran.find(
          (p) => matchPaymentStageIndex(p, currentSchedule.stages) === idx
        );
        return (
          existingForStage ?? {
            id: `pay-${invoice.id}-t${idx + 1}-${Date.now()}`,
            tanggal: paymentDate,
            label: `${st.nama} ${st.persentase}%`,
            nominal: st.paidAmount,
            metodePembayaran: 'Transfer Bank' as const,
            catatan: st.keterangan,
          }
        );
      });
  }

  const nextTransactions = transactions.filter(
    (tx) => !transactionMatchesStage(tx, invoice, stageIndex)
  );

  const updatedDraft: ProjectInvoice = {
    ...invoice,
    riwayatPembayaran: nextPayments,
  };
  const progress = computeInvoiceProgress(updatedDraft);
  const updatedInvoice: ProjectInvoice = {
    ...updatedDraft,
    status: progress.computedStatus,
  };

  return {
    invoice: updatedInvoice,
    transactions: nextTransactions,
    changed: true,
  };
}

export function applyInvoiceMasterStatusChange(params: {
  invoice: ProjectInvoice;
  transactions: readonly FinanceTransaction[];
  targetStatus: TerminToggleTargetStatus;
  paymentScheme?: PaymentSchemeConfig;
  paymentDate?: string;
  nowIso?: string;
}): {
  invoice: ProjectInvoice;
  transactions: FinanceTransaction[];
  changed: boolean;
} {
  const {
    invoice,
    transactions,
    targetStatus,
    paymentScheme = DEFAULT_PAYMENT_SCHEME,
    paymentDate = getLocalTodayIsoDate(),
    nowIso = new Date().toISOString(),
  } = params;

  const effectiveScheme = resolveEffectivePaymentScheme(
    invoice.skemaPembayaran,
    paymentScheme
  );
  const schedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveScheme
  );

  if (targetStatus === 'Belum Dibayar') {
    const hasAnyPayments = invoice.riwayatPembayaran.length > 0;
    const nextTransactions = transactions.filter((tx) => {
      if (!transactionBelongsToInvoice(tx, invoice)) return true;
      const isTerminLinked =
        /\btermin\s*\d+\b/i.test(tx.judul) ||
        tx.kategori === 'DP Proyek' ||
        tx.kategori === 'Termin Proyek' ||
        tx.kategori === 'Pelunasan Proyek';
      return !isTerminLinked;
    });

    if (!hasAnyPayments && nextTransactions.length === transactions.length) {
      return { invoice, transactions: [...transactions], changed: false };
    }

    return {
      invoice: {
        ...invoice,
        riwayatPembayaran: [],
        status: 'Menunggu DP',
      },
      transactions: nextTransactions,
      changed: true,
    };
  }

  // targetStatus === 'Lunas'
  let currentInvoice = invoice;
  let currentTransactions = [...transactions];
  let anyChanged = false;

  for (let idx = 0; idx < schedule.stages.length; idx += 1) {
    const result = applyInvoiceStageStatusChange({
      invoice: currentInvoice,
      transactions: currentTransactions,
      stageIndex: idx,
      targetStatus: 'Lunas',
      paymentScheme,
      paymentDate,
      nowIso,
    });
    if (result.changed) {
      currentInvoice = result.invoice;
      currentTransactions = result.transactions;
      anyChanged = true;
    }
  }

  return {
    invoice: currentInvoice,
    transactions: currentTransactions,
    changed: anyChanged,
  };
}

import { computeInvoiceProgress } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  type EvaluatedInvoicePaymentSchedule,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  HandoverCertificateDocument,
  WorkOrderDocument,
} from '../../../../types/documents';
import type {
  FinanceTransaction,
  InvoiceProgressMetrics,
  ProjectInvoice,
} from '../../../../types/finance';

export interface ProjectMarginRow {
  invoice: ProjectInvoice;
  progress: InvoiceProgressMetrics;
  purchaseTotal: number;
  purchaseCount: number;
  netMargin: number;
  linkedSpk?: WorkOrderDocument;
  linkedBast?: HandoverCertificateDocument;
  paymentSchedule: EvaluatedInvoicePaymentSchedule;
}

export function buildProjectMarginRows(
  invoices: readonly ProjectInvoice[],
  transactions: readonly FinanceTransaction[],
  workOrders: readonly WorkOrderDocument[],
  handoverCertificates: readonly HandoverCertificateDocument[] = [],
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): ProjectMarginRow[] {
  return invoices.map((inv) => {
    const progress = computeInvoiceProgress(inv);
    const invRefLower = inv.nomorInvoice.toLowerCase();
    const projLower = inv.namaProyek.toLowerCase();
    const clientLower = inv.namaKlien.toLowerCase();

    const relatedPurchases = transactions.filter((tx) => {
      if (tx.jenis !== 'pengeluaran') return false;
      const ref = tx.referensiProyek.toLowerCase();
      return (
        (ref && (ref === invRefLower || invRefLower.includes(ref))) ||
        tx.judul.toLowerCase().includes(projLower.slice(0, 12)) ||
        tx.pihakTerkait.toLowerCase().includes(clientLower)
      );
    });

    const purchaseTotal = relatedPurchases.reduce((sum, tx) => sum + tx.nominal, 0);
    const netMargin = progress.paidAmount - purchaseTotal;

    const spkRefLower = (inv.nomorSpkReferensi ?? '').trim().toLowerCase();
    const linkedSpk = workOrders.find(
      (spk) =>
        (spkRefLower && spk.nomorSpk.toLowerCase() === spkRefLower) ||
        spk.nomorInvoiceReferensi?.toLowerCase() === invRefLower ||
        spk.namaKlien.toLowerCase() === clientLower ||
        spk.namaProyek.toLowerCase().includes(projLower.slice(0, 12))
    );

    const bastRefLower = (inv.nomorBastReferensi ?? '').trim().toLowerCase();
    const linkedBast = handoverCertificates.find(
      (bast) =>
        (bastRefLower && bast.nomorBast.toLowerCase() === bastRefLower) ||
        bast.nomorInvoiceReferensi?.toLowerCase() === invRefLower ||
        (linkedSpk && bast.nomorSpkReferensi.toLowerCase() === linkedSpk.nomorSpk.toLowerCase()) ||
        (bast.namaPihakKedua.toLowerCase() === clientLower &&
          bast.namaProyek.toLowerCase().includes(projLower.slice(0, 12)))
    );

    const effectiveScheme = resolveEffectivePaymentScheme(inv.skemaPembayaran, paymentScheme);
    const paymentSchedule = evaluateInvoicePaymentSchedule(
      inv.nilaiTotalKontrak,
      inv.riwayatPembayaran,
      effectiveScheme
    );

    return {
      invoice: inv,
      progress,
      purchaseTotal,
      purchaseCount: relatedPurchases.length,
      netMargin,
      linkedSpk,
      linkedBast,
      paymentSchedule,
    };
  });
}

export function computeProjectDashboardMetrics(
  invoices: readonly ProjectInvoice[],
  projectRows: readonly ProjectMarginRow[],
  transactions: readonly FinanceTransaction[]
) {
  const totalContractPortfolio = invoices.reduce((sum, i) => sum + i.nilaiTotalKontrak, 0);
  const totalCollected = projectRows.reduce((sum, r) => sum + r.progress.paidAmount, 0);
  const totalPurchases = transactions
    .filter((tx) => tx.jenis === 'pengeluaran' && tx.status === 'Selesai')
    .reduce((sum, tx) => sum + tx.nominal, 0);
  const netProjectBalance = totalCollected - totalPurchases;
  return {
    totalContractPortfolio,
    totalCollected,
    totalPurchases,
    netProjectBalance,
  };
}

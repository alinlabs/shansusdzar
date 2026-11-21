import { computeInvoiceProgress } from '../../../../lib/finance-utils';
import type { WorkOrderDocument } from '../../../../types/documents';
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
}

export function buildProjectMarginRows(
  invoices: readonly ProjectInvoice[],
  transactions: readonly FinanceTransaction[],
  workOrders: readonly WorkOrderDocument[]
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

    const linkedSpk = workOrders.find(
      (spk) =>
        spk.namaKlien.toLowerCase() === clientLower ||
        spk.namaProyek.toLowerCase().includes(projLower.slice(0, 12))
    );

    return {
      invoice: inv,
      progress,
      purchaseTotal,
      purchaseCount: relatedPurchases.length,
      netMargin,
      linkedSpk,
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

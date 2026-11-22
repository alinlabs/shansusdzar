import type { PaymentSchemeStage } from './cms';

export type FinanceTransactionType = 'pemasukan' | 'pengeluaran';

export type FinancePaymentMethod =
  | 'Transfer Bank'
  | 'Cash Workshop'
  | 'QRIS'
  | 'Termin Proyek';

export type FinanceTransactionStatus = 'Selesai' | 'Tertunda';

export type FinanceTransactionCategory =
  | 'DP Proyek'
  | 'Termin Proyek'
  | 'Pelunasan Proyek'
  | 'Penjualan Katalog'
  | 'Bahan & Material'
  | 'Hardware & Aksesoris'
  | 'Upah Produksi'
  | 'Logistik & Pengiriman'
  | 'Operasional Workshop';

export interface FinanceTransaction {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jenis: FinanceTransactionType;
  kategori: FinanceTransactionCategory;
  judul: string;
  referensiProyek: string;
  pihakTerkait: string;
  metodePembayaran: FinancePaymentMethod;
  nominal: number;
  status: FinanceTransactionStatus;
  catatan: string;
  dibuatPada: string;
}

export type ProjectInvoiceStatus = 'Menunggu DP' | 'Berjalan' | 'Lunas';

export interface ProjectInvoicePayment {
  id: string;
  tanggal: string; // YYYY-MM-DD
  label: string; // mis. 'Termin 1 : Down Payment 30%', 'Termin 2 : Progress Produksi 40%', 'Termin 4 : Serah Terima 10%'
  nominal: number;
  metodePembayaran: FinancePaymentMethod;
  catatan: string;
}

export interface InvoiceLineItem {
  id: string;
  deskripsi: string;
  jumlah: number;
  hargaSatuan: number;
}

export interface ProjectInvoice {
  id: string;
  nomorInvoice: string;
  namaProyek: string;
  namaKlien: string;
  lokasi: string;
  nilaiTotalKontrak: number;
  tanggalJatuhTempo: string; // YYYY-MM-DD
  status: ProjectInvoiceStatus;
  riwayatPembayaran: ProjectInvoicePayment[];
  catatan: string;
  rincianItem?: InvoiceLineItem[];
  persenPajak?: number;
  nominalDiskon?: number;
  catatanRekening?: string;
  skemaPembayaran?: PaymentSchemeStage[];
  nomorSpkReferensi?: string;
  nomorBastReferensi?: string;
}

export interface FinanceFilterOptions {
  search?: string;
  type?: 'all' | FinanceTransactionType;
  category?: 'all' | FinanceTransactionCategory;
  month?: 'all' | string; // YYYY-MM
  status?: 'all' | FinanceTransactionStatus;
}

export interface FinanceSummaryMetrics {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  pendingExpense: number;
  pendingReceivables: number;
  completedTransactionsCount: number;
  activeInvoicesCount: number;
}

export interface MonthlyCashflowBucket {
  monthKey: string; // YYYY-MM
  label: string; // mis. 'Nov 2026'
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdownItem {
  category: FinanceTransactionCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface InvoiceProgressMetrics {
  paidAmount: number;
  remainingAmount: number;
  progressPercent: number;
  computedStatus: ProjectInvoiceStatus;
}

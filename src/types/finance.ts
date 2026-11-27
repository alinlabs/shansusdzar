import type { ClientWilayahAddress } from '../lib/wilayah-indonesia';
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
  | 'Logistik & Pengiriman'
  | 'Operasional Workshop';

export interface FinanceTransaction {
  id: string;
  projectId?: string;
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
  namaProduk?: string;
  dimensi?: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial?: string;
  satuan?: string;
  deskripsi: string;
  jumlah: number;
  hargaSatuan: number;
  subtotal?: number;
}

export interface ProjectInvoice {
  id: string;
  projectId?: string;
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
  tanggalTermin?: string[]; // YYYY-MM-DD per termin stage
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

export type WorkshopProjectStatus =
  | 'Perencanaan'
  | 'Produksi'
  | 'Instalasi'
  | 'Selesai';

export interface ProjectProductAddonItem {
  jenis: string;
  biaya: number;
}

export interface ProjectProductItem {
  id: string;
  namaProduk?: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial: string;
  spesifikasiManual?: boolean;
  satuan?: string;
  jumlah: number;
  hargaSatuan: number;
  hargaManual?: boolean;
}

export interface ProjectDocumentDates {
  tanggalPenawaran: string; // YYYY-MM-DD
  berlakuHingga?: string; // YYYY-MM-DD
  tanggalSpk: string; // YYYY-MM-DD
  tanggalKirim: string; // YYYY-MM-DD
  tanggalBast?: string; // YYYY-MM-DD
  tanggalJatuhTempo?: string; // YYYY-MM-DD
  tanggalTermin1?: string; // YYYY-MM-DD
  tanggalTermin2?: string; // YYYY-MM-DD
  tanggalTermin3?: string; // YYYY-MM-DD
  tanggalTermin4?: string; // YYYY-MM-DD
}

export interface ProjectTechnicalDetails {
  penanggungJawabPengirimanInstalasi?: string;
  masaGaransiBulan?: number;
  tanggalGaransiBerakhir?: string; // YYYY-MM-DD
}

export type ClientEntityType = 'pribadi' | 'perusahaan' | 'instansi';

export interface WorkshopProject {
  id: string;
  namaProyek: string;
  jenisKlien?: ClientEntityType;
  namaKlien: string;
  penanggungJawabKlien?: string;
  jabatanKlien?: string;
  teleponKlien: string;
  alamat?: ClientWilayahAddress;
  nilaiKontrak: number;
  tanggalMulai: string; // YYYY-MM-DD
  tanggalTargetSelesai: string; // YYYY-MM-DD
  status: WorkshopProjectStatus;
  dibuatPada: string;
  daftarProduk?: ProjectProductItem[];
  tanggalDokumen?: ProjectDocumentDates;
  detailTeknis?: ProjectTechnicalDetails;
}

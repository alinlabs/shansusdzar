import type { PaymentSchemeStage } from './cms';

export type WorkOrderPriority = 'Normal' | 'Prioritas' | 'Mendesak';

export type WorkOrderStatus =
  | 'Draf'
  | 'Menunggu Mulai'
  | 'Proses Workshop'
  | 'Instalasi Lapangan'
  | 'Selesai QC';

export interface WorkOrderLineItem {
  id: string;
  namaUnit: string;
  dimensi: string;
  spesifikasiMaterial: string;
  jumlah: number;
  daftarPeriksaQc: string;
}

export interface WorkOrderDocument {
  id: string;
  nomorSpk: string;
  tanggalTerbit: string; // YYYY-MM-DD
  tanggalTargetSelesai: string; // YYYY-MM-DD
  prioritas: WorkOrderPriority;
  status: WorkOrderStatus;
  namaProyek: string;
  namaKlien: string;
  alamatPemasangan: string;
  namaPengawas: string;
  koordinatorProduksi: string;
  pemeriksaQc: string;
  daftarItem: WorkOrderLineItem[];
  catatanTeknis: string;
  ketentuanKeselamatan: string;
  nomorInvoiceReferensi?: string;
  nomorSpksReferensi?: string;
  nilaiKontrakReferensi?: number;
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
}

export type CooperationAgreementType =
  | 'Kontrak Proyek Custom Interior'
  | 'Kerja Sama Mitra / Kontraktor'
  | 'Pengadaan Furniture Komersial';

export type CooperationAgreementStatus =
  | 'Draf'
  | 'Ditinjau Klien'
  | 'Ditandatangani'
  | 'Aktif Berjalan'
  | 'Selesai';

export interface CooperationClause {
  id: string;
  judulPasal: string;
  isiPasal: string;
}

export interface CooperationAgreementDocument {
  id: string;
  nomorKontrak: string;
  jenisPerjanjian: CooperationAgreementType;
  kotaPenandatanganan: string;
  tanggalPenandatanganan: string; // YYYY-MM-DD
  status: CooperationAgreementStatus;
  perusahaanPihakPertama: string;
  perwakilanPihakPertama: string;
  jabatanPihakPertama: string;
  alamatPihakPertama: string;
  namaPihakKedua: string;
  nomorIdentitasPihakKedua: string;
  jabatanPihakKedua: string;
  teleponPihakKedua: string;
  alamatPihakKedua: string;
  judulProyek: string;
  lokasiProyek: string;
  nilaiKontrak: number;
  persenDp: number;
  persenProgres: number;
  persenPelunasan: number;
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
  durasiKerjaHari: number;
  masaGaransiBulan: number;
  daftarPasal: CooperationClause[];
  saksiPihakPertama: string;
  saksiPihakKedua: string;
}

export type HandoverType =
  | 'Serah Terima Pekerjaan Selesai (100%)'
  | 'Serah Terima Parsial / Bertahap'
  | 'Serah Terima Masa Pemeliharaan (FHO)';

export type HandoverStatus =
  | 'Draf'
  | 'Menunggu Tanda Tangan'
  | 'Ditandatangani Klien'
  | 'Selesai & Garansi Aktif';

export type HandoverItemCondition =
  | 'Baik & Sesuai'
  | 'Perlu Penyetelan Minor'
  | 'Tertunda / Belum Terpasang';

export type HandoverFinalPaymentStatus =
  | 'Menunggu Pelunasan BAST'
  | 'Lunas Saat BAST'
  | 'Dalam Masa Tunggu Revisi';

export interface HandoverChecklistItem {
  id: string;
  namaUnit: string;
  dimensi: string;
  jumlah: number;
  kondisi: HandoverItemCondition;
  catatan: string;
}

export interface HandoverCertificateDocument {
  id: string;
  nomorBast: string;
  jenisSerahTerima: HandoverType;
  status: HandoverStatus;
  kotaSerahTerima: string;
  tanggalSerahTerima: string; // YYYY-MM-DD
  nomorSpkReferensi: string;
  nomorSpksReferensi: string;
  nomorInvoiceReferensi?: string;
  nilaiKontrakReferensi?: number;
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
  statusTerminAkhir?: HandoverFinalPaymentStatus;
  perusahaanPihakPertama: string;
  perwakilanPihakPertama: string;
  jabatanPihakPertama: string;
  alamatPihakPertama: string;
  namaPihakKedua: string;
  jabatanPihakKedua: string;
  teleponPihakKedua: string;
  alamatPihakKedua: string;
  namaProyek: string;
  lokasiPemasangan: string;
  persentaseSelesai: number;
  masaGaransiBulan: number;
  tanggalMulaiGaransi: string; // YYYY-MM-DD
  daftarItem: HandoverChecklistItem[];
  teksPernyataan: string;
  catatanTindakLanjut: string;
  saksiPihakPertama: string;
  saksiPihakKedua: string;
}

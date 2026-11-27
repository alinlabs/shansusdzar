import type { PaymentSchemeStage } from './cms';
import type { ClientEntityType, ProjectInvoicePayment, ProjectProductAddonItem } from './finance';

export type QuotationStatus =
  | 'Draf'
  | 'Dikirim ke Klien'
  | 'Negosiasi'
  | 'Disetujui Klien'
  | 'Kedaluwarsa'
  | 'Ditolak';

export interface QuotationLineItem {
  id: string;
  namaItem: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial: string;
  satuan: string;
  jumlah: number;
  hargaSatuan: number;
}

export interface QuotationDocument {
  id: string;
  projectId?: string;
  nomorPenawaran: string;
  tanggalPenawaran: string; // YYYY-MM-DD
  berlakuHingga: string; // YYYY-MM-DD
  status: QuotationStatus;
  namaProyek: string;
  namaKlien: string;
  teleponKlien: string;
  alamatLokasi: string;
  estimasiDurasiHari: number;
  daftarItem: QuotationLineItem[];
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
  syaratKetentuan: string;
  catatanTambahan: string;
  disusunOleh: string;
}

export type WorkOrderPriority = 'Normal' | 'Prioritas' | 'Mendesak';

export type WorkOrderStatus =
  | 'Draf'
  | 'Menunggu Mulai'
  | 'Proses Workshop'
  | 'Instalasi Lapangan'
  | 'Selesai Produksi';

export interface WorkOrderLineItem {
  id: string;
  namaUnit: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial: string;
  satuan?: string;
  jumlah: number;
  hargaSatuan?: number;
  subtotal?: number;
}

export interface WorkOrderDocument {
  id: string;
  projectId?: string;
  nomorSpk: string;
  tanggalTerbit: string; // YYYY-MM-DD
  tanggalMulai?: string; // YYYY-MM-DD
  tanggalTargetSelesai: string; // YYYY-MM-DD
  prioritas: WorkOrderPriority;
  status: WorkOrderStatus;
  namaProyek: string;
  perusahaanPelaksana?: string;
  namaKlien: string;
  teleponKlien?: string;
  alamatPemasangan: string;
  namaPengawas: string;
  referensiGambarKerja?: string;
  daftarItem: WorkOrderLineItem[];
  catatanTeknis: string;
  syaratKetentuan?: string;
  ketentuanKeselamatan: string;
  nomorPenawaranReferensi?: string;
  nomorInvoiceReferensi?: string;
  nomorSpksReferensi?: string;
  nilaiKontrakReferensi?: number;
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
}

export type DeliveryOrderStatus =
  | 'Draf'
  | 'Siap Kirim'
  | 'Dalam Pengiriman'
  | 'Tiba & Terpasang'
  | 'Diterima & Diarsipkan';

export type DeliveryOrderItemCondition =
  | 'Baik & Terkemas Rapi'
  | 'Perlu Penanganan Khusus'
  | 'Tiba Lengkap & Baik'
  | 'Ada Catatan Lapangan';

export type DeliveryOrderClientVerification =
  | 'Belum Diverifikasi'
  | 'Diterima Lengkap & Baik'
  | 'Ada Catatan Lapangan';

export interface DeliveryOrderLineItem {
  id: string;
  namaBarang: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial?: string;
  satuan?: string;
  jumlahUnit: number;
  hargaSatuan?: number;
  subtotal?: number;
  kondisiSaatKeluar: DeliveryOrderItemCondition;
  catatanPemasangan: string;
}

export interface DeliveryOrderDocument {
  id: string;
  projectId?: string;
  nomorSuratJalan: string;
  tanggalKirim: string; // YYYY-MM-DD
  status: DeliveryOrderStatus;
  nomorSpkReferensi?: string;
  nomorInvoiceReferensi?: string;
  namaProyek: string;
  namaKlien: string;
  teleponKlien: string;
  alamatTujuan: string;
  penanggungJawabPengirimanInstalasi: string;
  daftarItem: DeliveryOrderLineItem[];
  instruksiPemasangan: string;
  statusVerifikasiKlien: DeliveryOrderClientVerification;
  namaPenerimaLapangan: string;
  tanggalVerifikasiKlien?: string; // YYYY-MM-DD
  salinanDiarsipkanAdmin: boolean;
  catatanAuditAdmin: string;
}

export type CooperationAgreementType =
  | 'Kontrak Proyek Custom Interior'
  | 'Perjanjian Kerja Mitra / Kontraktor'
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

export interface CooperationAgreementProductItem {
  id: string;
  namaProduk: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial: string;
  satuan: string;
  jumlah: number;
  hargaSatuan: number;
  subtotal?: number;
}

export interface CooperationAgreementDocument {
  id: string;
  projectId?: string;
  nomorKontrak: string;
  jenisPerjanjian: CooperationAgreementType;
  kotaPenandatanganan: string;
  tanggalPenandatanganan: string; // YYYY-MM-DD
  status: CooperationAgreementStatus;
  perusahaanPihakPertama: string;
  perwakilanPihakPertama: string;
  jabatanPihakPertama: string;
  teleponPihakPertama?: string;
  alamatPihakPertama: string;
  jenisPihakKedua?: ClientEntityType;
  namaPerusahaanPihakKedua?: string;
  penanggungJawabPihakKedua?: string;
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
  tanggalMulaiKerja?: string; // YYYY-MM-DD
  tanggalSelesaiKerja?: string; // YYYY-MM-DD
  nomorPenawaranReferensi?: string;
  lampiranAcuan?: string;
  masaGaransiBulan: number;
  daftarProduk?: CooperationAgreementProductItem[];
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

export interface HandoverChecklistItem {
  id: string;
  namaUnit: string;
  dimensi: string;
  customisasi?: string;
  material?: string;
  finishing?: string;
  kodeWarna?: string;
  tambahan?: ProjectProductAddonItem[];
  spesifikasiMaterial?: string;
  satuan?: string;
  jumlah: number;
  hargaSatuan?: number;
  subtotal?: number;
  kondisi: HandoverItemCondition;
  catatan: string;
}

export interface HandoverCertificateDocument {
  id: string;
  projectId?: string;
  nomorBast: string;
  jenisSerahTerima: HandoverType;
  status: HandoverStatus;
  kotaSerahTerima: string;
  tanggalSerahTerima: string; // YYYY-MM-DD
  nomorPenawaranReferensi?: string;
  nomorSpkReferensi: string;
  nomorSuratJalanReferensi?: string;
  nomorSpksReferensi: string;
  nomorInvoiceReferensi?: string;
  nilaiKontrakReferensi?: number;
  tahapanPembayaran?: PaymentSchemeStage[];
  catatanPembayaran?: string;
  riwayatPembayaran?: ProjectInvoicePayment[];
  tanggalTermin?: string[];
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

import { normalizeDimensionString } from '../../../../lib/dimension-format';
import { formatWorkshopDocumentNumber } from '../../../../lib/document-numbering';
import type { BusinessConfig } from '../../../../types/business';
import type {
  CooperationAgreementDocument,
  DeliveryOrderClientVerification,
  DeliveryOrderDocument,
  DeliveryOrderItemCondition,
  DeliveryOrderLineItem,
  DeliveryOrderStatus,
  QuotationDocument,
  WorkOrderDocument,
} from '../../../../types/documents';

export const DELIVERY_ORDER_STATUSES: DeliveryOrderStatus[] = [
  'Draf',
  'Siap Kirim',
  'Dalam Pengiriman',
  'Tiba & Terpasang',
  'Diterima & Diarsipkan',
];

export const DELIVERY_ORDER_CONDITIONS: DeliveryOrderItemCondition[] = [
  'Baik & Terkemas Rapi',
  'Perlu Penanganan Khusus',
  'Tiba Lengkap & Baik',
  'Ada Catatan Lapangan',
];

export const DELIVERY_ORDER_CLIENT_VERIFICATIONS: DeliveryOrderClientVerification[] = [
  'Belum Diverifikasi',
  'Diterima Lengkap & Baik',
  'Ada Catatan Lapangan',
];

export interface DeliveryOrderValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export interface DeliveryOrderStats {
  totalRows: number;
  totalUnits: number;
}

export function createEmptyDeliveryOrderItem(): DeliveryOrderLineItem {
  return {
    id: `sj-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaBarang: '',
    dimensi: '',
    jumlahUnit: 1,
    kondisiSaatKeluar: 'Baik & Terkemas Rapi',
    catatanPemasangan: '',
  };
}

export const DELIVERY_ORDER_VERIFICATION_CLAUSES = [
  '1. Pemeriksaan Detail Barang Saat Pengiriman (Barang Datang): Seluruh rincian barang, dimensi, spesifikasi, jumlah unit, dan kondisi fisik wajib diperiksa bersama di lokasi untuk memastikan setiap item benar dan telah sampai lengkap sebelum ditandatangani oleh Owner dan Klien.',
  '2. Pencatatan Selisih / Cacat Kirim: Apabila ditemukan ketidaksesuaian spesifikasi, jumlah, atau kerusakan selama pengangkutan, wajib dicatat langsung pada kolom kondisi/catatan sebelum penandatanganan penerimaan barang.',
  '3. Tanggung Jawab Mobilisasi & Pemasangan: Risiko pengangkutan hingga proses instalasi selesai menjadi tanggung jawab pelaksana sampai seluruh unit terpasang sesuai pesanan dan gambar kerja.',
  '4. Verifikasi Ulang Setelah Instalasi Selesai (Arsip): Setelah seluruh unit selesai dipasang di lokasi, Klien menandatangani kolom verifikasi ulang (tanda tangan ke-3) pada Surat Jalan ini sebelum salinan resmi diarsipkan.',
] as const;

export function createEmptyDeliveryOrder(
  seq: number,
  _businessConfig: BusinessConfig,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): DeliveryOrderDocument {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `sj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorSuratJalan: formatWorkshopDocumentNumber('SJI', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
    tanggalKirim: today,
    status: 'Draf',
    nomorSpkReferensi: '',
    nomorInvoiceReferensi: '',
    namaProyek: '',
    namaKlien: '',
    teleponKlien: '',
    alamatTujuan: '',
    penanggungJawabPengirimanInstalasi: '',
    daftarItem: [createEmptyDeliveryOrderItem()],
    instruksiPemasangan: DELIVERY_ORDER_VERIFICATION_CLAUSES.join('\n'),
    statusVerifikasiKlien: 'Belum Diverifikasi',
    namaPenerimaLapangan: '',
    tanggalVerifikasiKlien: '',
    salinanDiarsipkanAdmin: false,
    catatanAuditAdmin: '',
  };
}

export function buildDeliveryOrderPrefillFromSpk(
  spk: WorkOrderDocument,
  current: DeliveryOrderDocument
): DeliveryOrderDocument {
  const items: DeliveryOrderLineItem[] =
    spk.daftarItem.length > 0
      ? spk.daftarItem.map((item, idx) => ({
          id: `sj-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaBarang: item.namaUnit,
          dimensi: item.dimensi,
          jumlahUnit: Math.max(1, item.jumlah || 1),
          kondisiSaatKeluar: 'Baik & Terkemas Rapi',
          catatanPemasangan: item.spesifikasiMaterial,
        }))
      : current.daftarItem;

  return {
    ...current,
    nomorSpkReferensi: spk.nomorSpk,
    nomorInvoiceReferensi: spk.nomorInvoiceReferensi || current.nomorInvoiceReferensi || '',
    namaProyek: current.namaProyek.trim() ? current.namaProyek : spk.namaProyek,
    namaKlien: current.namaKlien.trim() ? current.namaKlien : spk.namaKlien,
    teleponKlien: current.teleponKlien.trim() ? current.teleponKlien : spk.teleponKlien ?? '',
    alamatTujuan: current.alamatTujuan.trim() ? current.alamatTujuan : spk.alamatPemasangan,
    daftarItem: items,
  };
}

export function buildDeliveryOrderPrefillFromAgreement(
  spks: CooperationAgreementDocument,
  current: DeliveryOrderDocument
): DeliveryOrderDocument {
  return {
    ...current,
    nomorSpkReferensi: spks.nomorKontrak,
    namaProyek: current.namaProyek.trim() ? current.namaProyek : spks.judulProyek,
    namaKlien: current.namaKlien.trim() ? current.namaKlien : spks.namaPihakKedua,
    teleponKlien: current.teleponKlien.trim() ? current.teleponKlien : spks.teleponPihakKedua ?? '',
    alamatTujuan: current.alamatTujuan.trim() ? current.alamatTujuan : spks.lokasiProyek || spks.alamatPihakKedua,
  };
}

export function buildDeliveryOrderPrefillFromQuotation(
  quo: QuotationDocument,
  current: DeliveryOrderDocument
): DeliveryOrderDocument {
  const items: DeliveryOrderLineItem[] =
    quo.daftarItem.length > 0
      ? quo.daftarItem.map((item, idx) => ({
          id: `sj-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaBarang: item.namaItem,
          dimensi: item.dimensi,
          jumlahUnit: Math.max(1, item.jumlah || 1),
          kondisiSaatKeluar: 'Baik & Terkemas Rapi',
          catatanPemasangan: item.spesifikasiMaterial,
        }))
      : current.daftarItem;

  return {
    ...current,
    namaProyek: current.namaProyek.trim() ? current.namaProyek : quo.namaProyek,
    namaKlien: current.namaKlien.trim() ? current.namaKlien : quo.namaKlien,
    teleponKlien: current.teleponKlien.trim() ? current.teleponKlien : quo.teleponKlien,
    alamatTujuan: current.alamatTujuan.trim() ? current.alamatTujuan : quo.alamatLokasi,
    daftarItem: items,
  };
}

export function computeDeliveryOrderStats(
  items: readonly DeliveryOrderLineItem[]
): DeliveryOrderStats {
  let totalUnits = 0;
  for (const item of items) {
    totalUnits += Math.max(1, Math.round(item.jumlahUnit || 1));
  }
  return {
    totalRows: items.length,
    totalUnits,
  };
}

export function validateDeliveryOrderDraft(
  draft: DeliveryOrderDocument
): DeliveryOrderValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorSuratJalan.trim()) {
    fieldErrors.nomorSuratJalan = 'Nomor Surat Jalan wajib diisi.';
  }
  if (!draft.tanggalKirim.trim()) {
    fieldErrors.tanggalKirim = 'Tanggal kirim wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.alamatTujuan.trim()) {
    fieldErrors.alamatTujuan = 'Alamat tujuan pengiriman wajib diisi.';
  }
  const hasNamedItem = draft.daftarItem.some((item) => item.namaBarang.trim().length > 0);
  if (!hasNamedItem) {
    fieldErrors.daftarItem = 'Minimal 1 barang / unit kirim harus diisi.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor surat jalan, tanggal kirim, nama proyek, alamat tujuan, dan minimal satu barang kirim.'
      : null,
    fieldErrors,
  };
}

export function normalizeDeliveryOrderPayload(
  draft: DeliveryOrderDocument
): DeliveryOrderDocument {
  const cleanItems = draft.daftarItem
    .filter((item) => item.namaBarang.trim().length > 0)
    .map((item) => ({
      ...item,
      namaBarang: item.namaBarang.trim(),
      dimensi: normalizeDimensionString(item.dimensi),
      jumlahUnit: Math.max(1, Math.round(item.jumlahUnit || 1)),
      catatanPemasangan: item.catatanPemasangan.trim(),
    }));

  const archived =
    Boolean(draft.salinanDiarsipkanAdmin) || draft.status === 'Diterima & Diarsipkan';

  return {
    ...draft,
    nomorSuratJalan: draft.nomorSuratJalan.trim(),
    nomorSpkReferensi: draft.nomorSpkReferensi?.trim() || '',
    nomorInvoiceReferensi: draft.nomorInvoiceReferensi?.trim() || '',
    namaProyek: draft.namaProyek.trim(),
    namaKlien: draft.namaKlien.trim(),
    teleponKlien: draft.teleponKlien.trim(),
    alamatTujuan: draft.alamatTujuan.trim(),
    penanggungJawabPengirimanInstalasi: draft.penanggungJawabPengirimanInstalasi?.trim() || '',
    daftarItem: cleanItems.length > 0 ? cleanItems : [createEmptyDeliveryOrderItem()],
    instruksiPemasangan: draft.instruksiPemasangan.trim(),
    namaPenerimaLapangan: draft.namaPenerimaLapangan.trim(),
    tanggalVerifikasiKlien: draft.tanggalVerifikasiKlien?.trim() || '',
    salinanDiarsipkanAdmin: archived,
    catatanAuditAdmin: draft.catatanAuditAdmin.trim(),
  };
}

import { normalizeDimensionString } from '../../../../lib/dimension-format';
import { formatWorkshopDocumentNumber } from '../../../../lib/document-numbering';
import {
  DEFAULT_PAYMENT_SCHEME,
  clonePaymentSchemeStages,
} from '../../../../lib/payment-scheme';
import type { BusinessConfig } from '../../../../types/business';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  QuotationDocument,
  QuotationLineItem,
  QuotationStatus,
} from '../../../../types/documents';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draf',
  'Dikirim ke Klien',
  'Negosiasi',
  'Disetujui Klien',
  'Kedaluwarsa',
  'Ditolak',
];

export const QUOTATION_UNITS = ['unit', 'set', 'm1', 'm2', 'lot'] as const;

export interface QuotationValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyQuotationItem(): QuotationLineItem {
  return {
    id: `pen-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaItem: '',
    dimensi: '',
    spesifikasiMaterial: '',
    satuan: 'unit',
    jumlah: 1,
    hargaSatuan: 0,
  };
}

export function createEmptyQuotation(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): QuotationDocument {
  const today = new Date().toISOString().slice(0, 10);
  const validUntil = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    id: `pen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorPenawaran: formatWorkshopDocumentNumber('QUO', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
    tanggalPenawaran: today,
    berlakuHingga: validUntil,
    status: 'Draf',
    namaProyek: '',
    namaKlien: '',
    teleponKlien: '',
    alamatLokasi: '',
    estimasiDurasiHari: 14,
    daftarItem: [createEmptyQuotationItem()],
    tahapanPembayaran: clonePaymentSchemeStages(paymentScheme),
    catatanPembayaran: paymentScheme.catatan,
    syaratKetentuan:
      [
        `1. Ruang Lingkup Pekerjaan: Estimasi harga ini mencakup survei pengukuran ulang lokasi, gambar kerja (shop drawing), pengadaan material utama sesuai BOQ, fabrikasi workshop ${businessConfig.namaMerek}, pengiriman, dan instalasi.`,
        '2. Masa Berlaku & Pengikatan Harga: Penawaran berlaku selama 14 (empat belas) hari kalender sejak tanggal terbit. Perubahan ukuran, material, atau penambahan item di luar BOQ akan disesuaikan melalui revisi penawaran/addendum tertulis.',
        '3. Dasar Pelaksanaan & Pengikatan SPK: Proyek diproses ke Surat Perjanjian Kerja (SPK) setelah penawaran disetujui secara tertulis dan pembayaran Termin 1 (Uang Muka / DP) diterima.',
        '4. Pengecualian Pekerjaan: Pekerjaan sipil, bobok dinding, instalasi titik listrik/plumbing utama, dan perangkat elektronik di luar BOQ tidak termasuk dalam nilai penawaran ini.',
        '5. Perubahan Desain (Variation Order): Perubahan desain, tipe finishing, atau aksesori setelah gambar kerja dikunci wajib disepakati tertulis beserta penyesuaian biaya dan jadwal.',
        '6. Jaminan Mutu & Garansi: Seluruh unit dilindungi garansi konstruksi dan penyetelan engsel/rel setelah penandatanganan Berita Acara Serah Terima (BAST).',
      ].join('\n'),
    catatanTambahan:
      'Spesifikasi kode warna HPL/Duco, penarikan titik listrik/air, dan gambar kerja final dikunci bersama klien sebelum pemotongan material.',
    disusunOleh: businessConfig.drafPemilik.namaPemilik,
  };
}

export function computeQuotationItemSubtotal(item: Pick<QuotationLineItem, 'jumlah' | 'hargaSatuan'>): number {
  return Math.max(1, Math.round(item.jumlah || 1)) * Math.max(0, Math.round(item.hargaSatuan || 0));
}

export function computeQuotationTotal(items: readonly QuotationLineItem[]): number {
  return items.reduce((sum, item) => sum + computeQuotationItemSubtotal(item), 0);
}

export function validateQuotationDraft(draft: QuotationDocument): QuotationValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorPenawaran.trim()) {
    fieldErrors.nomorPenawaran = 'Nomor surat penawaran wajib diisi.';
  }
  if (!draft.tanggalPenawaran.trim()) {
    fieldErrors.tanggalPenawaran = 'Tanggal penawaran wajib diisi.';
  }
  if (!draft.berlakuHingga.trim()) {
    fieldErrors.berlakuHingga = 'Masa berlaku penawaran wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.namaKlien.trim()) {
    fieldErrors.namaKlien = 'Nama klien wajib diisi.';
  }
  const hasNamedItem = draft.daftarItem.some((item) => item.namaItem.trim().length > 0);
  if (!hasNamedItem) {
    fieldErrors.daftarItem = 'Minimal 1 item BOQ penawaran harus diisi.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor penawaran, tanggal, nama proyek, nama klien, dan minimal satu item pekerjaan BOQ.'
      : null,
    fieldErrors,
  };
}

export function normalizeQuotationPayload(draft: QuotationDocument): QuotationDocument {
  const cleanItems = draft.daftarItem
    .filter((item) => item.namaItem.trim().length > 0)
    .map((item) => ({
      ...item,
      namaItem: item.namaItem.trim(),
      dimensi: normalizeDimensionString(item.dimensi),
      spesifikasiMaterial: item.spesifikasiMaterial.trim(),
      satuan: item.satuan.trim() || 'unit',
      jumlah: Math.max(1, Math.round(item.jumlah || 1)),
      hargaSatuan: Math.max(0, Math.round(item.hargaSatuan || 0)),
    }));

  const cleanStages =
    Array.isArray(draft.tahapanPembayaran) && draft.tahapanPembayaran.length > 0
      ? draft.tahapanPembayaran.map((st, idx) => ({
          ...st,
          urutan: idx + 1,
          nama: st.nama.trim(),
          keterangan: st.keterangan.trim(),
        }))
      : undefined;

  return {
    ...draft,
    nomorPenawaran: draft.nomorPenawaran.trim(),
    namaProyek: draft.namaProyek.trim(),
    namaKlien: draft.namaKlien.trim(),
    teleponKlien: draft.teleponKlien.trim(),
    alamatLokasi: draft.alamatLokasi.trim(),
    estimasiDurasiHari: Math.max(1, Math.round(draft.estimasiDurasiHari || 14)),
    daftarItem: cleanItems.length > 0 ? cleanItems : [createEmptyQuotationItem()],
    tahapanPembayaran: cleanStages,
    catatanPembayaran: draft.catatanPembayaran?.trim() || '',
    syaratKetentuan: draft.syaratKetentuan.trim(),
    catatanTambahan: draft.catatanTambahan.trim(),
    disusunOleh: draft.disusunOleh.trim(),
  };
}

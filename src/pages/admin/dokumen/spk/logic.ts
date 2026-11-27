import { normalizeDimensionString } from '../../../../lib/dimension-format';
import { formatWorkshopDocumentNumber } from '../../../../lib/document-numbering';
import {
  DEFAULT_PAYMENT_SCHEME,
  clonePaymentSchemeStages,
} from '../../../../lib/payment-scheme';
import type { BusinessConfig } from '../../../../types/business';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  WorkOrderDocument,
  WorkOrderLineItem,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../../../../types/documents';

export const PRIORITIES: WorkOrderPriority[] = ['Normal', 'Prioritas', 'Mendesak'];
export const WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  'Draf',
  'Menunggu Mulai',
  'Proses Workshop',
  'Instalasi Lapangan',
  'Selesai Produksi',
];

export interface WorkOrderValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyWorkOrderItem(): WorkOrderLineItem {
  return {
    id: `spk-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaUnit: '',
    dimensi: '',
    spesifikasiMaterial: '',
    jumlah: 1,
  };
}

export function createEmptyWorkOrder(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): WorkOrderDocument {
  const today = new Date().toISOString().slice(0, 10);
  const finish = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    id: `spk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorSpk: formatWorkshopDocumentNumber('SPK', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
    tanggalTerbit: today,
    tanggalMulai: today,
    tanggalTargetSelesai: finish,
    prioritas: 'Normal',
    status: 'Draf',
    namaProyek: '',
    perusahaanPelaksana: businessConfig.namaMerek,
    namaKlien: '',
    teleponKlien: '',
    alamatPemasangan: '',
    namaPengawas: businessConfig.drafPemilik.namaPemilik,
    referensiGambarKerja: 'Gambar Kerja & Shop Drawing Terlampir',
    nomorPenawaranReferensi: '',
    nomorInvoiceReferensi: '',
    nomorSpksReferensi: '',
    nilaiKontrakReferensi: 0,
    tahapanPembayaran: clonePaymentSchemeStages(paymentScheme),
    catatanPembayaran: paymentScheme.catatan,
    daftarItem: [createEmptyWorkOrderItem()],
    catatanTeknis: '',
    syaratKetentuan:
      [
        `1. Persetujuan & Perintah Mulai Kerja: Dengan ditandatanganinya Surat Perintah Kerja (SPK) ini oleh Klien (Pemberi Kerja) dan Owner / Pelaksana (${businessConfig.namaMerek}), seluruh lingkup pekerjaan, desain/gambar kerja, serta spesifikasi material dinyatakan telah disetujui oleh Klien dan pekerjaan akan segera dikerjakan.`,
        `2. Lingkup & Acuan Teknis: ${businessConfig.namaMerek} wajib memproduksi dan memasang seluruh unit sesuai Surat Penawaran final serta gambar kerja (shop drawing) yang telah disetujui bersama.`,
        '3. Jangka Waktu & Pelaksanaan: Pekerjaan dilaksanakan sesuai tanggal mulai hingga target selesai yang ditetapkan, terhitung efektif setelah SPK ini ditandatangani oleh Klien dan pembayaran Termin 1 (Uang Muka / DP) diterima.',
        `4. Perubahan Pekerjaan (Addendum): Setiap perubahan desain, ukuran, material, warna finishing, atau penambahan/pengurangan item setelah SPK ditandatangani wajib disepakati secara tertulis oleh Klien dan ${businessConfig.namaMerek}.`,
        '5. Pengemasan & Persiapan Pengiriman: Setiap modul diperiksa kesesuaian spesifikasinya serta dikemas aman dengan pelindung sudut sebelum diberangkatkan ke lokasi Klien.',
        '6. Keamanan & Kebersihan Lokasi: Tim pelaksana wajib menggunakan APD standar, menjaga keamanan properti Klien, dan membersihkan lokasi setelah pemasangan.',
        '7. Serah Terima & Penagihan Termin: Pembayaran dilakukan bertahap sesuai skema termin proyek, dan penyelesaian pekerjaan dibuktikan melalui Surat Jalan serta BAST.',
      ].join('\n'),
    ketentuanKeselamatan:
      'Gunakan APD standar workshop saat pemotongan dan finishing, pasang pelindung sudut selama pengangkutan, serta jaga kebersihan dan keamanan area pemasangan di lokasi klien.',
  };
}

export function duplicateWorkOrderDraft(
  source: WorkOrderDocument,
  seq: number,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): WorkOrderDocument {
  const today = new Date().toISOString().slice(0, 10);
  let nextId = `spk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (nextId === source.id) {
    nextId = `${nextId}-copy`;
  }
  return {
    ...structuredClone(source),
    id: nextId,
    nomorSpk: formatWorkshopDocumentNumber('SPK', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
    status: 'Draf',
    tanggalTerbit: today,
  };
}

export function filterWorkOrders(
  workOrders: readonly WorkOrderDocument[],
  searchQuery: string,
  statusFilter: 'all' | WorkOrderStatus
): WorkOrderDocument[] {
  const q = searchQuery.trim().toLowerCase();
  return workOrders.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (q) {
      const hay = `${doc.nomorSpk} ${doc.namaProyek} ${doc.namaKlien} ${doc.nomorInvoiceReferensi ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateWorkOrderDraft(draft: WorkOrderDocument): WorkOrderValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorSpk.trim()) {
    fieldErrors.nomorSpk = 'Nomor SPK wajib diisi.';
  }
  if (!draft.tanggalTerbit.trim()) {
    fieldErrors.tanggalTerbit = 'Tanggal terbit wajib diisi.';
  }
  if (!draft.tanggalTargetSelesai.trim()) {
    fieldErrors.tanggalTargetSelesai = 'Target selesai wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.namaKlien.trim()) {
    fieldErrors.namaKlien = 'Nama klien wajib diisi.';
  }
  const hasNamedItem = draft.daftarItem.some((item) => item.namaUnit.trim().length > 0);
  if (!hasNamedItem) {
    fieldErrors.daftarItem = 'Minimal 1 item pekerjaan harus memiliki nama unit.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor SPK, tanggal, nama proyek, nama klien, dan minimal satu item pekerjaan.'
      : null,
    fieldErrors,
  };
}

export function normalizeWorkOrderPayload(draft: WorkOrderDocument): WorkOrderDocument {
  const cleanItems = draft.daftarItem
    .filter((item) => item.namaUnit.trim().length > 0)
    .map((item) => ({
      ...item,
      namaUnit: item.namaUnit.trim(),
      dimensi: normalizeDimensionString(item.dimensi),
      spesifikasiMaterial: item.spesifikasiMaterial.trim(),
      jumlah: Math.max(1, Math.round(item.jumlah || 1)),
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
    nomorSpk: draft.nomorSpk.trim(),
    tanggalMulai: draft.tanggalMulai?.trim() || draft.tanggalTerbit,
    namaProyek: draft.namaProyek.trim(),
    perusahaanPelaksana: draft.perusahaanPelaksana?.trim() || '',
    namaKlien: draft.namaKlien.trim(),
    teleponKlien: draft.teleponKlien?.trim() || '',
    alamatPemasangan: draft.alamatPemasangan.trim(),
    namaPengawas: draft.namaPengawas.trim(),
    referensiGambarKerja: draft.referensiGambarKerja?.trim() || '',
    nomorPenawaranReferensi: draft.nomorPenawaranReferensi?.trim() || '',
    nomorInvoiceReferensi: draft.nomorInvoiceReferensi?.trim() || '',
    nomorSpksReferensi: draft.nomorSpksReferensi?.trim() || '',
    nilaiKontrakReferensi: Math.max(0, Math.round(draft.nilaiKontrakReferensi || 0)),
    tahapanPembayaran: cleanStages,
    catatanPembayaran: draft.catatanPembayaran?.trim() || '',
    daftarItem: cleanItems.length > 0 ? cleanItems : [createEmptyWorkOrderItem()],
    catatanTeknis: draft.catatanTeknis.trim(),
    syaratKetentuan: draft.syaratKetentuan?.trim() || '',
    ketentuanKeselamatan: draft.ketentuanKeselamatan.trim(),
  };
}

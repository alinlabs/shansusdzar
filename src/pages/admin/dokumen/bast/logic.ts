import documentLookupsData from '../../../../data/referensi-dokumen.json';
import { computeInvoiceProgress } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  clonePaymentSchemeStages,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import type { BusinessConfig } from '../../../../types/business';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  CooperationAgreementDocument,
  HandoverCertificateDocument,
  HandoverChecklistItem,
  HandoverFinalPaymentStatus,
  HandoverItemCondition,
  HandoverStatus,
  HandoverType,
  WorkOrderDocument,
} from '../../../../types/documents';
import type { ProjectInvoice } from '../../../../types/finance';

export const HANDOVER_TYPES: HandoverType[] =
  documentLookupsData.jenisBast as HandoverType[];

export const HANDOVER_STATUSES: HandoverStatus[] =
  documentLookupsData.statusBast as HandoverStatus[];

export const HANDOVER_ITEM_CONDITIONS: HandoverItemCondition[] =
  documentLookupsData.kondisiItemBast as HandoverItemCondition[];

export const HANDOVER_FINAL_PAYMENT_STATUSES: readonly HandoverFinalPaymentStatus[] = [
  'Menunggu Pelunasan BAST',
  'Lunas Saat BAST',
  'Dalam Masa Tunggu Revisi',
];

export interface HandoverValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export interface HandoverChecklistStats {
  totalRows: number;
  totalUnits: number;
  passedRows: number;
  minorAdjustmentRows: number;
  pendingRows: number;
}

export interface BastFinalStageSummary {
  stageName: string;
  stagePercent: number;
  stageDescription: string;
  contractValue: number;
  finalStageAmount: number | null;
  statusTerminAkhir: HandoverFinalPaymentStatus;
}

export function createEmptyHandoverItem(): HandoverChecklistItem {
  return {
    id: `bast-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaUnit: '',
    dimensi: '',
    jumlah: 1,
    kondisi: 'Baik & Sesuai',
    catatan: '',
  };
}

export function createEmptyHandover(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): HandoverCertificateDocument {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `bast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorBast: `BAST-SDI-${year}-${String(seq).padStart(3, '0')}`,
    jenisSerahTerima: 'Serah Terima Pekerjaan Selesai (100%)',
    status: 'Draf',
    kotaSerahTerima:
      businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta',
    tanggalSerahTerima: today,
    nomorSpkReferensi: '',
    nomorSpksReferensi: '',
    nomorInvoiceReferensi: '',
    nilaiKontrakReferensi: 0,
    statusTerminAkhir: 'Menunggu Pelunasan BAST',
    tahapanPembayaran: clonePaymentSchemeStages(paymentScheme),
    catatanPembayaran: paymentScheme.catatan,
    perusahaanPihakPertama: businessConfig.namaMerek,
    perwakilanPihakPertama: businessConfig.drafPemilik.namaPemilik,
    jabatanPihakPertama: businessConfig.drafPemilik.jabatanPemilik,
    alamatPihakPertama: businessConfig.alamat.alamatLengkap,
    namaPihakKedua: '',
    jabatanPihakKedua: 'Pemilik / Pemberi Tugas',
    teleponPihakKedua: '',
    alamatPihakKedua: '',
    namaProyek: '',
    lokasiPemasangan: '',
    persentaseSelesai: 100,
    masaGaransiBulan: 6,
    tanggalMulaiGaransi: today,
    daftarItem: [createEmptyHandoverItem()],
    teksPernyataan:
      'Pada hari ini kedua belah pihak telah melaksanakan pemeriksaan fisik bersama di lokasi pemasangan. Seluruh unit pekerjaan telah terpasang lengkap, berfungsi dengan baik, dan diterima oleh PIHAK KEDUA sesuai spesifikasi kesepakatan.',
    catatanTindakLanjut: 'Nihil — seluruh unit lolos pengecekan akhir.',
    saksiPihakPertama: 'Fajar Maulana',
    saksiPihakKedua: '',
  };
}

export function duplicateHandoverDraft(
  source: HandoverCertificateDocument,
  seq: number
): HandoverCertificateDocument {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  let nextId = `bast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (nextId === source.id) {
    nextId = `${nextId}-copy`;
  }
  return {
    ...structuredClone(source),
    id: nextId,
    nomorBast: `BAST-SDI-${year}-${String(seq).padStart(3, '0')}`,
    status: 'Draf',
    tanggalSerahTerima: today,
    tanggalMulaiGaransi: today,
  };
}

export function buildHandoverPrefillFromSpk(
  spk: WorkOrderDocument,
  current: HandoverCertificateDocument,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): HandoverCertificateDocument {
  const mappedItems: HandoverChecklistItem[] =
    spk.daftarItem.length > 0
      ? spk.daftarItem.map((item, idx) => ({
          id: `bast-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaUnit: item.namaUnit,
          dimensi: item.dimensi,
          jumlah: item.jumlah || 1,
          kondisi: 'Baik & Sesuai',
          catatan: item.daftarPeriksaQc || '',
        }))
      : current.daftarItem;

  return {
    ...current,
    nomorSpkReferensi: spk.nomorSpk,
    nomorSpksReferensi: spk.nomorSpksReferensi || current.nomorSpksReferensi,
    nomorInvoiceReferensi: spk.nomorInvoiceReferensi || current.nomorInvoiceReferensi || '',
    nilaiKontrakReferensi:
      (spk.nilaiKontrakReferensi ?? 0) > 0
        ? spk.nilaiKontrakReferensi
        : current.nilaiKontrakReferensi ?? 0,
    tahapanPembayaran:
      spk.tahapanPembayaran && spk.tahapanPembayaran.length > 0
        ? structuredClone(spk.tahapanPembayaran)
        : current.tahapanPembayaran ?? clonePaymentSchemeStages(fallbackScheme),
    catatanPembayaran:
      spk.catatanPembayaran?.trim() || current.catatanPembayaran || fallbackScheme.catatan,
    namaProyek: spk.namaProyek,
    namaPihakKedua: spk.namaKlien,
    alamatPihakKedua: spk.alamatPemasangan || current.alamatPihakKedua,
    lokasiPemasangan: spk.alamatPemasangan || current.lokasiPemasangan,
    saksiPihakPertama: spk.koordinatorProduksi || current.saksiPihakPertama,
    daftarItem: mappedItems,
  };
}

export function buildHandoverPrefillFromAgreement(
  spks: CooperationAgreementDocument,
  current: HandoverCertificateDocument,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): HandoverCertificateDocument {
  return {
    ...current,
    nomorSpksReferensi: spks.nomorKontrak,
    nilaiKontrakReferensi:
      spks.nilaiKontrak > 0 ? spks.nilaiKontrak : current.nilaiKontrakReferensi ?? 0,
    tahapanPembayaran:
      spks.tahapanPembayaran && spks.tahapanPembayaran.length > 0
        ? structuredClone(spks.tahapanPembayaran)
        : current.tahapanPembayaran ?? clonePaymentSchemeStages(fallbackScheme),
    catatanPembayaran:
      spks.catatanPembayaran?.trim() || current.catatanPembayaran || fallbackScheme.catatan,
    namaProyek: spks.judulProyek,
    namaPihakKedua: spks.namaPihakKedua,
    jabatanPihakKedua: spks.jabatanPihakKedua || current.jabatanPihakKedua,
    teleponPihakKedua: spks.teleponPihakKedua || current.teleponPihakKedua,
    alamatPihakKedua: spks.alamatPihakKedua || current.alamatPihakKedua,
    lokasiPemasangan: spks.lokasiProyek || current.lokasiPemasangan,
    masaGaransiBulan: spks.masaGaransiBulan ?? current.masaGaransiBulan,
    saksiPihakPertama: spks.saksiPihakPertama || current.saksiPihakPertama,
    saksiPihakKedua: spks.saksiPihakKedua || current.saksiPihakKedua,
  };
}

export function buildHandoverPrefillFromInvoice(
  invoice: ProjectInvoice,
  current: HandoverCertificateDocument,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): HandoverCertificateDocument {
  const progress = computeInvoiceProgress(invoice);
  return {
    ...current,
    nomorInvoiceReferensi: invoice.nomorInvoice,
    nomorSpkReferensi: invoice.nomorSpkReferensi || current.nomorSpkReferensi,
    nilaiKontrakReferensi: invoice.nilaiTotalKontrak,
    statusTerminAkhir:
      progress.computedStatus === 'Lunas'
        ? 'Lunas Saat BAST'
        : current.statusTerminAkhir || 'Menunggu Pelunasan BAST',
    tahapanPembayaran:
      invoice.skemaPembayaran && invoice.skemaPembayaran.length > 0
        ? structuredClone(invoice.skemaPembayaran)
        : current.tahapanPembayaran ?? clonePaymentSchemeStages(fallbackScheme),
    catatanPembayaran: current.catatanPembayaran || fallbackScheme.catatan,
    namaProyek: current.namaProyek.trim() ? current.namaProyek : invoice.namaProyek,
    namaPihakKedua: current.namaPihakKedua.trim() ? current.namaPihakKedua : invoice.namaKlien,
    lokasiPemasangan: current.lokasiPemasangan.trim() ? current.lokasiPemasangan : invoice.lokasi,
  };
}

export function resolveBastFinalStageSummary(
  bast: Pick<
    HandoverCertificateDocument,
    'tahapanPembayaran' | 'nilaiKontrakReferensi' | 'statusTerminAkhir' | 'catatanPembayaran'
  >,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): BastFinalStageSummary {
  const effective = resolveEffectivePaymentScheme(
    bast.tahapanPembayaran,
    fallbackScheme,
    bast.catatanPembayaran
  );
  const contractValue = Math.max(0, Math.round(bast.nilaiKontrakReferensi || 0));
  const breakdown = calculatePaymentSchemeBreakdown(contractValue, effective);
  const lastStage = breakdown.length > 0 ? breakdown[breakdown.length - 1] : null;

  return {
    stageName: lastStage?.nama ?? 'Termin 4 : Serah Terima',
    stagePercent: lastStage?.persentase ?? 10,
    stageDescription:
      lastStage?.keterangan ??
      'Sebagai masa tunggu revisi atau perbaikan, dibayar saat penandatanganan BAST.',
    contractValue,
    finalStageAmount: lastStage?.amount ?? null,
    statusTerminAkhir: bast.statusTerminAkhir ?? 'Menunggu Pelunasan BAST',
  };
}

export function computeHandoverStats(
  items: readonly HandoverChecklistItem[]
): HandoverChecklistStats {
  let totalUnits = 0;
  let passedRows = 0;
  let minorAdjustmentRows = 0;
  let pendingRows = 0;

  for (const item of items) {
    totalUnits += Math.max(1, item.jumlah || 1);
    if (item.kondisi === 'Baik & Sesuai') passedRows += 1;
    else if (item.kondisi === 'Perlu Penyetelan Minor') minorAdjustmentRows += 1;
    else pendingRows += 1;
  }

  return {
    totalRows: items.length,
    totalUnits,
    passedRows,
    minorAdjustmentRows,
    pendingRows,
  };
}

export function filterHandovers(
  handovers: readonly HandoverCertificateDocument[],
  searchQuery: string,
  statusFilter: 'all' | HandoverStatus
): HandoverCertificateDocument[] {
  const q = searchQuery.trim().toLowerCase();
  return handovers.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (q) {
      const hay = `${doc.nomorBast} ${doc.namaProyek} ${doc.namaPihakKedua} ${doc.nomorSpkReferensi} ${doc.nomorSpksReferensi} ${doc.nomorInvoiceReferensi ?? ''} ${doc.jenisSerahTerima}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateHandoverDraft(
  draft: HandoverCertificateDocument
): HandoverValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorBast.trim()) {
    fieldErrors.nomorBast = 'Nomor BAST wajib diisi.';
  }
  if (!draft.tanggalSerahTerima.trim()) {
    fieldErrors.tanggalSerahTerima = 'Tanggal serah terima wajib diisi.';
  }
  if (!draft.namaPihakKedua.trim()) {
    fieldErrors.namaPihakKedua = 'Nama penerima / klien (Pihak Kedua) wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek / pekerjaan wajib diisi.';
  }
  if (
    !Number.isFinite(draft.persentaseSelesai) ||
    draft.persentaseSelesai < 0 ||
    draft.persentaseSelesai > 100
  ) {
    fieldErrors.persentaseSelesai = 'Persentase penyelesaian harus antara 0% sampai 100%.';
  }
  const hasNamedItem = draft.daftarItem.some((item) => item.namaUnit.trim().length > 0);
  if (!hasNamedItem) {
    fieldErrors.daftarItem = 'Minimal 1 unit serah terima harus memiliki nama pekerjaan.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor BAST, tanggal serah terima, nama klien penerima, nama proyek, dan minimal satu unit serah terima.'
      : null,
    fieldErrors,
  };
}

export function normalizeHandoverPayload(
  draft: HandoverCertificateDocument
): HandoverCertificateDocument {
  const cleanItems = draft.daftarItem
    .filter((item) => item.namaUnit.trim().length > 0)
    .map((item) => ({
      ...item,
      namaUnit: item.namaUnit.trim(),
      dimensi: item.dimensi.trim(),
      jumlah: Math.max(1, Math.round(item.jumlah || 1)),
      catatan: item.catatan.trim(),
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
    nomorBast: draft.nomorBast.trim(),
    kotaSerahTerima: draft.kotaSerahTerima.trim(),
    nomorSpkReferensi: draft.nomorSpkReferensi.trim(),
    nomorSpksReferensi: draft.nomorSpksReferensi.trim(),
    nomorInvoiceReferensi: draft.nomorInvoiceReferensi?.trim() || '',
    nilaiKontrakReferensi: Math.max(0, Math.round(draft.nilaiKontrakReferensi || 0)),
    statusTerminAkhir: draft.statusTerminAkhir ?? 'Menunggu Pelunasan BAST',
    tahapanPembayaran: cleanStages,
    catatanPembayaran: draft.catatanPembayaran?.trim() || '',
    perusahaanPihakPertama: draft.perusahaanPihakPertama.trim(),
    perwakilanPihakPertama: draft.perwakilanPihakPertama.trim(),
    jabatanPihakPertama: draft.jabatanPihakPertama.trim(),
    alamatPihakPertama: draft.alamatPihakPertama.trim(),
    namaPihakKedua: draft.namaPihakKedua.trim(),
    jabatanPihakKedua: draft.jabatanPihakKedua.trim(),
    teleponPihakKedua: draft.teleponPihakKedua.trim(),
    alamatPihakKedua: draft.alamatPihakKedua.trim(),
    namaProyek: draft.namaProyek.trim(),
    lokasiPemasangan: draft.lokasiPemasangan.trim(),
    persentaseSelesai: Math.max(0, Math.min(100, Math.round(draft.persentaseSelesai ?? 100))),
    masaGaransiBulan: Math.max(0, Math.round(draft.masaGaransiBulan ?? 0)),
    tanggalMulaiGaransi: draft.tanggalMulaiGaransi.trim() || draft.tanggalSerahTerima.trim(),
    daftarItem: cleanItems.length > 0 ? cleanItems : [createEmptyHandoverItem()],
    teksPernyataan: draft.teksPernyataan.trim(),
    catatanTindakLanjut: draft.catatanTindakLanjut.trim(),
    saksiPihakPertama: draft.saksiPihakPertama.trim(),
    saksiPihakKedua: draft.saksiPihakKedua.trim(),
  };
}

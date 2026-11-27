import { normalizeDimensionString } from '../../../../lib/dimension-format';
import {
  formatWorkshopDocumentNumber,
  isSpkDocumentNumber,
} from '../../../../lib/document-numbering';
import { computeInvoiceProgress } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  clonePaymentSchemeStages,
  matchPaymentStageIndex,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import type { BusinessConfig } from '../../../../types/business';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  CooperationAgreementDocument,
  DeliveryOrderDocument,
  HandoverCertificateDocument,
  HandoverChecklistItem,
  HandoverItemCondition,
  HandoverStatus,
  HandoverType,
  WorkOrderDocument,
} from '../../../../types/documents';
import type { ProjectInvoice, ProjectInvoicePayment, WorkshopProject } from '../../../../types/finance';

export const HANDOVER_TYPES: HandoverType[] = [
  'Serah Terima Pekerjaan Selesai (100%)',
  'Serah Terima Parsial / Bertahap',
  'Serah Terima Masa Pemeliharaan (FHO)',
];

export const HANDOVER_STATUSES: HandoverStatus[] = [
  'Draf',
  'Menunggu Tanda Tangan',
  'Ditandatangani Klien',
  'Selesai & Garansi Aktif',
];

export const HANDOVER_ITEM_CONDITIONS: HandoverItemCondition[] = [
  'Baik & Sesuai',
  'Perlu Penyetelan Minor',
  'Tertunda / Belum Terpasang',
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

export interface BastPaymentRecordItem {
  id: string;
  tanggal: string;
  label: string;
  metodePembayaran: string;
  nominal: number;
  catatan: string;
}

export interface BastPaymentRecordSummary {
  contractValue: number;
  totalPaid: number;
  isFullySettled: boolean;
  records: BastPaymentRecordItem[];
  warrantyMonths: number;
  warrantyStartDate: string;
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

export function resolveBastPaymentRecordSummary(
  bast: Pick<
    HandoverCertificateDocument,
    | 'nilaiKontrakReferensi'
    | 'tahapanPembayaran'
    | 'catatanPembayaran'
    | 'riwayatPembayaran'
    | 'tanggalTermin'
    | 'tanggalSerahTerima'
    | 'masaGaransiBulan'
    | 'tanggalMulaiGaransi'
  >,
  linkedInvoice?: Pick<
    ProjectInvoice,
    | 'nilaiTotalKontrak'
    | 'riwayatPembayaran'
    | 'skemaPembayaran'
    | 'tanggalTermin'
    | 'tanggalJatuhTempo'
  > | null,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: Pick<
    WorkshopProject,
    'tanggalDokumen' | 'tanggalTargetSelesai' | 'tanggalMulai'
  > | null
): BastPaymentRecordSummary {
  const contractValue = Math.max(
    0,
    Math.round(bast.nilaiKontrakReferensi || linkedInvoice?.nilaiTotalKontrak || 0)
  );
  const rawRecords: readonly ProjectInvoicePayment[] =
    linkedInvoice?.riwayatPembayaran && linkedInvoice.riwayatPembayaran.length > 0
      ? linkedInvoice.riwayatPembayaran
      : bast.riwayatPembayaran ?? [];

  const effective = resolveEffectivePaymentScheme(
    linkedInvoice?.skemaPembayaran ?? bast.tahapanPembayaran,
    fallbackScheme,
    bast.catatanPembayaran
  );
  const breakdown = calculatePaymentSchemeBreakdown(contractValue, effective);
  const invoiceTerminDates = linkedInvoice?.tanggalTermin ?? [];
  const bastTerminDates = bast.tanggalTermin ?? [];
  const projectDocDates = linkedProject?.tanggalDokumen;
  const projectTerminDates = projectDocDates
    ? [
        projectDocDates.tanggalTermin1,
        projectDocDates.tanggalTermin2,
        projectDocDates.tanggalTermin3,
        projectDocDates.tanggalTermin4,
      ]
    : [];

  let records: BastPaymentRecordItem[] = [];

  if (contractValue > 0 && breakdown.length > 0) {
    const matchedBuckets: ProjectInvoicePayment[][] = breakdown.map(() => []);
    const unmatchedRecords: ProjectInvoicePayment[] = [];

    rawRecords.forEach((rec) => {
      const idx = matchPaymentStageIndex(rec, breakdown);
      if (idx >= 0 && idx < breakdown.length) {
        matchedBuckets[idx].push(rec);
      } else {
        unmatchedRecords.push(rec);
      }
    });

    records = breakdown.map((stage, idx) => {
      const scheduledDate =
        invoiceTerminDates[idx]?.trim() ||
        bastTerminDates[idx]?.trim() ||
        projectTerminDates[idx]?.trim() ||
        (idx === breakdown.length - 1
          ? linkedInvoice?.tanggalJatuhTempo?.trim() ||
            linkedProject?.tanggalTargetSelesai?.trim()
          : undefined) ||
        bast.tanggalSerahTerima;

      const matched = matchedBuckets[idx];
      if (matched.length > 0) {
        const matchedTotal = matched.reduce(
          (sum, item) => sum + Math.max(0, Math.round(item.nominal || 0)),
          0
        );
        const primary = matched[0];
        return {
          id: primary.id || `bast-pay-${idx + 1}`,
          tanggal: primary.tanggal?.trim() || scheduledDate,
          label:
            matched.length === 1 && primary.label?.trim()
              ? primary.label
              : `${stage.nama} (${stage.persentase}%)`,
          metodePembayaran:
            matched
              .map((m) => m.metodePembayaran?.trim())
              .filter(Boolean)
              .join(', ') || 'Transfer Bank BNI',
          nominal: matchedTotal > 0 ? matchedTotal : stage.amount ?? 0,
          catatan: matched
            .map((m) => m.catatan?.trim())
            .filter(Boolean)
            .join('; '),
        };
      }

      return {
        id: `bast-settled-stage-${idx + 1}`,
        tanggal: scheduledDate,
        label: `${stage.nama} (${stage.persentase}%)`,
        metodePembayaran: 'Transfer Bank BNI (1905207398) / BSI (7370860534)',
        nominal: stage.amount ?? 0,
        catatan: 'Diterima & terverifikasi lunas sebelum serah terima BAST',
      };
    });

    if (unmatchedRecords.length > 0 && rawRecords.length === unmatchedRecords.length) {
      records = rawRecords.map((rec, idx) => ({
        id: rec.id || `bast-pay-${idx + 1}`,
        tanggal: rec.tanggal || bast.tanggalSerahTerima,
        label: rec.label,
        metodePembayaran: rec.metodePembayaran || 'Transfer Bank BNI',
        nominal: Math.max(0, Math.round(rec.nominal || 0)),
        catatan: rec.catatan || '',
      }));
    }
  } else if (rawRecords.length > 0) {
    records = rawRecords.map((rec, idx) => ({
      id: rec.id || `bast-pay-${idx + 1}`,
      tanggal: rec.tanggal || bast.tanggalSerahTerima,
      label: rec.label,
      metodePembayaran: rec.metodePembayaran || 'Transfer Bank BNI',
      nominal: Math.max(0, Math.round(rec.nominal || 0)),
      catatan: rec.catatan || '',
    }));
  }

  const totalPaid = records.reduce((sum, item) => sum + item.nominal, 0);
  const isFullySettled = contractValue <= 0 || totalPaid >= contractValue;

  return {
    contractValue,
    totalPaid: Math.max(totalPaid, contractValue),
    isFullySettled,
    records,
    warrantyMonths: Math.max(0, Math.round(bast.masaGaransiBulan ?? 6)),
    warrantyStartDate: bast.tanggalMulaiGaransi || bast.tanggalSerahTerima,
  };
}

export function createEmptyHandover(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): HandoverCertificateDocument {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `bast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorBast: formatWorkshopDocumentNumber('BST', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
    jenisSerahTerima: 'Serah Terima Pekerjaan Selesai (100%)',
    status: 'Draf',
    kotaSerahTerima:
      businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta',
    tanggalSerahTerima: today,
    nomorPenawaranReferensi: '',
    nomorSpkReferensi: '',
    nomorSuratJalanReferensi: '',
    nomorSpksReferensi: '',
    nomorInvoiceReferensi: '',
    nilaiKontrakReferensi: 0,
    tahapanPembayaran: clonePaymentSchemeStages(paymentScheme),
    catatanPembayaran: 'Pembayaran seluruh tahapan proyek (Termin 1 s.d. Termin 4) telah diterima penuh sebelum penerbitan BAST resmi.',
    riwayatPembayaran: [],
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
      [
        '1. Pernyataan Pemeriksaan & Penerimaan: Pada hari ini PIHAK PERTAMA dan PIHAK KEDUA telah melaksanakan pemeriksaan fisik dan verifikasi kesesuaian bersama di lokasi pemasangan. Seluruh unit pekerjaan pada daftar terlampir dinyatakan selesai 100%, berfungsi baik, dan diterima oleh PIHAK KEDUA.',
        '2. Peralihan Tanggung Jawab & Hak Guna: Terhitung sejak ditandatanganinya Berita Acara Serah Terima ini, risiko pemanfaatan serta pengelolaan harian unit pekerjaan resmi beralih dari PIHAK PERTAMA kepada PIHAK KEDUA.',
        '3. Masa Garansi Pemeliharaan: PIHAK PERTAMA memberikan masa garansi pemeliharaan konstruksi dan penyetelan hardware sesuai ketentuan kontrak, tidak termasuk kerusakan akibat kesalahan pemakaian, beban berlebih, kebocoran bangunan, atau keadaan kahar.',
        '4. Status Penyelesaian Proyek & Record Pembayaran: Berita Acara Serah Terima ini merupakan dokumen final penyelesaian proyek yang diterbitkan setelah seluruh kewajiban pembayaran kontrak (termasuk penerimaan Termin 4) tercatat lunas.',
      ].join('\n'),
    catatanTindakLanjut: 'Nihil — seluruh unit terpasang baik sesuai kontrak dan garansi pemeliharaan aktif.',
    saksiPihakPertama: '',
    saksiPihakKedua: '',
  };
}

export function duplicateHandoverDraft(
  source: HandoverCertificateDocument,
  seq: number,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): HandoverCertificateDocument {
  const today = new Date().toISOString().slice(0, 10);
  let nextId = `bast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (nextId === source.id) {
    nextId = `${nextId}-copy`;
  }
  return {
    ...structuredClone(source),
    id: nextId,
    nomorBast: formatWorkshopDocumentNumber('BST', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? today,
    }),
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
          catatan: item.spesifikasiMaterial || '',
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
    saksiPihakPertama: current.saksiPihakPertama,
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

export function buildHandoverPrefillFromDeliveryOrder(
  sj: DeliveryOrderDocument,
  current: HandoverCertificateDocument
): HandoverCertificateDocument {
  const mappedItems: HandoverChecklistItem[] =
    sj.daftarItem.length > 0
      ? sj.daftarItem.map((item, idx) => ({
          id: `bast-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaUnit: item.namaBarang,
          dimensi: item.dimensi,
          jumlah: item.jumlahUnit || 1,
          kondisi: 'Baik & Sesuai',
          catatan: item.catatanPemasangan || '',
        }))
      : current.daftarItem;

  return {
    ...current,
    nomorSuratJalanReferensi: sj.nomorSuratJalan,
    nomorSpkReferensi: sj.nomorSpkReferensi || current.nomorSpkReferensi,
    nomorSpksReferensi:
      current.nomorSpksReferensi ||
      (sj.nomorSpkReferensi && isSpkDocumentNumber(sj.nomorSpkReferensi)
        ? sj.nomorSpkReferensi
        : current.nomorSpksReferensi),
    nomorInvoiceReferensi: sj.nomorInvoiceReferensi || current.nomorInvoiceReferensi || '',
    namaProyek: current.namaProyek.trim() ? current.namaProyek : sj.namaProyek,
    namaPihakKedua: current.namaPihakKedua.trim() ? current.namaPihakKedua : sj.namaKlien,
    teleponPihakKedua: current.teleponPihakKedua.trim()
      ? current.teleponPihakKedua
      : sj.teleponKlien,
    alamatPihakKedua: current.alamatPihakKedua.trim() ? current.alamatPihakKedua : sj.alamatTujuan,
    lokasiPemasangan: current.lokasiPemasangan.trim() ? current.lokasiPemasangan : sj.alamatTujuan,
    daftarItem: mappedItems,
  };
}

export function buildHandoverPrefillFromInvoice(
  invoice: ProjectInvoice,
  current: HandoverCertificateDocument,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): HandoverCertificateDocument {
  computeInvoiceProgress(invoice);
  return {
    ...current,
    nomorInvoiceReferensi: invoice.nomorInvoice,
    nomorSpkReferensi: invoice.nomorSpkReferensi || current.nomorSpkReferensi,
    nomorSpksReferensi:
      current.nomorSpksReferensi ||
      (invoice.nomorSpkReferensi && isSpkDocumentNumber(invoice.nomorSpkReferensi)
        ? invoice.nomorSpkReferensi
        : current.nomorSpksReferensi),
    nilaiKontrakReferensi: invoice.nilaiTotalKontrak,
    tahapanPembayaran:
      invoice.skemaPembayaran && invoice.skemaPembayaran.length > 0
        ? structuredClone(invoice.skemaPembayaran)
        : current.tahapanPembayaran ?? clonePaymentSchemeStages(fallbackScheme),
    riwayatPembayaran:
      invoice.riwayatPembayaran && invoice.riwayatPembayaran.length > 0
        ? structuredClone(invoice.riwayatPembayaran)
        : current.riwayatPembayaran ?? [],
    tanggalTermin:
      invoice.tanggalTermin && invoice.tanggalTermin.length > 0
        ? [...invoice.tanggalTermin]
        : current.tanggalTermin,
    catatanPembayaran:
      'Seluruh riwayat pembayaran proyek mengacu pada catatan pembayaran terverifikasi pasca penerimaan Termin 4.',
    namaProyek: current.namaProyek.trim() ? current.namaProyek : invoice.namaProyek,
    namaPihakKedua: current.namaPihakKedua.trim() ? current.namaPihakKedua : invoice.namaKlien,
    lokasiPemasangan: current.lokasiPemasangan.trim() ? current.lokasiPemasangan : invoice.lokasi,
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
      dimensi: normalizeDimensionString(item.dimensi),
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
    nomorPenawaranReferensi: draft.nomorPenawaranReferensi?.trim() || '',
    nomorSpkReferensi: draft.nomorSpkReferensi.trim(),
    nomorSuratJalanReferensi: draft.nomorSuratJalanReferensi?.trim() || '',
    nomorSpksReferensi: draft.nomorSpksReferensi.trim(),
    nomorInvoiceReferensi: draft.nomorInvoiceReferensi?.trim() || '',
    nilaiKontrakReferensi: Math.max(0, Math.round(draft.nilaiKontrakReferensi || 0)),
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

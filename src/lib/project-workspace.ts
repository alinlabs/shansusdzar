import {
  getClientNameFieldLabel,
  normalizeClientEntityType,
} from './agreement-identity';
import {
  formatDocumentDimensionDisplay,
  normalizeDimensionString,
} from './dimension-format';
import {
  formatClientCode,
  formatTerminDocumentNumber,
} from './document-numbering';
import {
  computeInvoiceProgress,
  formatRupiahSigned,
  formatShortDateId,
} from './finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  type EvaluatedInvoicePaymentSchedule,
  buildAgreementPaymentClauseText,
  clonePaymentSchemeStages,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from './payment-scheme';
import { formatDocumentPhoneDisplay } from './phone-format';
import {
  formatCityFromWilayah,
  formatDesaKotaLabel,
  formatFullWilayahAddress,
  hasStructuredWilayahAddress,
  normalizeClientWilayahAddress,
} from './wilayah-indonesia';
import {
  buildAgreementProductItemsFromProject,
  buildDefaultProjectDocumentDates,
  computeEffectiveUnitPriceWithTambahan,
  computeProjectProductsTotal,
  computeQuotationValidUntilIso,
  createEmptyProjectProductItem,
  resolveProjectDocumentDates,
  resolveProjectProductItems,
  resolveProjectTechnicalDetails,
  sanitizeQuotationTechnicalNote,
} from './project-documents-auto';
import {
  buildProjectProductSpecification,
  computeProjectProductTambahanTotal,
  findCatalogProduct,
  resolveProjectProductName,
} from './project-products';
import { createEmptyHandover, buildHandoverPrefillFromAgreement, buildHandoverPrefillFromDeliveryOrder, buildHandoverPrefillFromInvoice, buildHandoverPrefillFromSpk } from '../pages/admin/dokumen/bast/logic';
import { createEmptyInvoice } from '../pages/admin/dokumen/invoice/logic';
import { computeQuotationTotal, createEmptyQuotation } from '../pages/admin/dokumen/penawaran/logic';
import { createEmptyWorkOrder } from '../pages/admin/dokumen/spk/logic';
import { createEmptyAgreement } from '../pages/admin/dokumen/spks/logic';
import {
  buildDeliveryOrderPrefillFromAgreement,
  buildDeliveryOrderPrefillFromQuotation,
  buildDeliveryOrderPrefillFromSpk,
  createEmptyDeliveryOrder,
} from '../pages/admin/dokumen/surat-jalan/logic';
import { createEmptyTransaction, resolveCategoryForType } from '../pages/admin/keuangan/buku-kas/logic';
import { createEmptyPurchase } from '../pages/admin/keuangan/pembelian/logic';
import type { BusinessConfig } from '../types/business';
import type { PaymentSchemeConfig } from '../types/cms';
import type {
  CooperationAgreementDocument,
  DeliveryOrderDocument,
  HandoverCertificateDocument,
  QuotationDocument,
  WorkOrderDocument,
} from '../types/documents';
import type {
  FinanceTransaction,
  FinanceTransactionType,
  ProjectInvoice,
  WorkshopProject,
  WorkshopProjectStatus,
} from '../types/finance';

export const PROJECT_STATUSES: readonly WorkshopProjectStatus[] = [
  'Perencanaan',
  'Produksi',
  'Instalasi',
  'Selesai',
];

export interface ProjectWorkspaceInputs {
  quotations?: readonly QuotationDocument[];
  agreements: readonly CooperationAgreementDocument[];
  workOrders: readonly WorkOrderDocument[];
  deliveryOrders?: readonly DeliveryOrderDocument[];
  handoverCertificates: readonly HandoverCertificateDocument[];
  invoices: readonly ProjectInvoice[];
  transactions: readonly FinanceTransaction[];
  paymentScheme?: PaymentSchemeConfig;
}

export interface ProjectWorkspaceSummary {
  contractValue: number;
  paidAmount: number;
  remainingBill: number;
  expenseTotal: number;
  pendingExpenseTotal: number;
  netMargin: number;
  progressPercent: number;
  documentCount: number;
  financeCount: number;
}

export interface ProjectJournalEntry {
  transaction: FinanceTransaction;
  creditAmount: number;
  debitAmount: number;
  cashDelta: number;
  runningBalance: number;
}

export interface ProjectJournalTotals {
  completedIncome: number;
  completedExpense: number;
  pendingIncome: number;
  pendingExpense: number;
  endingBalance: number;
}

export interface ProjectWorkspaceData {
  project: WorkshopProject;
  quotations: QuotationDocument[];
  agreements: CooperationAgreementDocument[];
  workOrders: WorkOrderDocument[];
  deliveryOrders: DeliveryOrderDocument[];
  handoverCertificates: HandoverCertificateDocument[];
  invoices: ProjectInvoice[];
  transactions: FinanceTransaction[];
  incomeTransactions: FinanceTransaction[];
  expenseTransactions: FinanceTransaction[];
  primaryInvoice: ProjectInvoice | null;
  paymentSchedule: EvaluatedInvoicePaymentSchedule;
  summary: ProjectWorkspaceSummary;
}

export interface ProjectsDirectoryOverview {
  totalProjects: number;
  activeProjects: number;
  totalContractValue: number;
  totalIncome: number;
  totalRemainingBill: number;
  totalExpenses: number;
  netMargin: number;
  workshopGeneralExpenses: number;
}

export type ProjectSortKey =
  | 'target_asc'
  | 'contract_desc'
  | 'remaining_desc'
  | 'margin_desc'
  | 'recent';

export interface ProjectScheduleStatus {
  state: 'done' | 'overdue' | 'due_soon' | 'on_track' | 'unset';
  label: string;
  daysDelta: number | null;
}

export function createEmptyWorkshopProject(
  seq: number,
  clientCode?: string
): WorkshopProject {
  const today = new Date().toISOString().slice(0, 10);
  const target = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const resolvedClientCode = clientCode?.trim().toUpperCase() || formatClientCode(seq);

  const defaultDocDates = buildDefaultProjectDocumentDates(today, target);

  return {
    id: resolvedClientCode,
    namaProyek: '',
    jenisKlien: 'pribadi',
    namaKlien: '',
    penanggungJawabKlien: '',
    jabatanKlien: '',
    teleponKlien: '',
    nilaiKontrak: 0,
    tanggalMulai: today,
    tanggalTargetSelesai: target,
    status: 'Perencanaan',
    dibuatPada: new Date().toISOString(),
    daftarProduk: [createEmptyProjectProductItem(1)],
    tanggalDokumen: defaultDocDates,
    detailTeknis: resolveProjectTechnicalDetails(
      {
        tanggalMulai: today,
        tanggalTargetSelesai: target,
        tanggalDokumen: defaultDocDates,
      },
      'Purwakarta'
    ),
  };
}

export function validateWorkshopProjectDraft(
  draft: WorkshopProject,
  options?: { requireStructuredAddress?: boolean }
): {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
} {
  const fieldErrors: Partial<Record<string, string>> = {};
  const entityType = normalizeClientEntityType(draft.jenisKlien, draft.namaKlien);
  const clientNameLabel = getClientNameFieldLabel(entityType);
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.namaKlien.trim()) {
    fieldErrors.namaKlien = `${clientNameLabel} wajib diisi.`;
  }
  if (entityType !== 'pribadi' && !(draft.penanggungJawabKlien ?? '').trim()) {
    fieldErrors.penanggungJawabKlien = 'Penanggung jawab wajib diisi.';
  }

  const addr = draft.alamat;
  if (addr?.provinsi?.id) {
    if (!addr.kabupaten?.id) {
      fieldErrors['alamat.kabupaten'] = 'Kabupaten / Kota wajib dipilih.';
    } else if (!addr.kecamatan?.id) {
      fieldErrors['alamat.kecamatan'] = 'Kecamatan wajib dipilih.';
    } else if (!addr.desa?.id) {
      fieldErrors['alamat.desa'] = 'Desa / Kelurahan wajib dipilih.';
    }
  } else if (options?.requireStructuredAddress && !addr?.detail?.trim()) {
    fieldErrors['alamat.provinsi'] = 'Provinsi wajib dipilih.';
  }

  const products = draft.daftarProduk ?? [];
  const hasAnyProductRow = products.length > 0;
  const filledProducts = products.filter(
    (item) => resolveProjectProductName(item).length > 0 || Boolean(findCatalogProduct(item.id))
  );
  if (hasAnyProductRow && filledProducts.length === 0) {
    fieldErrors.daftarProduk = 'Pilih minimal satu produk atau item pekerjaan proyek.';
  }

  if (!Number.isFinite(draft.nilaiKontrak) || draft.nilaiKontrak < 0) {
    fieldErrors.nilaiKontrak = 'Nilai kontrak tidak boleh negatif.';
  }
  if (!draft.tanggalMulai.trim()) {
    fieldErrors.tanggalMulai = 'Tanggal mulai wajib diisi.';
  }
  if (!draft.tanggalTargetSelesai.trim()) {
    fieldErrors.tanggalTargetSelesai = 'Target selesai wajib diisi.';
  }

  if (draft.tanggalDokumen) {
    if (!draft.tanggalDokumen.tanggalPenawaran?.trim()) {
      fieldErrors['tanggalDokumen.tanggalPenawaran'] = 'Tanggal penawaran wajib diisi.';
    }
    if (!draft.tanggalDokumen.tanggalSpk?.trim()) {
      fieldErrors['tanggalDokumen.tanggalSpk'] = 'Tanggal SPK wajib diisi.';
    }
    if (!draft.tanggalDokumen.tanggalKirim?.trim()) {
      fieldErrors['tanggalDokumen.tanggalKirim'] = 'Tanggal Surat Jalan wajib diisi.';
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nama proyek, nama klien, alamat wilayah, rincian produk, dan tanggal surat proyek.'
      : null,
    fieldErrors,
  };
}

export function normalizeWorkshopProjectPayload(draft: WorkshopProject): WorkshopProject {
  const cleanedProducts = (draft.daftarProduk ?? [])
    .filter((item) => resolveProjectProductName(item).length > 0 || Boolean(findCatalogProduct(item.id)))
    .map((item) => {
      const matchedCatalog = findCatalogProduct(item.id);
      const cleanTambahan = (item.tambahan ?? [])
        .filter((addon) => String(addon?.jenis ?? '').trim().length > 0)
        .map((addon) => ({
          jenis: String(addon.jenis).trim(),
          biaya: Math.max(0, Math.round(Number(addon.biaya) || 0)),
        }));

      const normalizedItem = {
        id: matchedCatalog?.id ?? '',
        ...(!matchedCatalog && item.namaProduk?.trim()
          ? { namaProduk: item.namaProduk.trim() }
          : {}),
        dimensi: normalizeDimensionString(item.dimensi),
        ...(item.customisasi?.trim() ? { customisasi: item.customisasi.trim() } : {}),
        ...(item.material?.trim() ? { material: item.material.trim() } : {}),
        ...(item.finishing?.trim() ? { finishing: item.finishing.trim() } : {}),
        kodeWarna: String(item.kodeWarna ?? '').trim(),
        ...(cleanTambahan.length > 0 ? { tambahan: cleanTambahan } : {}),
        spesifikasiMaterial: item.spesifikasiManual
          ? item.spesifikasiMaterial.trim()
          : buildProjectProductSpecification({
              customisasi: item.customisasi,
              material: item.material,
              finishing: item.finishing,
              kodeWarna: item.kodeWarna,
              tambahan: cleanTambahan,
            }) || item.spesifikasiMaterial.trim(),
        ...(item.spesifikasiManual ? { spesifikasiManual: true } : {}),
        jumlah: Math.max(1, Math.round(item.jumlah || 1)),
        hargaSatuan: Math.max(0, Math.round(item.hargaSatuan || 0)),
        ...(item.hargaManual ? { hargaManual: true } : {}),
      };
      return normalizedItem;
    });

  const productsTotal = computeProjectProductsTotal(cleanedProducts);
  const resolvedContractValue =
    cleanedProducts.length > 0
      ? productsTotal
      : Math.max(0, Math.round(draft.nilaiKontrak || 0));

  const normalizedDocDates = resolveProjectDocumentDates({
    tanggalMulai: draft.tanggalMulai,
    tanggalTargetSelesai: draft.tanggalTargetSelesai,
    tanggalDokumen: draft.tanggalDokumen,
  });

  const normalizedTech = resolveProjectTechnicalDetails(
    {
      ...draft,
      tanggalDokumen: normalizedDocDates,
    },
    'Purwakarta'
  );

  const raw = draft as unknown as Record<string, unknown>;
  const {
    kodeKlien: _legacyKodeKlien,
    lokasi: _legacyLokasi,
    invoice: _legacyInvoice,
    kodeProyek: _legacyCode,
    catatan: _legacyNotes,
    koordinat: _legacyCoord,
    alamat: _rawAlamat,
    ...restDraft
  } = raw;
  void _legacyKodeKlien;
  void _legacyLokasi;
  void _legacyInvoice;
  void _legacyCode;
  void _legacyNotes;
  void _legacyCoord;
  void _rawAlamat;

  const normalizedEntityType = normalizeClientEntityType(draft.jenisKlien, draft.namaKlien);
  const cleanedPic =
    normalizedEntityType === 'pribadi' ? undefined : draft.penanggungJawabKlien?.trim() || undefined;
  const cleanedJabatan =
    normalizedEntityType === 'pribadi' ? undefined : draft.jabatanKlien?.trim() || undefined;
  const cleanAlamat = normalizeClientWilayahAddress(draft.alamat);

  return {
    ...(restDraft as unknown as WorkshopProject),
    namaProyek: draft.namaProyek.trim(),
    jenisKlien: normalizedEntityType,
    namaKlien: draft.namaKlien.trim(),
    ...(cleanedPic ? { penanggungJawabKlien: cleanedPic } : { penanggungJawabKlien: undefined }),
    ...(cleanedJabatan ? { jabatanKlien: cleanedJabatan } : { jabatanKlien: undefined }),
    teleponKlien: draft.teleponKlien.trim(),
    ...(cleanAlamat ? { alamat: cleanAlamat } : {}),
    nilaiKontrak: resolvedContractValue,
    daftarProduk: cleanedProducts,
    tanggalDokumen: normalizedDocDates,
    detailTeknis: normalizedTech,
  };
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesClientAndTitle(
  project: WorkshopProject,
  clientName: string,
  title: string
): boolean {
  const projClient = normalizeToken(project.namaKlien);
  const itemClient = normalizeToken(clientName);
  if (!projClient || !itemClient || projClient !== itemClient) return false;

  const projTitle = normalizeToken(project.namaProyek);
  const itemTitle = normalizeToken(title);
  if (!projTitle || !itemTitle) return false;
  const prefix = projTitle.slice(0, Math.min(12, projTitle.length));
  return itemTitle.includes(prefix) || projTitle.includes(itemTitle.slice(0, Math.min(12, itemTitle.length)));
}

export function buildProjectWorkspaceData(
  project: WorkshopProject,
  inputs: ProjectWorkspaceInputs
): ProjectWorkspaceData {
  const scheme = inputs.paymentScheme ?? DEFAULT_PAYMENT_SCHEME;
  const clientCodeLower = normalizeToken(project.id);

  const projectInvoices = inputs.invoices.filter((inv) => {
    if (inv.projectId) return inv.projectId === project.id;
    return matchesClientAndTitle(project, inv.namaKlien, inv.namaProyek);
  });

  const invoiceNumbers = new Set(
    projectInvoices.map((inv) => normalizeToken(inv.nomorInvoice)).filter(Boolean)
  );

  const projectQuotations = (inputs.quotations ?? []).filter((quo) => {
    if (quo.projectId) return quo.projectId === project.id;
    return matchesClientAndTitle(project, quo.namaKlien, quo.namaProyek);
  });

  const quotationNumbers = new Set(
    projectQuotations.map((quo) => normalizeToken(quo.nomorPenawaran)).filter(Boolean)
  );

  const projectAgreements = inputs.agreements.filter((spks) => {
    if (spks.projectId) return spks.projectId === project.id;
    return matchesClientAndTitle(project, spks.namaPihakKedua, spks.judulProyek);
  });

  const spksNumbers = new Set(
    projectAgreements.map((spks) => normalizeToken(spks.nomorKontrak)).filter(Boolean)
  );

  const projectWorkOrders = inputs.workOrders.filter((spk) => {
    if (spk.projectId) return spk.projectId === project.id;
    const invRef = normalizeToken(spk.nomorInvoiceReferensi);
    const spksRef = normalizeToken(spk.nomorSpksReferensi);
    const quoRef = normalizeToken(spk.nomorPenawaranReferensi);
    if (invRef && invoiceNumbers.has(invRef)) return true;
    if (spksRef && spksNumbers.has(spksRef)) return true;
    if (quoRef && quotationNumbers.has(quoRef)) return true;
    return matchesClientAndTitle(project, spk.namaKlien, spk.namaProyek);
  });

  const spkNumbers = new Set(
    projectWorkOrders.map((spk) => normalizeToken(spk.nomorSpk)).filter(Boolean)
  );

  const projectDeliveryOrders = (inputs.deliveryOrders ?? []).filter((sj) => {
    if (sj.projectId) return sj.projectId === project.id;
    const spkRef = normalizeToken(sj.nomorSpkReferensi);
    const invRef = normalizeToken(sj.nomorInvoiceReferensi);
    if (spkRef && (spksNumbers.has(spkRef) || spkNumbers.has(spkRef))) return true;
    if (invRef && invoiceNumbers.has(invRef)) return true;
    return matchesClientAndTitle(project, sj.namaKlien, sj.namaProyek);
  });

  const deliveryOrderNumbers = new Set(
    projectDeliveryOrders.map((sj) => normalizeToken(sj.nomorSuratJalan)).filter(Boolean)
  );

  const projectHandoverCertificates = inputs.handoverCertificates.filter((bast) => {
    if (bast.projectId) return bast.projectId === project.id;
    const invRef = normalizeToken(bast.nomorInvoiceReferensi);
    const spksRef = normalizeToken(bast.nomorSpksReferensi);
    const spkRef = normalizeToken(bast.nomorSpkReferensi);
    const sjRef = normalizeToken(bast.nomorSuratJalanReferensi);
    const quoRef = normalizeToken(bast.nomorPenawaranReferensi);
    if (invRef && invoiceNumbers.has(invRef)) return true;
    if (spksRef && spksNumbers.has(spksRef)) return true;
    if (spkRef && spkNumbers.has(spkRef)) return true;
    if (sjRef && deliveryOrderNumbers.has(sjRef)) return true;
    if (quoRef && quotationNumbers.has(quoRef)) return true;
    return matchesClientAndTitle(project, bast.namaPihakKedua, bast.namaProyek);
  });

  const projectTransactions = inputs.transactions
    .filter((tx) => {
      if (tx.projectId) return tx.projectId === project.id;
      const ref = normalizeToken(tx.referensiProyek);
      if (
        ref &&
        ((clientCodeLower && ref === clientCodeLower) ||
          invoiceNumbers.has(ref) ||
          spksNumbers.has(ref) ||
          spkNumbers.has(ref))
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      const cmp = b.tanggal.localeCompare(a.tanggal);
      return cmp !== 0 ? cmp : b.dibuatPada.localeCompare(a.dibuatPada);
    });

  const incomeTransactions = projectTransactions.filter((tx) => tx.jenis === 'pemasukan');
  const expenseTransactions = projectTransactions.filter((tx) => tx.jenis === 'pengeluaran');

  const invoiceContractsTotal = projectInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.nilaiTotalKontrak || 0),
    0
  );
  const contractValue =
    project.nilaiKontrak > 0
      ? project.nilaiKontrak
      : invoiceContractsTotal;

  const invoicePaidTotal = projectInvoices.reduce(
    (sum, inv) => sum + computeInvoiceProgress(inv).paidAmount,
    0
  );
  const completedIncomeTxTotal = incomeTransactions
    .filter((tx) => tx.status === 'Selesai')
    .reduce((sum, tx) => sum + Math.max(0, tx.nominal), 0);

  const paidAmount =
    projectInvoices.length > 0
      ? Math.max(invoicePaidTotal, completedIncomeTxTotal)
      : completedIncomeTxTotal;

  const remainingBill = Math.max(0, contractValue - paidAmount);
  const progressPercent =
    contractValue > 0 ? Math.min(100, Math.round((paidAmount / contractValue) * 100)) : 0;

  const expenseTotal = expenseTransactions
    .filter((tx) => tx.status === 'Selesai')
    .reduce((sum, tx) => sum + Math.max(0, tx.nominal), 0);
  const pendingExpenseTotal = expenseTransactions
    .filter((tx) => tx.status === 'Tertunda')
    .reduce((sum, tx) => sum + Math.max(0, tx.nominal), 0);
  const netMargin = paidAmount - expenseTotal;

  const primaryInvoice = projectInvoices[0] ?? null;
  const effectiveScheme = primaryInvoice
    ? resolveEffectivePaymentScheme(primaryInvoice.skemaPembayaran, scheme)
    : projectAgreements[0]?.tahapanPembayaran?.length
      ? resolveEffectivePaymentScheme(projectAgreements[0].tahapanPembayaran, scheme)
      : scheme;

  const combinedPayments =
    projectInvoices.length > 0
      ? projectInvoices.flatMap((inv) => inv.riwayatPembayaran)
      : incomeTransactions
          .filter((tx) => tx.status === 'Selesai')
          .map((tx) => ({ nominal: tx.nominal }));

  const paymentSchedule = evaluateInvoicePaymentSchedule(
    contractValue,
    combinedPayments,
    effectiveScheme
  );

  return {
    project,
    quotations: projectQuotations,
    agreements: projectAgreements,
    workOrders: projectWorkOrders,
    deliveryOrders: projectDeliveryOrders,
    handoverCertificates: projectHandoverCertificates,
    invoices: projectInvoices,
    transactions: projectTransactions,
    incomeTransactions,
    expenseTransactions,
    primaryInvoice,
    paymentSchedule,
    summary: {
      contractValue,
      paidAmount,
      remainingBill,
      expenseTotal,
      pendingExpenseTotal,
      netMargin,
      progressPercent,
      documentCount:
        projectQuotations.length +
        projectAgreements.length +
        projectDeliveryOrders.length +
        projectHandoverCertificates.length +
        projectInvoices.length * effectiveScheme.tahapan.length,
      financeCount: projectTransactions.length,
    },
  };
}

export function filterProjectWorkspaceRows(
  rows: readonly ProjectWorkspaceData[],
  searchQuery: string,
  statusFilter: 'all' | WorkshopProjectStatus
): ProjectWorkspaceData[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter(
    ({ project, quotations, agreements, workOrders, deliveryOrders, invoices, handoverCertificates }) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        project.id,
        project.namaProyek,
        project.namaKlien,
        formatFullWilayahAddress(project.alamat),
        project.alamat?.detail ?? '',
        project.alamat?.desa?.name ?? '',
        project.alamat?.desa?.postalCode ?? '',
        project.alamat?.kecamatan?.name ?? '',
        project.alamat?.kabupaten?.name ?? '',
        project.alamat?.provinsi?.name ?? '',
        ...quotations.map((qItem) => qItem.nomorPenawaran),
        ...agreements.map((a) => a.nomorKontrak),
        ...workOrders.map((w) => w.nomorSpk),
        ...deliveryOrders.map((d) => d.nomorSuratJalan),
        ...invoices.map((i) => i.nomorInvoice),
        ...invoices.flatMap((i) =>
          [0, 1, 2, 3].map((idx) => formatTerminDocumentNumber(i.nomorInvoice, idx))
        ),
        ...handoverCertificates.map((b) => b.nomorBast),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }
  );
}

export function sortProjectWorkspaceRows(
  rows: readonly ProjectWorkspaceData[],
  sortBy: ProjectSortKey
): ProjectWorkspaceData[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sortBy === 'contract_desc') {
      return b.summary.contractValue - a.summary.contractValue;
    }
    if (sortBy === 'remaining_desc') {
      return b.summary.remainingBill - a.summary.remainingBill;
    }
    if (sortBy === 'margin_desc') {
      return b.summary.netMargin - a.summary.netMargin;
    }
    if (sortBy === 'recent') {
      return b.project.dibuatPada.localeCompare(a.project.dibuatPada);
    }
    // target_asc: active projects ordered by nearest deadline first, completed projects after
    const aDone = a.project.status === 'Selesai';
    const bDone = b.project.status === 'Selesai';
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aDate = a.project.tanggalTargetSelesai || '9999-12-31';
    const bDate = b.project.tanggalTargetSelesai || '9999-12-31';
    return aDone ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  });
  return copy;
}

export function computeProjectStatusCounts(
  rows: readonly ProjectWorkspaceData[]
): Record<'all' | WorkshopProjectStatus, number> {
  const counts: Record<'all' | WorkshopProjectStatus, number> = {
    all: rows.length,
    Perencanaan: 0,
    Produksi: 0,
    Instalasi: 0,
    Selesai: 0,
  };
  for (const row of rows) {
    counts[row.project.status] += 1;
  }
  return counts;
}

export function evaluateProjectSchedule(
  project: Pick<WorkshopProject, 'status' | 'tanggalTargetSelesai'>,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): ProjectScheduleStatus {
  if (project.status === 'Selesai') {
    return { state: 'done', label: 'Selesai', daysDelta: 0 };
  }
  const targetIso = project.tanggalTargetSelesai?.trim();
  if (!targetIso) {
    return { state: 'unset', label: 'Tanpa target', daysDelta: null };
  }
  const targetMs = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`);
  const refMs = Date.parse(`${referenceDateIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(targetMs) || !Number.isFinite(refMs)) {
    return { state: 'unset', label: targetIso, daysDelta: null };
  }
  const daysDelta = Math.round((targetMs - refMs) / 86400000);
  if (daysDelta < 0) {
    return {
      state: 'overdue',
      label: `Terlambat ${Math.abs(daysDelta)} hr`,
      daysDelta,
    };
  }
  if (daysDelta === 0) {
    return { state: 'due_soon', label: 'Tenggat hari ini', daysDelta: 0 };
  }
  if (daysDelta <= 7) {
    return { state: 'due_soon', label: `Sisa ${daysDelta} hr`, daysDelta };
  }
  return { state: 'on_track', label: `Sisa ${daysDelta} hr`, daysDelta };
}

export function computeProjectsDirectoryOverview(
  rows: readonly ProjectWorkspaceData[],
  allTransactions: readonly FinanceTransaction[]
): ProjectsDirectoryOverview {
  let totalContractValue = 0;
  let totalIncome = 0;
  let totalRemainingBill = 0;
  let totalExpenses = 0;
  let activeProjects = 0;

  for (const row of rows) {
    totalContractValue += row.summary.contractValue;
    totalIncome += row.summary.paidAmount;
    totalRemainingBill += row.summary.remainingBill;
    totalExpenses += row.summary.expenseTotal;
    if (row.project.status !== 'Selesai') {
      activeProjects += 1;
    }
  }

  const workshopGeneralExpenses = allTransactions
    .filter((tx) => !tx.projectId && tx.jenis === 'pengeluaran' && tx.status === 'Selesai')
    .reduce((sum, tx) => sum + Math.max(0, tx.nominal), 0);

  return {
    totalProjects: rows.length,
    activeProjects,
    totalContractValue,
    totalIncome,
    totalRemainingBill,
    totalExpenses,
    netMargin: totalIncome - totalExpenses,
    workshopGeneralExpenses,
  };
}

function resolveWorkspaceCity(businessConfig: BusinessConfig): string {
  return (
    businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta'
  );
}

function estimateWorkspaceWorkDays(
  startIso: string,
  targetIso: string,
  fallbackDays: number
): number {
  const startMs = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const endMs = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    return Math.max(1, Math.round((endMs - startMs) / 86400000));
  }
  return fallbackDays;
}

export function buildProjectQuotationDraft(
  project: WorkshopProject,
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): QuotationDocument {
  const base = createEmptyQuotation(seq, businessConfig, paymentScheme, {
    clientCodeOrSeq: project.id || seq,
    date: project.dibuatPada || project.tanggalMulai,
  });
  const companyCity = resolveWorkspaceCity(businessConfig);
  const docDates = resolveProjectDocumentDates(project);
  const tech = resolveProjectTechnicalDetails(project, companyCity);
  const resolvedItems = resolveProjectProductItems(project);
  const estimatedDays = estimateWorkspaceWorkDays(
    project.tanggalMulai,
    project.tanggalTargetSelesai,
    base.estimasiDurasiHari
  );
  const locationLabel = formatFullWilayahAddress(project.alamat, companyCity) || companyCity;

  const quotationValidUntil =
    docDates.berlakuHingga || computeQuotationValidUntilIso(project.tanggalMulai);

  return {
    ...base,
    projectId: project.id,
    tanggalPenawaran: docDates.tanggalPenawaran,
    berlakuHingga: quotationValidUntil,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    teleponKlien: project.teleponKlien,
    alamatLokasi: locationLabel,
    estimasiDurasiHari: estimatedDays,
    daftarItem:
      resolvedItems.length > 0
        ? resolvedItems.map((item, idx) => {
            const paidAddons = (item.tambahan ?? [])
              .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
              .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
            const specText =
              paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
                ? `${item.spesifikasiMaterial} [${paidAddons.join(', ')}]`
                : item.spesifikasiMaterial;
            return {
              id: `pen-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
              namaItem: item.namaProduk,
              dimensi: item.dimensi,
              spesifikasiMaterial: specText,
              satuan: item.satuan,
              jumlah: item.jumlah,
              hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
            };
          })
        : base.daftarItem,
    syaratKetentuan: [
      `1. Ruang Lingkup Pekerjaan: Estimasi harga ini mencakup survei pengukuran ulang lokasi, gambar kerja (shop drawing), pengadaan material utama sesuai BOQ, fabrikasi workshop ${businessConfig.namaMerek}, pengiriman, dan instalasi di ${locationLabel}.`,
      `2. Masa Berlaku & Pengikatan Harga: Penawaran berlaku hingga ${formatShortDateId(quotationValidUntil)} (H-1 sebelum jadwal mulai pekerjaan). Perubahan ukuran, material, atau penambahan item di luar BOQ akan disesuaikan melalui revisi penawaran/addendum tertulis.`,
      `3. Dasar Pelaksanaan & Pengikatan SPK: Proyek diproses ke tahap produksi (${estimatedDays} hari kerja efektif) setelah penawaran disetujui secara tertulis oleh klien dan Surat Perjanjian Kerja (SPK) beserta pembayaran Termin 1 (Uang Muka / DP) diselesaikan.`,
      '4. Pengecualian Pekerjaan: Pekerjaan sipil, bobok dinding, instalasi titik listrik/plumbing utama, dan perangkat elektronik di luar BOQ tidak termasuk dalam nilai penawaran ini.',
      '5. Perubahan Desain (Variation Order): Perubahan desain, tipe finishing, atau aksesori setelah gambar kerja dikunci wajib disepakati tertulis beserta penyesuaian biaya dan jadwal.',
      `6. Jaminan Mutu & Garansi: Seluruh unit dilindungi garansi konstruksi dan penyetelan engsel/rel selama ${tech.masaGaransiBulan} bulan terhitung sejak penandatanganan Berita Acara Serah Terima (BAST).`,
    ].join('\n'),
    catatanTambahan: base.catatanTambahan,
  };
}

export function buildProjectSpkDraft(
  project: WorkshopProject,
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  siblings?: Pick<ProjectWorkspaceData, 'quotations' | 'agreements' | 'invoices'>
): WorkOrderDocument {
  const base = createEmptyWorkOrder(seq, businessConfig, paymentScheme, {
    clientCodeOrSeq: project.id || seq,
    date: project.dibuatPada || project.tanggalMulai,
  });
  const companyCity = resolveWorkspaceCity(businessConfig);
  const docDates = resolveProjectDocumentDates(project);
  const resolvedItems = resolveProjectProductItems(project);

  const approvedQuotation =
    siblings?.quotations?.find((q) => q.status === 'Disetujui Klien') ?? siblings?.quotations?.[0];
  const firstSpks = siblings?.agreements?.[0];
  const firstInvoice = siblings?.invoices?.[0];
  const quotationTotal = approvedQuotation ? computeQuotationTotal(approvedQuotation.daftarItem) : 0;

  const startDate = project.tanggalMulai || base.tanggalMulai || docDates.tanggalSpk;
  const targetDate = project.tanggalTargetSelesai || base.tanggalTargetSelesai || docDates.tanggalKirim;
  const quoRef = approvedQuotation?.nomorPenawaran ?? '';
  const invRef = firstInvoice?.nomorInvoice ?? '';
  const spksRef = firstSpks?.nomorKontrak ?? '';
  const projectRefLabel = project.id || project.namaProyek;

  const mappedItems =
    approvedQuotation && approvedQuotation.daftarItem.length > 0
      ? approvedQuotation.daftarItem.map((item, idx) => ({
          id: `spk-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaUnit: item.namaItem,
          dimensi: item.dimensi,
          spesifikasiMaterial: item.spesifikasiMaterial,
          jumlah: item.jumlah,
        }))
      : resolvedItems.map((item, idx) => ({
          id: `spk-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          namaUnit: item.namaProduk,
          dimensi: item.dimensi,
          spesifikasiMaterial: item.spesifikasiMaterial,
          jumlah: item.jumlah,
        }));

  return {
    ...base,
    projectId: project.id,
    tanggalTerbit: docDates.tanggalSpk,
    tanggalMulai: startDate,
    tanggalTargetSelesai: targetDate,
    perusahaanPelaksana: businessConfig.namaMerek,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    teleponKlien: project.teleponKlien || approvedQuotation?.teleponKlien || '',
    alamatPemasangan: formatFullWilayahAddress(project.alamat, companyCity) || companyCity,
    referensiGambarKerja: `Shop Drawing Final ${projectRefLabel}`,
    nomorPenawaranReferensi: quoRef,
    nomorInvoiceReferensi: invRef,
    nomorSpksReferensi: spksRef,
    nilaiKontrakReferensi:
      project.nilaiKontrak > 0
        ? project.nilaiKontrak
        : firstInvoice?.nilaiTotalKontrak ??
          firstSpks?.nilaiKontrak ??
          (quotationTotal > 0 ? quotationTotal : 0),
    tahapanPembayaran:
      firstInvoice?.skemaPembayaran?.length
        ? structuredClone(firstInvoice.skemaPembayaran)
        : approvedQuotation?.tahapanPembayaran?.length
          ? structuredClone(approvedQuotation.tahapanPembayaran)
          : firstSpks?.tahapanPembayaran?.length
            ? structuredClone(firstSpks.tahapanPembayaran)
            : clonePaymentSchemeStages(paymentScheme),
    daftarItem: mappedItems.length > 0 ? mappedItems : base.daftarItem,
    catatanTeknis: base.catatanTeknis,
    syaratKetentuan: [
      `1. Persetujuan & Perintah Mulai Kerja: Dengan ditandatanganinya Surat Perintah Kerja (SPK) ini oleh Klien (Pemberi Kerja) dan Owner / Pelaksana (${businessConfig.namaMerek}), seluruh lingkup pekerjaan, desain, serta spesifikasi material dinyatakan telah disetujui oleh Klien dan pekerjaan akan segera dikerjakan.`,
      `2. Lingkup & Acuan Teknis: ${businessConfig.namaMerek} wajib memproduksi dan memasang seluruh unit sesuai ${quoRef ? `Surat Penawaran ${quoRef}` : 'Penawaran final'}${spksRef ? `, Kontrak ${spksRef},` : ''} serta Shop Drawing Final ${projectRefLabel} yang telah disetujui bersama.`,
      `3. Jangka Waktu & Pelaksanaan: Pekerjaan dilaksanakan pada periode ${formatShortDateId(startDate)} hingga ${formatShortDateId(targetDate)}, terhitung efektif setelah SPK ini ditandatangani oleh Klien dan pembayaran Termin 1 (Uang Muka / DP) diterima.`,
      `4. Perubahan Pekerjaan (Addendum): Setiap perubahan ukuran, material, warna finishing, atau penambahan/pengurangan item setelah SPK ditandatangani wajib disepakati secara tertulis oleh Klien dan ${businessConfig.namaMerek}.`,
      '5. Pengemasan & Persiapan Pengiriman: Setiap modul diperiksa kesesuaian spesifikasinya serta dikemas aman dengan pelindung sudut sebelum pengiriman.',
      '6. Keamanan & Kebersihan Lokasi: Tim pelaksana wajib menggunakan APD standar, menjaga keamanan properti Klien, dan membersihkan area lokasi setelah pemasangan selesai.',
      `7. Serah Terima & Penagihan Termin: Pembayaran dilakukan bertahap sesuai skema termin${invRef ? ` pada Invoice ${invRef}` : ''}, dan penyelesaian pekerjaan dibuktikan melalui Surat Jalan serta BAST.`,
    ].join('\n'),
  };
}

export function buildProjectDeliveryOrderDraft(
  project: WorkshopProject,
  seq: number,
  businessConfig: BusinessConfig,
  siblings?: Pick<ProjectWorkspaceData, 'quotations' | 'agreements' | 'workOrders' | 'invoices'>
): DeliveryOrderDocument {
  const companyCity = resolveWorkspaceCity(businessConfig);
  const docDates = resolveProjectDocumentDates(project);
  const tech = resolveProjectTechnicalDetails(project, companyCity);
  const resolvedItems = resolveProjectProductItems(project);

  let draft: DeliveryOrderDocument = {
    ...createEmptyDeliveryOrder(seq, businessConfig, {
      clientCodeOrSeq: project.id || seq,
      date: project.dibuatPada || project.tanggalMulai,
    }),
    projectId: project.id,
    tanggalKirim: docDates.tanggalKirim,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    teleponKlien: project.teleponKlien,
    alamatTujuan: formatFullWilayahAddress(project.alamat, companyCity) || companyCity,
    penanggungJawabPengirimanInstalasi: tech.penanggungJawabPengirimanInstalasi,
    namaPenerimaLapangan: '',
    nomorInvoiceReferensi: siblings?.invoices?.[0]?.nomorInvoice ?? '',
    daftarItem: resolvedItems.map((item, idx) => ({
      id: `sj-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      namaBarang: item.namaProduk,
      dimensi: item.dimensi,
      jumlahUnit: item.jumlah,
      kondisiSaatKeluar: 'Baik & Terkemas Rapi',
      catatanPemasangan: item.spesifikasiMaterial,
    })),
  };

  if (siblings?.quotations?.[0]) {
    draft = buildDeliveryOrderPrefillFromQuotation(siblings.quotations[0], draft);
  }
  if (siblings?.agreements?.[0]) {
    draft = buildDeliveryOrderPrefillFromAgreement(siblings.agreements[0], draft);
  } else if (siblings?.workOrders?.[0]) {
    draft = buildDeliveryOrderPrefillFromSpk(siblings.workOrders[0], draft);
  }

  return {
    ...draft,
    projectId: project.id,
    penanggungJawabPengirimanInstalasi: tech.penanggungJawabPengirimanInstalasi,
    namaPenerimaLapangan: '',
    instruksiPemasangan: [
      '1. Pemeriksaan Detail Barang Saat Pengiriman (Barang Datang): Seluruh rincian barang, dimensi, spesifikasi, jumlah unit, dan kondisi fisik wajib diperiksa bersama di lokasi untuk memastikan setiap item benar dan telah sampai lengkap sebelum ditandatangani oleh Owner dan Klien.',
      '2. Pencatatan Selisih / Cacat Kirim: Apabila ditemukan ketidaksesuaian spesifikasi, jumlah, atau kerusakan selama pengangkutan, wajib dicatat langsung pada kolom kondisi sebelum penandatanganan penerimaan barang.',
      '3. Tanggung Jawab Mobilisasi & Pemasangan: Risiko pengangkutan hingga proses instalasi selesai menjadi tanggung jawab pelaksana sampai seluruh unit terpasang sesuai pesanan dan gambar kerja.',
      `4. Verifikasi Ulang Setelah Instalasi Selesai (Arsip): Setelah seluruh unit selesai dipasang di lokasi, Klien menandatangani kolom verifikasi ulang (tanda tangan ke-3) pada Surat Jalan ${draft.nomorSuratJalan}${draft.nomorSpkReferensi ? ` (Ref. ${draft.nomorSpkReferensi})` : ''} sebelum salinan resmi diarsipkan.`,
    ].join('\n'),
  };
}

export function buildProjectSpksDraft(
  project: WorkshopProject,
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): CooperationAgreementDocument {
  const base = createEmptyAgreement(seq, businessConfig, paymentScheme, {
    clientCodeOrSeq: project.id || seq,
    date: project.dibuatPada || project.tanggalMulai,
  });
  const companyCity = resolveWorkspaceCity(businessConfig);
  const docDates = resolveProjectDocumentDates(project);
  const tech = resolveProjectTechnicalDetails(project, companyCity);
  const resolvedItems = resolveProjectProductItems(project);
  const durationDays = estimateWorkspaceWorkDays(
    project.tanggalMulai,
    project.tanggalTargetSelesai,
    base.durasiKerjaHari
  );
  const locationLabel = formatFullWilayahAddress(project.alamat, companyCity) || companyCity;
  const contractValue = project.nilaiKontrak > 0 ? project.nilaiKontrak : base.nilaiKontrak;
  const itemSummary = resolvedItems
    .map((item) => `${item.namaProduk} (${item.jumlah} ${item.satuan})`)
    .join(', ');
  const stages = base.tahapanPembayaran ?? clonePaymentSchemeStages(paymentScheme);
  const paymentClauseBody = buildAgreementPaymentClauseText(stages, paymentScheme.catatan);

  const startDate = project.tanggalMulai?.trim() || docDates.tanggalSpk || base.tanggalMulaiKerja || '';
  const targetDate = project.tanggalTargetSelesai?.trim() || base.tanggalSelesaiKerja || '';
  const projectRefLabel = project.id || project.namaProyek;
  const lampiranAcuan = `Surat Penawaran Final, Rincian RAB / Bill of Quantities (BOQ), Gambar Kerja Teknis (Shop Drawing Final ${projectRefLabel}), dan Spesifikasi Material & Finishing.`;

  const projectClauses = base.daftarPasal.map((clause, idx) => {
    if (idx === 0) {
      return {
        ...clause,
        isiPasal: `1. Jenis & Lokasi Pekerjaan: PIHAK PERTAMA berkewajiban melaksanakan survei pengukuran ulang, penyusunan gambar kerja teknis (shop drawing), pengadaan material utama dan hardware, fabrikasi di workshop, pengemasan, pengiriman, hingga pemasangan unit untuk pekerjaan "${project.namaProyek}" di ${locationLabel}${itemSummary ? ` yang meliputi: ${itemSummary}` : ''}.\n2. Lampiran Acuan & Batasan: Pelaksanaan mengacu pada Tabel Rincian Detail Produk & Spesifikasi (Bagian II) serta ${lampiranAcuan} Pekerjaan sipil, pembobokan dinding, instalasi jalur listrik/plumbing utama, dan perangkat elektronik di luar BOQ tidak termasuk lingkup SPK ini kecuali disepakati tertulis.`,
      };
    }
    if (idx === 1) {
      return {
        ...clause,
        isiPasal: `1. Nilai Kontrak & Skema Termin: Nilai total kontrak yang disepakati adalah sebesar ${formatRupiahSigned(contractValue)}. ${paymentClauseBody}\n2. Rekening Tujuan Resmi: Pembayaran resmi hanya dianggap sah apabila ditransfer ke rekening BNI 1905207398 atau BSI 7370860534 a.n. Hilman Aziz Napis dengan mencantumkan nomor SPK.\n3. Penangguhan Produksi: Keterlambatan pembayaran termin berhak mengakibatkan penangguhan sementara jadwal produksi, pengiriman, atau instalasi hingga kewajiban termin terkait diselesaikan.`,
      };
    }
    if (idx === 2) {
      return {
        ...clause,
        isiPasal: `1. Durasi & Jadwal Pelaksanaan: Jangka waktu pelaksanaan pekerjaan ditetapkan selama ${durationDays} (hari) kerja efektif (${formatShortDateId(startDate)} s.d. ${formatShortDateId(targetDate)}), terhitung sejak diterimanya pembayaran Termin 1 (Uang Muka / DP) dan persetujuan gambar kerja final.\n2. Pengecualian Keterlambatan: Penyesuaian jadwal tidak dihitung sebagai keterlambatan Kontraktor apabila disebabkan oleh: (a) keterlambatan pembayaran termin oleh Klien; (b) keterlambatan persetujuan desain/warna/material oleh Klien; (c) lokasi kerja belum siap atau terhambat pekerjaan sipil/MEP pihak lain; atau (d) Keadaan Kahar (Force Majeure).`,
      };
    }
    if (idx === 5) {
      return {
        ...clause,
        isiPasal: `1. Durasi Garansi & Retensi: PIHAK PERTAMA memberikan Masa Pemeliharaan & Garansi selama ${tech.masaGaransiBulan} bulan terhitung sejak penandatanganan BAST, dengan penyelesaian pelunasan termin akhir (retensi serah terima) bersamaan dengan BAST.\n2. Cakupan & Pengecualian: Garansi mencakup perbaikan konstruksi, sambungan, penyetelan engsel slow-motion, serta rel laci. Garansi tidak mencakup kerusakan akibat kesalahan pemakaian, beban berlebih, modifikasi pihak lain, kebocoran bangunan, kelembapan ekstrem, atau bencana alam.`,
      };
    }
    return clause;
  });

  const clientEntityType = normalizeClientEntityType(project.jenisKlien, project.namaKlien);
  const clientPic =
    clientEntityType === 'pribadi' ? '' : project.penanggungJawabKlien?.trim() || '';
  const clientRole =
    clientEntityType === 'pribadi'
      ? 'Pemberi Tugas / Klien'
      : project.jabatanKlien?.trim() || 'Penanggung Jawab';

  return {
    ...base,
    projectId: project.id,
    kotaPenandatanganan: companyCity,
    tanggalPenandatanganan: docDates.tanggalSpk || project.tanggalMulai || base.tanggalPenandatanganan,
    teleponPihakPertama: businessConfig.whatsapp.nomorTampil,
    judulProyek: project.namaProyek,
    jenisPihakKedua: clientEntityType,
    namaPerusahaanPihakKedua: clientEntityType === 'pribadi' ? undefined : project.namaKlien,
    penanggungJawabPihakKedua: clientPic || undefined,
    namaPihakKedua: project.namaKlien,
    jabatanPihakKedua: clientRole,
    teleponPihakKedua: project.teleponKlien,
    alamatPihakKedua: locationLabel,
    lokasiProyek: locationLabel,
    nilaiKontrak: contractValue,
    durasiKerjaHari: durationDays,
    tanggalMulaiKerja: startDate,
    tanggalSelesaiKerja: targetDate,
    lampiranAcuan,
    masaGaransiBulan: tech.masaGaransiBulan,
    daftarProduk: buildAgreementProductItemsFromProject(project),
    saksiPihakPertama: '',
    saksiPihakKedua: clientPic || project.namaKlien,
    daftarPasal: projectClauses,
  };
}

export function buildProjectBastDraft(
  project: WorkshopProject,
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  siblings?: Pick<
    ProjectWorkspaceData,
    'quotations' | 'agreements' | 'workOrders' | 'deliveryOrders' | 'invoices'
  >
): HandoverCertificateDocument {
  const companyCity = resolveWorkspaceCity(businessConfig);
  const docDates = resolveProjectDocumentDates(project);
  const tech = resolveProjectTechnicalDetails(project, companyCity);
  const resolvedItems = resolveProjectProductItems(project);
  const locationLabel = formatFullWilayahAddress(project.alamat, companyCity) || companyCity;

  const completionDate =
    docDates.tanggalBast || project.tanggalTargetSelesai?.trim() || docDates.tanggalKirim;

  let draft: HandoverCertificateDocument = {
    ...createEmptyHandover(seq, businessConfig, paymentScheme, {
      clientCodeOrSeq: project.id || seq,
      date: project.dibuatPada || project.tanggalMulai,
    }),
    projectId: project.id,
    kotaSerahTerima: companyCity,
    tanggalSerahTerima: completionDate,
    tanggalMulaiGaransi: completionDate,
    masaGaransiBulan: tech.masaGaransiBulan,
    namaProyek: project.namaProyek,
    namaPihakKedua: project.namaKlien,
    teleponPihakKedua: project.teleponKlien,
    alamatPihakKedua: locationLabel,
    lokasiPemasangan: locationLabel,
    nilaiKontrakReferensi: project.nilaiKontrak,
    tanggalTermin: [
      docDates.tanggalTermin1,
      docDates.tanggalTermin2,
      docDates.tanggalTermin3,
      docDates.tanggalTermin4,
    ],
    nomorPenawaranReferensi: siblings?.quotations?.[0]?.nomorPenawaran ?? '',
    saksiPihakPertama: '',
    saksiPihakKedua: project.namaKlien,
    daftarItem: resolvedItems.map((item, idx) => ({
      id: `bast-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      namaUnit: item.namaProduk,
      dimensi: item.dimensi,
      jumlah: item.jumlah,
      kondisi: 'Baik & Sesuai',
      catatan: item.spesifikasiMaterial || '',
    })),
  };

  if (siblings?.agreements?.[0]) {
    draft = buildHandoverPrefillFromAgreement(siblings.agreements[0], draft, paymentScheme);
  } else if (siblings?.workOrders?.[0]) {
    draft = buildHandoverPrefillFromSpk(siblings.workOrders[0], draft, paymentScheme);
  }
  if (siblings?.deliveryOrders?.[0]) {
    draft = buildHandoverPrefillFromDeliveryOrder(siblings.deliveryOrders[0], draft);
  }
  if (siblings?.invoices?.[0]) {
    draft = buildHandoverPrefillFromInvoice(siblings.invoices[0], draft, paymentScheme);
  }

  const refList = [draft.nomorSpksReferensi || draft.nomorSpkReferensi, draft.nomorSuratJalanReferensi]
    .filter(Boolean)
    .join(' / ');
  const invLabel = draft.nomorInvoiceReferensi ? `pada Invoice ${draft.nomorInvoiceReferensi}` : 'yang tercatat';

  return {
    ...draft,
    projectId: project.id,
    catatanPembayaran:
      'Berita Acara Serah Terima diterbitkan setelah penerimaan pembayaran Termin 4 dan verifikasi kelunasan seluruh nilai kontrak.',
    teksPernyataan: [
      `1. Pernyataan Pemeriksaan & Penerimaan: Pada hari ini tanggal ${formatShortDateId(draft.tanggalSerahTerima)}, PIHAK PERTAMA dan PIHAK KEDUA telah melaksanakan pemeriksaan fisik serta verifikasi kesesuaian bersama di ${draft.lokasiPemasangan || locationLabel} atas pekerjaan "${draft.namaProyek}"${refList ? ` (Ref. ${refList})` : ''}. Seluruh unit dalam daftar terlampir dinyatakan telah selesai (${draft.persentaseSelesai}%), terpasang dengan baik, dan diterima oleh PIHAK KEDUA.`,
      '2. Peralihan Tanggung Jawab & Hak Guna: Terhitung sejak ditandatanganinya Berita Acara Serah Terima ini, risiko pemanfaatan serta pengelolaan harian unit pekerjaan resmi beralih dari PIHAK PERTAMA kepada PIHAK KEDUA.',
      `3. Masa Garansi Pemeliharaan: PIHAK PERTAMA memberikan Masa Garansi Pemeliharaan selama ${draft.masaGaransiBulan} bulan terhitung mulai ${formatShortDateId(draft.tanggalMulaiGaransi)} yang mencakup penyetelan engsel/rel dan perbaikan cacat pengerjaan, tidak termasuk kerusakan akibat kesalahan pemakaian, beban berlebih, kebocoran bangunan, atau keadaan kahar.`,
      `4. Penyelesaian Proyek & Record Pembayaran: Berita Acara Serah Terima ini merupakan dokumen final penyelesaian proyek yang diterbitkan setelah penerimaan pembayaran Termin 4 sesuai catatan pelunasan ${invLabel}.`,
    ].join('\n'),
  };
}

export function buildProjectInvoiceDraft(
  project: WorkshopProject,
  seq: number,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  siblings?: Pick<ProjectWorkspaceData, 'agreements' | 'workOrders' | 'handoverCertificates'>
): ProjectInvoice {
  const base = createEmptyInvoice(seq, paymentScheme, {
    clientCodeOrSeq: project.id || seq,
    date: project.dibuatPada || project.tanggalMulai,
  });
  const docDates = resolveProjectDocumentDates(project);
  const resolvedItems = resolveProjectProductItems(project);
  const productsTotal = computeProjectProductsTotal(resolvedItems);
  const contractTotal =
    project.daftarProduk && project.daftarProduk.length > 0 && productsTotal > 0
      ? productsTotal
      : project.nilaiKontrak;

  const completionDate =
    docDates.tanggalJatuhTempo || project.tanggalTargetSelesai?.trim() || base.tanggalJatuhTempo;

  return {
    ...base,
    projectId: project.id,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    lokasi: formatFullWilayahAddress(project.alamat),
    nilaiTotalKontrak: contractTotal,
    tanggalJatuhTempo: completionDate,
    tanggalTermin: [
      docDates.tanggalTermin1 || docDates.tanggalPenawaran,
      docDates.tanggalTermin2 || docDates.tanggalSpk,
      docDates.tanggalTermin3 || docDates.tanggalKirim,
      docDates.tanggalTermin4 || completionDate,
    ],
    nomorSpkReferensi:
      siblings?.agreements?.[0]?.nomorKontrak ?? siblings?.workOrders?.[0]?.nomorSpk ?? '',
    nomorBastReferensi: siblings?.handoverCertificates?.[0]?.nomorBast ?? '',
    rincianItem: resolvedItems.map((item, idx) => {
      const formattedDim = formatDocumentDimensionDisplay(item.dimensi);
      const paidAddons = (item.tambahan ?? [])
        .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
        .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
      const specText =
        paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
          ? `${item.spesifikasiMaterial} [${paidAddons.join(', ')}]`
          : item.spesifikasiMaterial;
      return {
        id: `inv-li-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        deskripsi: formattedDim
          ? `${item.namaProduk} (${formattedDim}) — ${specText}`
          : `${item.namaProduk} — ${specText}`,
        jumlah: item.jumlah,
        hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      };
    }),
    catatan: '',
  };
}

export function buildProjectPurchaseDraft(
  project: WorkshopProject,
  siblings?: Pick<ProjectWorkspaceData, 'invoices'>
): FinanceTransaction {
  const ref = siblings?.invoices?.[0]?.nomorInvoice || project.id || project.namaProyek;
  return {
    ...createEmptyPurchase(ref),
    projectId: project.id,
  };
}

export function buildProjectTransactionDraft(
  project: WorkshopProject,
  jenis: FinanceTransactionType,
  siblings?: Pick<ProjectWorkspaceData, 'invoices'>
): FinanceTransaction {
  const base = createEmptyTransaction();
  const ref = siblings?.invoices?.[0]?.nomorInvoice || project.id || project.namaProyek;
  return {
    ...base,
    projectId: project.id,
    jenis,
    kategori: resolveCategoryForType(jenis, base.kategori),
    pihakTerkait: jenis === 'pemasukan' ? project.namaKlien : '',
    referensiProyek: ref,
  };
}

export function buildProjectJournalEntries(
  transactions: readonly FinanceTransaction[]
): ProjectJournalEntry[] {
  if (transactions.length === 0) return [];

  const chronological = [...transactions].sort((a, b) => {
    const dateCmp = a.tanggal.localeCompare(b.tanggal);
    if (dateCmp !== 0) return dateCmp;
    const createdCmp = a.dibuatPada.localeCompare(b.dibuatPada);
    if (createdCmp !== 0) return createdCmp;
    return a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  const entriesAsc: ProjectJournalEntry[] = chronological.map((tx) => {
    const amount = Math.max(0, Math.round(tx.nominal || 0));
    const isIncome = tx.jenis === 'pemasukan';
    const creditAmount = isIncome ? amount : 0;
    const debitAmount = isIncome ? 0 : amount;
    const cashDelta = tx.status === 'Selesai' ? (isIncome ? amount : -amount) : 0;
    runningBalance += cashDelta;

    return {
      transaction: tx,
      creditAmount,
      debitAmount,
      cashDelta,
      runningBalance,
    };
  });

  return entriesAsc.reverse();
}

export function computeProjectJournalTotals(
  entries: readonly ProjectJournalEntry[]
): ProjectJournalTotals {
  let completedIncome = 0;
  let completedExpense = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;

  for (const entry of entries) {
    const { transaction, creditAmount, debitAmount } = entry;
    if (transaction.status === 'Selesai') {
      completedIncome += creditAmount;
      completedExpense += debitAmount;
    } else {
      pendingIncome += creditAmount;
      pendingExpense += debitAmount;
    }
  }

  return {
    completedIncome,
    completedExpense,
    pendingIncome,
    pendingExpense,
    endingBalance: completedIncome - completedExpense,
  };
}

export function formatClientNameWithCode(
  namaKlien?: string | null,
  kodeKlien?: string | null
): string {
  const name = String(namaKlien ?? '').trim();
  const code = String(kodeKlien ?? '').trim();
  if (!name && !code) return '';
  if (!name) return code;
  if (!code) return name;
  return name.includes(`(${code})`) ? name : `${name} (${code})`;
}

export function formatProjectCardCity(
  project: Pick<WorkshopProject, 'alamat'>
): string {
  return formatCityFromWilayah(project.alamat);
}

export function formatProjectHeaderClientMeta(
  project: Pick<WorkshopProject, 'namaKlien' | 'teleponKlien' | 'alamat'>
): string {
  const locationLabel = formatDesaKotaLabel(project.alamat);
  const phoneLabel = formatDocumentPhoneDisplay(project.teleponKlien);
  return [locationLabel, phoneLabel].filter(Boolean).join(' · ');
}



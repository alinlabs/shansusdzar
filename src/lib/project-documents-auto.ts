import { normalizeClientEntityType } from './agreement-identity';
import { computeInvoiceProgress, formatRupiahSigned, formatShortDateId } from './finance-utils';
import {
  formatWorkshopDocumentNumber,
  resolveProjectClientDigits,
} from './document-numbering';
import {
  formatDocumentDimensionDisplay,
  normalizeDimensionString,
} from './dimension-format';
import {
  DEFAULT_PAYMENT_SCHEME,
  buildAgreementPaymentClauseText,
  clonePaymentSchemeStages,
  deriveLegacyThreeStagePercentages,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from './payment-scheme';
import { parseIndonesianPhoneInput } from './phone-format';
import {
  DEFAULT_CATALOG_PRODUCTS,
  buildProjectProductSpecification,
  computeProjectProductSubtotal,
  computeProjectProductTambahanTotal,
  findCatalogProduct,
  resolveProjectProductName,
} from './project-products';
import { formatFullWilayahAddress } from './wilayah-indonesia';
import type { BusinessConfig } from '../types/business';
import type { PaymentSchemeConfig } from '../types/cms';
import type {
  CooperationAgreementDocument,
  CooperationAgreementProductItem,
  DeliveryOrderDocument,
  HandoverCertificateDocument,
  QuotationDocument,
} from '../types/documents';
import type {
  InvoiceLineItem,
  ProjectDocumentDates,
  ProjectInvoice,
  ProjectProductItem,
  ProjectTechnicalDetails,
  WorkshopProject,
} from '../types/finance';

export interface AutoProjectDocumentBundle {
  quotation: QuotationDocument;
  agreement: CooperationAgreementDocument;
  deliveryOrder: DeliveryOrderDocument;
  handoverCertificate: HandoverCertificateDocument;
  invoice: ProjectInvoice;
}

export interface ExistingProjectDocumentRefs {
  quotation?: QuotationDocument;
  agreement?: CooperationAgreementDocument;
  deliveryOrder?: DeliveryOrderDocument;
  handoverCertificate?: HandoverCertificateDocument;
  invoice?: ProjectInvoice;
}

const INTERNAL_PAYMENT_OR_STATUS_NOTE_PATTERN =
  /\b(menunggu\s+(?:termin|transfer|pembayaran|pelunasan)|termin\s*\d+|pra-instalasi|down\s*payment|serah\s*terima|penawaran\s+telah\s+disetujui|garansi\s+.*\s+aktif\s+setelah\s+bast)\b/i;

export function sanitizeQuotationTechnicalNote(note?: string): string {
  const trimmed = note?.trim() ?? '';
  if (!trimmed) return '';
  if (INTERNAL_PAYMENT_OR_STATUS_NOTE_PATTERN.test(trimmed)) {
    return '';
  }
  return trimmed;
}

function addDaysIso(baseIso: string, deltaDays: number): string {
  const parsed = Date.parse(`${baseIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    return new Date(Date.now() + deltaDays * 86400000).toISOString().slice(0, 10);
  }
  return new Date(parsed + deltaDays * 86400000).toISOString().slice(0, 10);
}

function interpolateIso(startIso: string, endIso: string, ratio: number): string {
  const startMs = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const endMs = Date.parse(`${endIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return startIso.slice(0, 10);
  }
  return new Date(startMs + Math.round((endMs - startMs) * ratio)).toISOString().slice(0, 10);
}

function resolveProjectIssueDate(project: WorkshopProject): string {
  return project.dibuatPada?.trim() || project.tanggalMulai?.trim() || new Date().toISOString().slice(0, 10);
}

function estimateWorkDays(startIso: string, targetIso: string): number {
  const startMs = Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`);
  const endMs = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    return Math.max(7, Math.round((endMs - startMs) / 86400000));
  }
  return 14;
}

function buildDefaultLineSpecs(project: WorkshopProject): {
  namaItem: string;
  dimensi: string;
  spesifikasiMaterial: string;
  catatanPasang: string;
} {
  const titleLower = project.namaProyek.toLowerCase();

  if (titleLower.includes('kitchen') || titleLower.includes('dapur')) {
    return {
      namaItem: project.namaProyek,
      dimensi: 'Sesuai Gambar Kerja Lapangan',
      spesifikasiMaterial: 'PVC Board & Multipleks 18 MM, Finishing HPL, Engsel Soft-Close',
      catatanPasang: 'Leveling kabinet bawah & atas, pasang sink/aksesoris sesuai shop drawing.',
    };
  }

  if (titleLower.includes('meja') || titleLower.includes('panel') || titleLower.includes('kantor')) {
    return {
      namaItem: project.namaProyek,
      dimensi: 'Sesuai Gambar Kerja Lapangan',
      spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL Matte, Edging PVC & Jalur Kabel',
      catatanPasang: 'Rakit modul di lokasi, pasang wall panel & cek titik stop kontak.',
    };
  }

  return {
    namaItem: project.namaProyek,
    dimensi: 'Sesuai Gambar Kerja Lapangan',
    spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL & Hardware Standar',
    catatanPasang: 'Periksa posisi dinding & pasang modul sesuai persetujuan gambar kerja.',
  };
}

export function computeProjectProductsTotal(
  items?: readonly Pick<ProjectProductItem, 'jumlah' | 'hargaSatuan' | 'tambahan'>[]
): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + computeProjectProductSubtotal(item), 0);
}

export function computeEffectiveUnitPriceWithTambahan(
  item: Pick<ProjectProductItem, 'jumlah' | 'hargaSatuan' | 'tambahan'>
): number {
  const qty = Math.max(1, Math.round(item.jumlah || 1));
  const subtotal = computeProjectProductSubtotal(item);
  return Math.max(0, Math.round(subtotal / qty));
}

export const DEFAULT_PROJECT_PRODUCT_UNIT = 'Unit';

export function createEmptyProjectProductItem(_index: number = 1): ProjectProductItem {
  void _index;
  return {
    id: '',
    namaProduk: '',
    dimensi: '',
    customisasi: '',
    material: '',
    finishing: '',
    kodeWarna: '',
    tambahan: [],
    spesifikasiMaterial: '',
    spesifikasiManual: false,
    jumlah: 1,
    hargaSatuan: 0,
    hargaManual: false,
  };
}

export function computeWarrantyEndDateIso(
  bastDateIso?: string,
  warrantyMonths: number = 6
): string {
  const raw = String(bastDateIso ?? '').trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }
  const safeMonths = Math.max(0, Math.round(Number(warrantyMonths) || 0));
  const totalMonthIndex = year * 12 + (month - 1) + safeMonths;
  const targetYear = Math.floor(totalMonthIndex / 12);
  const targetMonthIndex = ((totalMonthIndex % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDay);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function computeQuotationValidUntilIso(tanggalMulai?: string): string {
  const startDate = tanggalMulai?.trim() || new Date().toISOString().slice(0, 10);
  return addDaysIso(startDate, -1);
}

export function buildDefaultProjectDocumentDates(
  tanggalMulai: string,
  tanggalTargetSelesai: string
): Required<ProjectDocumentDates> {
  const startDate = tanggalMulai?.trim() || new Date().toISOString().slice(0, 10);
  const targetDate = tanggalTargetSelesai?.trim() || addDaysIso(startDate, 21);
  return {
    tanggalPenawaran: startDate,
    berlakuHingga: computeQuotationValidUntilIso(startDate),
    tanggalSpk: startDate,
    tanggalKirim: addDaysIso(targetDate, -2),
    tanggalBast: targetDate,
    tanggalJatuhTempo: targetDate,
    tanggalTermin1: startDate,
    tanggalTermin2: interpolateIso(startDate, targetDate, 0.45),
    tanggalTermin3: interpolateIso(startDate, targetDate, 0.8),
    tanggalTermin4: targetDate,
  };
}

export function resolveProjectDocumentDates(
  project: Pick<WorkshopProject, 'tanggalMulai' | 'tanggalTargetSelesai' | 'tanggalDokumen'>
): Required<ProjectDocumentDates> {
  const defaults = buildDefaultProjectDocumentDates(
    project.tanggalMulai,
    project.tanggalTargetSelesai
  );
  const d = project.tanggalDokumen;
  if (!d) return defaults;

  return {
    tanggalPenawaran: d.tanggalPenawaran?.trim() || defaults.tanggalPenawaran,
    berlakuHingga: d.berlakuHingga?.trim() || defaults.berlakuHingga,
    tanggalSpk: d.tanggalSpk?.trim() || defaults.tanggalSpk,
    tanggalKirim: d.tanggalKirim?.trim() || defaults.tanggalKirim,
    tanggalBast: d.tanggalBast?.trim() || defaults.tanggalBast,
    tanggalJatuhTempo: d.tanggalJatuhTempo?.trim() || defaults.tanggalJatuhTempo,
    tanggalTermin1: d.tanggalTermin1?.trim() || defaults.tanggalTermin1,
    tanggalTermin2: d.tanggalTermin2?.trim() || defaults.tanggalTermin2,
    tanggalTermin3: d.tanggalTermin3?.trim() || defaults.tanggalTermin3,
    tanggalTermin4: d.tanggalTermin4?.trim() || defaults.tanggalTermin4,
  };
}

export type ResolvedProjectProductItem = Omit<ProjectProductItem, 'satuan'> & {
  namaProduk: string;
  satuan: string;
};

export function resolveProjectProductItems(
  project: WorkshopProject,
  catalogProducts = DEFAULT_CATALOG_PRODUCTS
): ResolvedProjectProductItem[] {
  const validProducts = (project.daftarProduk ?? [])
    .map((item) => ({
      item,
      resolvedName: resolveProjectProductName(item, catalogProducts),
    }))
    .filter(({ resolvedName }) => resolvedName.length > 0);

  if (validProducts.length > 0) {
    return validProducts.map(({ item, resolvedName }) => {
      const autoSpec = buildProjectProductSpecification(item);
      const spec = item.spesifikasiManual
        ? item.spesifikasiMaterial.trim() || autoSpec
        : item.spesifikasiMaterial.trim() || autoSpec || 'Multipleks 18 MM, Finishing HPL';

      const matchedCatalog = findCatalogProduct(item.id, catalogProducts);
      return {
        ...item,
        id: matchedCatalog?.id ?? item.id?.trim() ?? '',
        namaProduk: resolvedName,
        dimensi: normalizeDimensionString(item.dimensi) || 'Sesuai Gambar Kerja Lapangan',
        spesifikasiMaterial: spec,
        satuan: item.satuan?.trim() || DEFAULT_PROJECT_PRODUCT_UNIT,
        jumlah: Math.max(1, Math.round(item.jumlah || 1)),
        hargaSatuan: Math.max(0, Math.round(item.hargaSatuan || 0)),
      };
    });
  }

  const specs = buildDefaultLineSpecs(project);
  return [
    {
      id: `prd-auto-${project.id}-1`,
      namaProduk: specs.namaItem || project.namaProyek || 'Unit Custom Workshop',
      dimensi: specs.dimensi,
      spesifikasiMaterial: specs.spesifikasiMaterial,
      satuan: DEFAULT_PROJECT_PRODUCT_UNIT,
      jumlah: 1,
      hargaSatuan: Math.max(0, Math.round(project.nilaiKontrak || 0)),
    },
  ];
}

export function buildAgreementProductItemsFromProject(
  project: WorkshopProject
): CooperationAgreementProductItem[] {
  const resolvedItems = resolveProjectProductItems(project);
  return resolvedItems.map((item, idx) => {
    const paidAddons = (item.tambahan ?? [])
      .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
      .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
    const specText =
      paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
        ? `${item.spesifikasiMaterial} [${paidAddons.join(', ')}]`
        : item.spesifikasiMaterial;

    return {
      id: item.id || `auto-spks-item-${project.id}-${idx + 1}`,
      namaProduk: item.namaProduk,
      dimensi: item.dimensi,
      customisasi: item.customisasi?.trim() || undefined,
      material: item.material?.trim() || undefined,
      finishing: item.finishing?.trim() || undefined,
      kodeWarna: item.kodeWarna?.trim() || undefined,
      tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
      spesifikasiMaterial: specText,
      satuan: item.satuan,
      jumlah: Math.max(1, Math.round(item.jumlah || 1)),
      hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      subtotal: computeProjectProductSubtotal(item),
    };
  });
}

export function resolveProjectTechnicalDetails(
  project: Partial<
    Pick<
      WorkshopProject,
      'detailTeknis' | 'tanggalDokumen' | 'tanggalMulai' | 'tanggalTargetSelesai'
    >
  >,
  _companyCity?: string
): Required<ProjectTechnicalDetails> {
  void _companyCity;
  const t = project.detailTeknis;
  const masaGaransiBulan =
    typeof t?.masaGaransiBulan === 'number' && Number.isFinite(t.masaGaransiBulan)
      ? Math.max(0, Math.round(t.masaGaransiBulan))
      : 6;
  const startDate = project.tanggalMulai?.trim() || new Date().toISOString().slice(0, 10);
  const completionDate = project.tanggalTargetSelesai?.trim() || addDaysIso(startDate, 21);
  const autoWarrantyEndDate = computeWarrantyEndDateIso(completionDate, masaGaransiBulan);

  return {
    penanggungJawabPengirimanInstalasi: t?.penanggungJawabPengirimanInstalasi?.trim() || '',
    masaGaransiBulan,
    tanggalGaransiBerakhir: autoWarrantyEndDate,
  };
}

/**
 * Generates or synchronizes the complete set of project documents (Quotation, SPKS, Delivery Order, BAST,
 * and Master Invoice backing Termin 1-4) deterministically from a WorkshopProject.
 *
 * When existing documents are passed in, their IDs, document numbers, workflow statuses,
 * and invoice payment history are preserved while product items, totals, client data,
 * technical teams, and document dates are updated from the project.
 */
export function buildAutoProjectDocuments(
  project: WorkshopProject,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  existingDocs?: ProjectInvoice | ExistingProjectDocumentRefs
): AutoProjectDocumentBundle {
  const existingRefs: ExistingProjectDocumentRefs =
    existingDocs && 'nomorInvoice' in existingDocs
      ? { invoice: existingDocs }
      : (existingDocs ?? {});

  const clientDigits = resolveProjectClientDigits(project);
  const issueDate = resolveProjectIssueDate(project);
  const startDate = project.tanggalMulai?.trim() || new Date().toISOString().slice(0, 10);
  const targetDate = project.tanggalTargetSelesai?.trim() || addDaysIso(startDate, 21);
  const docDates = resolveProjectDocumentDates(project);
  const durationDays = estimateWorkDays(startDate, targetDate);
  const ownerName = businessConfig.drafPemilik.namaPemilik || 'Pimpinan Workshop';
  const ownerRole = businessConfig.drafPemilik.jabatanPemilik || 'Owner & Penanggung Jawab';
  const companyCity =
    businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta';
  const projectLocation = formatFullWilayahAddress(project.alamat, companyCity) || companyCity;
  const specs = buildDefaultLineSpecs(project);
  const resolvedItems = resolveProjectProductItems(project);
  const productsTotal = computeProjectProductsTotal(resolvedItems);
  const contractTotal =
    project.daftarProduk && project.daftarProduk.length > 0 && productsTotal > 0
      ? productsTotal
      : Math.max(0, Math.round(project.nilaiKontrak || productsTotal || 0));
  const tech = resolveProjectTechnicalDetails(project, companyCity);

  const nomorPenawaran =
    existingRefs.quotation?.nomorPenawaran ||
    formatWorkshopDocumentNumber('QUO', { clientCodeOrSeq: clientDigits, date: issueDate });
  const nomorKontrak =
    existingRefs.agreement?.nomorKontrak ||
    formatWorkshopDocumentNumber('SPK', { clientCodeOrSeq: clientDigits, date: issueDate });
  const nomorSuratJalan =
    existingRefs.deliveryOrder?.nomorSuratJalan ||
    formatWorkshopDocumentNumber('SJI', { clientCodeOrSeq: clientDigits, date: issueDate });
  const nomorBast =
    existingRefs.handoverCertificate?.nomorBast ||
    formatWorkshopDocumentNumber('BST', { clientCodeOrSeq: clientDigits, date: issueDate });
  const nomorInvoice =
    existingRefs.invoice?.nomorInvoice ||
    formatWorkshopDocumentNumber('INV', { clientCodeOrSeq: clientDigits, date: issueDate });

  const defaultQuotationStatus: QuotationDocument['status'] =
    project.status === 'Perencanaan' ? 'Dikirim ke Klien' : 'Disetujui Klien';

  const defaultAgreementStatus: CooperationAgreementDocument['status'] =
    project.status === 'Selesai'
      ? 'Selesai'
      : project.status === 'Instalasi' || project.status === 'Produksi'
        ? 'Aktif Berjalan'
        : 'Ditinjau Klien';

  const defaultDeliveryStatus: DeliveryOrderDocument['status'] =
    project.status === 'Selesai'
      ? 'Diterima & Diarsipkan'
      : project.status === 'Instalasi'
        ? 'Dalam Pengiriman'
        : 'Draf';

  const defaultBastStatus: HandoverCertificateDocument['status'] =
    project.status === 'Selesai'
      ? 'Selesai & Garansi Aktif'
      : project.status === 'Instalasi'
        ? 'Menunggu Tanda Tangan'
        : 'Draf';

  const bastStatus = existingRefs.handoverCertificate?.status ?? defaultBastStatus;
  const bastProgress =
    project.status === 'Selesai' || bastStatus === 'Selesai & Garansi Aktif'
      ? 100
      : project.status === 'Instalasi'
        ? Math.max(85, existingRefs.handoverCertificate?.persentaseSelesai ?? 85)
        : (existingRefs.handoverCertificate?.persentaseSelesai ?? 0);

  const effectiveSchemeStages =
    existingRefs.invoice?.skemaPembayaran?.length
      ? structuredClone(existingRefs.invoice.skemaPembayaran)
      : clonePaymentSchemeStages(paymentScheme);

  const quotationValidUntil =
    docDates.berlakuHingga || computeQuotationValidUntilIso(startDate);

  const quotation: QuotationDocument = {
    id: existingRefs.quotation?.id || `auto-pen-${project.id}`,
    projectId: project.id,
    nomorPenawaran,
    tanggalPenawaran: docDates.tanggalPenawaran,
    berlakuHingga: quotationValidUntil,
    status: existingRefs.quotation?.status ?? defaultQuotationStatus,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    teleponKlien: project.teleponKlien,
    alamatLokasi: projectLocation,
    estimasiDurasiHari: durationDays,
    daftarItem: resolvedItems.map((item, idx) => {
      const paidAddons = (item.tambahan ?? [])
        .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
        .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
      const specText =
        paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
          ? `${item.spesifikasiMaterial} [${paidAddons.join(', ')}]`
          : item.spesifikasiMaterial;

      return {
        id: `auto-pen-item-${project.id}-${idx + 1}`,
        namaItem: item.namaProduk,
        dimensi: item.dimensi,
        customisasi: item.customisasi?.trim() || undefined,
        material: item.material?.trim() || undefined,
        finishing: item.finishing?.trim() || undefined,
        kodeWarna: item.kodeWarna?.trim() || undefined,
        tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
        spesifikasiMaterial: specText,
        satuan: item.satuan,
        jumlah: item.jumlah,
        hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      };
    }),
    tahapanPembayaran: structuredClone(effectiveSchemeStages),
    catatanPembayaran: paymentScheme.catatan,
    syaratKetentuan:
      existingRefs.quotation?.syaratKetentuan ||
      [
        `1. Ruang Lingkup Pekerjaan: Estimasi harga ini mencakup survei pengukuran ulang lokasi, penyusunan gambar kerja (shop drawing), pengadaan material utama sesuai spesifikasi BOQ di atas, fabrikasi di workshop ${businessConfig.namaMerek}, pengiriman, serta instalasi di ${projectLocation}.`,
        `2. Masa Berlaku & Pengikatan Harga: Surat penawaran ini berlaku hingga ${formatShortDateId(quotationValidUntil)} (H-1 sebelum jadwal mulai pekerjaan). Apabila terdapat perubahan dimensi, jenis material, atau penambahan item di luar rincian di atas, nilai penawaran akan disesuaikan melalui revisi penawaran atau addendum tertulis.`,
        `3. Dasar Pelaksanaan & Pengikatan SPK: Pekerjaan dijadwalkan masuk tahap produksi (${durationDays} hari kerja efektif) setelah penawaran disetujui secara tertulis oleh klien dan Surat Perjanjian Kerja (${nomorKontrak}) beserta pembayaran Termin 1 (Uang Muka / DP) diselesaikan.`,
        `4. Pengecualian Pekerjaan: Pekerjaan sipil, pembobokan dinding, instalasi jalur listrik/stop kontak utama, plumbing/saluran air bersih-kotor, dan pengadaan perangkat elektronik/appliances tidak termasuk dalam penawaran kecuali tercantum eksplisit pada daftar item.`,
        `5. Perubahan Desain (Variation Order): Setiap permintaan perubahan desain, warna HPL/Duco, atau aksesori setelah gambar kerja dikunci wajib dituangkan dalam persetujuan tertulis dan dapat memengaruhi nilai serta jadwal penyelesaian.`,
        `6. Jaminan Mutu & Garansi: Seluruh unit dilindungi garansi konstruksi dan penyetelan hardware selama ${tech.masaGaransiBulan} bulan terhitung sejak penandatanganan Berita Acara Serah Terima (${nomorBast}).`,
      ].join('\n'),
    catatanTambahan:
      sanitizeQuotationTechnicalNote(existingRefs.quotation?.catatanTambahan) ||
      'Spesifikasi kode warna HPL/Duco, penarikan titik listrik/air, dan gambar kerja final dikunci bersama klien sebelum pemotongan bahan di workshop.',
    disusunOleh: ownerName,
  };

  const legacyPercentages = deriveLegacyThreeStagePercentages(effectiveSchemeStages);
  const itemSummary = resolvedItems
    .map((item) => `${item.namaProduk} (${item.jumlah} ${item.satuan})`)
    .join(', ');
  const paymentClauseBody = buildAgreementPaymentClauseText(
    effectiveSchemeStages,
    paymentScheme.catatan
  );
  const projectRefLabel = project.id || project.namaProyek;

  const lampiranAcuan =
    existingRefs.agreement?.lampiranAcuan ||
    `Surat Penawaran (${nomorPenawaran}), Rincian RAB / Bill of Quantities (BOQ), Gambar Kerja Teknis (Shop Drawing Final ${projectRefLabel}), dan Spesifikasi Material & Finishing.`;

  const clientEntityType = normalizeClientEntityType(project.jenisKlien, project.namaKlien);
  const existingJabatan = existingRefs.agreement?.jabatanPihakKedua?.trim() ?? '';
  const isDefaultIndividualRole = /^(pemberi tugas \/ klien|pemilik \/ pemberi tugas)$/i.test(
    existingJabatan
  );
  const resolvedClientRole =
    clientEntityType === 'pribadi'
      ? existingJabatan || 'Pemberi Tugas / Klien'
      : project.jabatanKlien?.trim() ||
        (existingJabatan && !isDefaultIndividualRole ? existingJabatan : '') ||
        'Penanggung Jawab';
  const resolvedClientPic =
    clientEntityType === 'pribadi'
      ? undefined
      : project.penanggungJawabKlien?.trim() ||
        existingRefs.agreement?.penanggungJawabPihakKedua?.trim() ||
        undefined;

  const agreement: CooperationAgreementDocument = {
    id: existingRefs.agreement?.id || `auto-spks-${project.id}`,
    projectId: project.id,
    nomorKontrak,
    jenisPerjanjian: 'Kontrak Proyek Custom Interior',
    kotaPenandatanganan: companyCity,
    tanggalPenandatanganan: docDates.tanggalSpk || existingRefs.agreement?.tanggalPenandatanganan || startDate,
    status: existingRefs.agreement?.status ?? defaultAgreementStatus,
    perusahaanPihakPertama: businessConfig.namaMerek,
    perwakilanPihakPertama: ownerName,
    jabatanPihakPertama: ownerRole,
    teleponPihakPertama:
      existingRefs.agreement?.teleponPihakPertama?.trim() || businessConfig.whatsapp.nomorTampil,
    alamatPihakPertama: businessConfig.alamat.alamatLengkap,
    jenisPihakKedua: clientEntityType,
    namaPerusahaanPihakKedua: clientEntityType === 'pribadi' ? undefined : project.namaKlien,
    penanggungJawabPihakKedua: resolvedClientPic,
    namaPihakKedua: project.namaKlien,
    nomorIdentitasPihakKedua: existingRefs.agreement?.nomorIdentitasPihakKedua ?? '',
    jabatanPihakKedua: resolvedClientRole,
    teleponPihakKedua: project.teleponKlien,
    alamatPihakKedua: projectLocation,
    judulProyek: project.namaProyek,
    lokasiProyek: projectLocation,
    nilaiKontrak: contractTotal,
    persenDp: legacyPercentages.persenDp,
    persenProgres: legacyPercentages.persenProgres,
    persenPelunasan: legacyPercentages.persenPelunasan,
    tahapanPembayaran: structuredClone(effectiveSchemeStages),
    catatanPembayaran: paymentScheme.catatan,
    durasiKerjaHari: durationDays,
    tanggalMulaiKerja: existingRefs.agreement?.tanggalMulaiKerja || startDate,
    tanggalSelesaiKerja: existingRefs.agreement?.tanggalSelesaiKerja || targetDate,
    nomorPenawaranReferensi: existingRefs.agreement?.nomorPenawaranReferensi || nomorPenawaran,
    lampiranAcuan,
    masaGaransiBulan: tech.masaGaransiBulan,
    daftarProduk: buildAgreementProductItemsFromProject(project),
    daftarPasal:
      existingRefs.agreement?.daftarPasal && existingRefs.agreement.daftarPasal.length > 0
        ? structuredClone(existingRefs.agreement.daftarPasal)
        : [
            {
              id: `auto-spks-cl-${project.id}-1`,
              judulPasal: 'Pasal 1 — Ruang Lingkup Pekerjaan (Scope of Work)',
              isiPasal: `1. Jenis & Lokasi Pekerjaan: PIHAK PERTAMA berkewajiban melaksanakan survei pengukuran ulang, penyusunan gambar kerja teknis (shop drawing), pengadaan material utama dan hardware, fabrikasi di workshop ${businessConfig.namaMerek}, pengemasan, pengiriman, hingga pemasangan unit untuk pekerjaan "${project.namaProyek}" di ${projectLocation}${itemSummary ? ` yang meliputi: ${itemSummary}` : ''}.\n2. Lampiran Acuan & Batasan: Pelaksanaan mengacu pada Tabel Rincian Detail Produk & Spesifikasi (Bagian II) serta ${lampiranAcuan} Pekerjaan sipil, pembobokan dinding, instalasi jalur listrik/plumbing utama, serta perangkat elektronik di luar BOQ tidak termasuk lingkup SPK ini kecuali disepakati tertulis.`,
            },
            {
              id: `auto-spks-cl-${project.id}-2`,
              judulPasal: 'Pasal 2 — Nilai Kontrak & Sistem Pembayaran (Termin)',
              isiPasal: `1. Nilai Kontrak & Skema Termin: Nilai total kontrak yang disepakati adalah sebesar ${formatRupiahSigned(contractTotal)}. ${paymentClauseBody}\n2. Rekening Tujuan Resmi: Pembayaran resmi hanya dianggap sah apabila ditransfer ke rekening BNI 1905207398 atau BSI 7370860534 a.n. Hilman Aziz Napis dengan mencantumkan referensi ${nomorKontrak}.\n3. Penangguhan Produksi: Keterlambatan pembayaran termin berhak mengakibatkan penangguhan sementara jadwal produksi, pengiriman, atau instalasi hingga kewajiban termin terkait diselesaikan.`,
            },
            {
              id: `auto-spks-cl-${project.id}-3`,
              judulPasal: 'Pasal 3 — Jangka Waktu Pelaksanaan & Pengecualian Keterlambatan',
              isiPasal: `1. Durasi & Jadwal Pelaksanaan: Pekerjaan dilaksanakan selama ${durationDays} (hari) kerja efektif pada rentang ${formatShortDateId(startDate)} s.d. ${formatShortDateId(targetDate)}, terhitung sejak diterimanya pembayaran Termin 1 (Uang Muka / DP) dan persetujuan gambar kerja final.\n2. Pengecualian Keterlambatan: Penyesuaian jadwal tidak dihitung sebagai keterlambatan Kontraktor apabila terjadi akibat: (a) keterlambatan pembayaran termin dari Klien; (b) keterlambatan persetujuan desain/warna/material oleh Klien; (c) area lokasi kerja belum siap atau terhambat pekerjaan sipil/MEP pihak lain; atau (d) Keadaan Kahar (Force Majeure).`,
            },
            {
              id: `auto-spks-cl-${project.id}-4`,
              judulPasal: 'Pasal 4 — Pekerjaan Tambah / Kurang (Addendum / Variation Order)',
              isiPasal:
                '1. Prosedur Perubahan: Setiap permintaan penambahan item, pengurangan pekerjaan, perubahan dimensi signifikan, atau penggantian jenis material/finishing setelah gambar kerja dikunci wajib disepakati secara tertulis melalui Addendum Kontrak atau Variation Order (VO).\n2. Penyesuaian Biaya & Waktu: Setiap perubahan lingkup kerja secara otomatis mengatur penyesuaian nilai kontrak serta perpanjangan atau penyesuaian jangka waktu penyelesaian secara proporsional sebelum pekerjaan perubahan diproduksi.',
            },
            {
              id: `auto-spks-cl-${project.id}-5`,
              judulPasal: 'Pasal 5 — Hak dan Kewajiban Para Pihak',
              isiPasal: `1. Kewajiban & Hak Klien (PIHAK KEDUA): Klien berkewajiban melunasi pembayaran termin tepat waktu, menyediakan akses lokasi kerja, daya listrik dan air kerja memadai selama instalasi, serta memberi persetujuan desain tepat waktu. Klien berhak memperoleh hasil pekerjaan sesuai spesifikasi BOQ dan standar mutu kontrak.\n2. Kewajiban & Hak Kontraktor (PIHAK PERTAMA): Kontraktor berkewajiban menjaga mutu material, presisi ukuran, keselamatan kerja (K3), standar mutu penyelesaian ${businessConfig.namaMerek}, dan kerapihan instalasi. Kontraktor berhak menerima pembayaran termin tepat waktu dan perpanjangan waktu atas hambatan di luar kendali Kontraktor.`,
            },
            {
              id: `auto-spks-cl-${project.id}-6`,
              judulPasal: 'Pasal 6 — Masa Pemeliharaan & Garansi (Retensi)',
              isiPasal: `1. Durasi Garansi & Retensi: PIHAK PERTAMA memberikan Masa Pemeliharaan & Garansi selama ${tech.masaGaransiBulan} bulan terhitung sejak penandatanganan BAST (${nomorBast}), dengan pencairan retensi pelunasan Termin 4 diselesaikan bersamaan dengan verifikasi serah terima.\n2. Cakupan & Pengecualian: Garansi mencakup konstruksi, sambungan, penyetelan engsel slow-motion, dan rel laci. Garansi tidak mencakup kerusakan akibat kesalahan pemakaian, beban berlebih, modifikasi pihak lain, kebocoran bangunan, kelembapan ekstrem, atau bencana alam.`,
            },
            {
              id: `auto-spks-cl-${project.id}-7`,
              judulPasal: 'Pasal 7 — Denda Keterlambatan & Pembatalan Kontrak',
              isiPasal:
                '1. Denda Kontraktor: Keterlambatan penyelesaian pekerjaan oleh Kontraktor di luar pengecualian Pasal 3 dan Force Majeure dikenakan denda 1‰ (0,1%) per hari kalender dari nilai unit tertunda dengan batas maksimum 5% (lima persen) dari nilai kontrak terkait.\n2. Denda Klien: Keterlambatan pembayaran termin melampaui 7 hari kalender memberi hak kepada Kontraktor menangguhkan jadwal produksi/instalasi tanpa penalti; penundaan lebih dari 14 hari kalender dapat dikenakan biaya penyimpanan atau denda 1‰ per hari dari nilai termin tertunggak (maks. 5%).\n3. Klausul Pembatalan (Force Majeure & Sepihak): (a) Keadaan Kahar (bencana alam, kebakaran, huru-hara, pemadaman listrik berkepanjangan, kebijakan pemerintah) membebaskan PARA PIHAK dari wanprestasi dengan pemberitahuan tertulis maksimal 3 hari kerja; (b) Pembatalan sepihak oleh Klien tetap mewajibkan penggantian biaya survei, desain, pembelian material khusus, dan progres produksi berjalan; pembatalan sepihak oleh Kontraktor di luar Force Majeure mewajibkan pengembalian sisa dana termin yang belum terealisasi.',
            },
            {
              id: `auto-spks-cl-${project.id}-8`,
              judulPasal: 'Pasal 8 — Serah Terima Pekerjaan & Penyelesaian Sengketa',
              isiPasal: `1. Prosedur Serah Terima: Setelah unit terpasang di ${projectLocation}, PARA PIHAK melaksanakan inspeksi fisik dan pemeriksaan kesesuaian bersama di lokasi. Temuan minor diselesaikan sebelum penandatanganan Berita Acara Serah Terima (${nomorBast}) sebagai bukti selesai pekerjaan dan dimulainya garansi.\n2. Penyelesaian Perselisihan: Perselisihan diselesaikan terlebih dahulu secara musyawarah untuk mufakat dalam 14 (empat belas) hari kalender, atau melalui Pengadilan Negeri yang berwenang di ${companyCity}.`,
            },
          ],
    saksiPihakPertama: existingRefs.agreement?.saksiPihakPertama ?? '',
    saksiPihakKedua: existingRefs.agreement?.saksiPihakKedua ?? project.namaKlien,
  };

  const deliveryStatus = existingRefs.deliveryOrder?.status ?? defaultDeliveryStatus;

  const deliveryOrder: DeliveryOrderDocument = {
    id: existingRefs.deliveryOrder?.id || `auto-sj-${project.id}`,
    projectId: project.id,
    nomorSuratJalan,
    tanggalKirim: docDates.tanggalKirim,
    status: deliveryStatus,
    nomorSpkReferensi: nomorKontrak,
    nomorInvoiceReferensi: nomorInvoice,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    teleponKlien: project.teleponKlien,
    alamatTujuan: projectLocation,
    penanggungJawabPengirimanInstalasi:
      tech.penanggungJawabPengirimanInstalasi ||
      existingRefs.deliveryOrder?.penanggungJawabPengirimanInstalasi ||
      '',
    daftarItem: resolvedItems.map((item, idx) => ({
      id: `auto-sj-item-${project.id}-${idx + 1}`,
      namaBarang: item.namaProduk,
      dimensi: item.dimensi,
      customisasi: item.customisasi?.trim() || undefined,
      material: item.material?.trim() || undefined,
      finishing: item.finishing?.trim() || undefined,
      kodeWarna: item.kodeWarna?.trim() || undefined,
      tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
      spesifikasiMaterial: item.spesifikasiMaterial,
      satuan: item.satuan,
      jumlahUnit: item.jumlah,
      hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      subtotal: computeProjectProductSubtotal(item),
      kondisiSaatKeluar:
        project.status === 'Selesai' || deliveryStatus === 'Diterima & Diarsipkan'
          ? 'Tiba Lengkap & Baik'
          : 'Baik & Terkemas Rapi',
      catatanPemasangan: item.spesifikasiMaterial || specs.catatanPasang,
    })),
    instruksiPemasangan: [
      '1. Pemeriksaan Detail Barang Saat Pengiriman (Barang Datang): Seluruh rincian barang, dimensi, spesifikasi, jumlah unit, dan kondisi fisik wajib diperiksa bersama di lokasi untuk memastikan setiap item benar dan telah sampai lengkap sebelum ditandatangani oleh Owner dan Klien.',
      '2. Pencatatan Selisih / Cacat Kirim: Apabila ditemukan ketidaksesuaian spesifikasi, jumlah, atau kerusakan selama pengangkutan, wajib dicatat langsung pada kolom kondisi sebelum penandatanganan penerimaan barang.',
      '3. Tanggung Jawab Mobilisasi & Pemasangan: Risiko pengangkutan hingga proses instalasi selesai menjadi tanggung jawab pelaksana sampai seluruh unit terpasang sesuai pesanan dan gambar kerja.',
      `4. Verifikasi Ulang Setelah Instalasi Selesai (Arsip): Setelah seluruh unit terpasang baik di lokasi, Klien menandatangani kolom verifikasi ulang (tanda tangan ke-3) pada Surat Jalan ${nomorSuratJalan}${nomorKontrak ? ` (Ref. ${nomorKontrak})` : ''} sebelum salinan resmi diarsipkan.`,
    ].join('\n'),
    statusVerifikasiKlien:
      existingRefs.deliveryOrder?.statusVerifikasiKlien ??
      (project.status === 'Selesai' ? 'Diterima Lengkap & Baik' : 'Belum Diverifikasi'),
    namaPenerimaLapangan: '',
    tanggalVerifikasiKlien:
      existingRefs.deliveryOrder?.tanggalVerifikasiKlien ||
      (project.status === 'Selesai' ? docDates.tanggalKirim : ''),
    salinanDiarsipkanAdmin:
      existingRefs.deliveryOrder?.salinanDiarsipkanAdmin ?? project.status === 'Selesai',
    catatanAuditAdmin:
      existingRefs.deliveryOrder?.catatanAuditAdmin ||
      (project.status === 'Selesai'
        ? 'Salinan Surat Jalan dengan verifikasi tanda tangan ulang klien pasca instalasi telah diarsipkan.'
        : 'Menunggu tanda tangan saat pengiriman (Owner & Klien) serta tanda tangan ulang klien setelah instalasi selesai untuk arsip.'),
  };

  const bastDate = docDates.tanggalBast || targetDate;
  const invoiceDueDate = docDates.tanggalJatuhTempo || targetDate;
  const terminDates: string[] = [
    docDates.tanggalTermin1 || docDates.tanggalPenawaran,
    docDates.tanggalTermin2 || docDates.tanggalSpk,
    docDates.tanggalTermin3 || docDates.tanggalKirim,
    docDates.tanggalTermin4 || invoiceDueDate,
  ];

  const handoverCertificate: HandoverCertificateDocument = {
    id: existingRefs.handoverCertificate?.id || `auto-bast-${project.id}`,
    projectId: project.id,
    nomorBast,
    jenisSerahTerima:
      project.status === 'Selesai'
        ? 'Serah Terima Pekerjaan Selesai (100%)'
        : 'Serah Terima Parsial / Bertahap',
    status: bastStatus,
    kotaSerahTerima: companyCity,
    tanggalSerahTerima: bastDate,
    nomorPenawaranReferensi: nomorPenawaran,
    nomorSpkReferensi: '',
    nomorSuratJalanReferensi: nomorSuratJalan,
    nomorSpksReferensi: nomorKontrak,
    nomorInvoiceReferensi: nomorInvoice,
    nilaiKontrakReferensi: contractTotal,
    tahapanPembayaran: structuredClone(effectiveSchemeStages),
    tanggalTermin: terminDates,
    catatanPembayaran:
      'Berita Acara Serah Terima diterbitkan setelah penerimaan pembayaran Termin 4 dan verifikasi kelunasan seluruh nilai kontrak.',
    riwayatPembayaran: existingRefs.invoice?.riwayatPembayaran
      ? structuredClone(existingRefs.invoice.riwayatPembayaran)
      : existingRefs.handoverCertificate?.riwayatPembayaran
        ? structuredClone(existingRefs.handoverCertificate.riwayatPembayaran)
        : [],
    perusahaanPihakPertama: businessConfig.namaMerek,
    perwakilanPihakPertama: ownerName,
    jabatanPihakPertama: ownerRole,
    alamatPihakPertama: businessConfig.alamat.alamatLengkap,
    namaPihakKedua: project.namaKlien,
    jabatanPihakKedua: 'Pemilik / Pemberi Tugas',
    teleponPihakKedua: project.teleponKlien,
    alamatPihakKedua: projectLocation,
    namaProyek: project.namaProyek,
    lokasiPemasangan: projectLocation,
    persentaseSelesai: bastProgress,
    masaGaransiBulan: tech.masaGaransiBulan,
    tanggalMulaiGaransi: bastDate,
    daftarItem: resolvedItems.map((item, idx) => ({
      id: `auto-bast-item-${project.id}-${idx + 1}`,
      namaUnit: item.namaProduk,
      dimensi: item.dimensi,
      customisasi: item.customisasi?.trim() || undefined,
      material: item.material?.trim() || undefined,
      finishing: item.finishing?.trim() || undefined,
      kodeWarna: item.kodeWarna?.trim() || undefined,
      tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
      spesifikasiMaterial: item.spesifikasiMaterial,
      satuan: item.satuan,
      jumlah: item.jumlah,
      hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      subtotal: computeProjectProductSubtotal(item),
      kondisi: 'Baik & Sesuai',
      catatan: item.spesifikasiMaterial || '',
    })),
    teksPernyataan:
      existingRefs.handoverCertificate?.teksPernyataan ||
      [
        `1. Pernyataan Pemeriksaan & Penerimaan: Pada hari ini tanggal ${formatShortDateId(bastDate)}, PIHAK PERTAMA dan PIHAK KEDUA telah melaksanakan pemeriksaan fisik serta verifikasi kesesuaian bersama di ${projectLocation} atas pekerjaan "${project.namaProyek}" (Ref. ${nomorKontrak} / ${nomorSuratJalan}). Seluruh unit dalam daftar terlampir dinyatakan telah selesai (${bastProgress}%), terpasang dengan baik, dan diterima oleh PIHAK KEDUA.`,
        `2. Peralihan Tanggung Jawab & Hak Guna: Terhitung sejak ditandatanganinya Berita Acara Serah Terima ini, risiko pemanfaatan serta pengelolaan harian unit pekerjaan resmi beralih dari PIHAK PERTAMA kepada PIHAK KEDUA.`,
        `3. Masa Garansi Pemeliharaan: PIHAK PERTAMA memberikan Masa Garansi Pemeliharaan selama ${tech.masaGaransiBulan} bulan terhitung mulai ${formatShortDateId(bastDate)} yang mencakup penyetelan engsel/rel dan perbaikan cacat pengerjaan, tidak termasuk kerusakan akibat kesalahan pemakaian, beban berlebih, kebocoran bangunan, atau keadaan kahar.`,
        `4. Penyelesaian Proyek & Record Pembayaran: Berita Acara Serah Terima (${nomorBast}) ini merupakan dokumen final penyelesaian proyek yang diterbitkan setelah penerimaan pembayaran Termin 4 sesuai catatan pelunasan pada Invoice ${nomorInvoice}.`,
      ].join('\n'),
    catatanTindakLanjut:
      project.status === 'Selesai'
        ? `Nihil — seluruh unit terpasang baik sesuai kontrak dan garansi pemeliharaan ${tech.masaGaransiBulan} bulan aktif sejak ${formatShortDateId(bastDate)}.`
        : 'Seluruh pekerjaan dirangkum untuk pemeriksaan akhir dan penandatanganan bersama klien.',
    saksiPihakPertama: existingRefs.handoverCertificate?.saksiPihakPertama ?? '',
    saksiPihakKedua: project.namaKlien,
  };

  const invoiceLineItems: InvoiceLineItem[] = resolvedItems.map((item, idx) => {
    const formattedDim = formatDocumentDimensionDisplay(item.dimensi);
    const paidAddons = (item.tambahan ?? [])
      .filter((addon) => Math.round(Number(addon.biaya) || 0) > 0)
      .map((addon) => `${addon.jenis} (+${formatRupiahSigned(addon.biaya)})`);
    const specText =
      paidAddons.length > 0 && computeProjectProductTambahanTotal(item) > 0
        ? `${item.spesifikasiMaterial} [${paidAddons.join(', ')}]`
        : item.spesifikasiMaterial;

    return {
      id: `auto-inv-li-${project.id}-${idx + 1}`,
      namaProduk: item.namaProduk,
      dimensi: item.dimensi,
      customisasi: item.customisasi?.trim() || undefined,
      material: item.material?.trim() || undefined,
      finishing: item.finishing?.trim() || undefined,
      kodeWarna: item.kodeWarna?.trim() || undefined,
      tambahan: item.tambahan ? structuredClone(item.tambahan) : undefined,
      spesifikasiMaterial: specText,
      satuan: item.satuan,
      deskripsi: formattedDim
        ? `${item.namaProduk} (${formattedDim}) — ${specText}`
        : `${item.namaProduk} — ${specText}`,
      jumlah: item.jumlah,
      hargaSatuan: computeEffectiveUnitPriceWithTambahan(item),
      subtotal: computeProjectProductSubtotal(item),
    };
  });

  const baseInvoiceDraft: ProjectInvoice = {
    id: existingRefs.invoice?.id || `auto-inv-${project.id}`,
    projectId: project.id,
    nomorInvoice,
    namaProyek: project.namaProyek,
    namaKlien: project.namaKlien,
    lokasi: projectLocation,
    nilaiTotalKontrak: contractTotal,
    tanggalJatuhTempo: invoiceDueDate,
    status: existingRefs.invoice?.status ?? 'Menunggu DP',
    nomorSpkReferensi: nomorKontrak,
    nomorBastReferensi: nomorBast,
    skemaPembayaran: effectiveSchemeStages,
    tanggalTermin: terminDates,
    riwayatPembayaran: existingRefs.invoice?.riwayatPembayaran
      ? structuredClone(existingRefs.invoice.riwayatPembayaran)
      : [],
    rincianItem: invoiceLineItems,
    persenPajak: existingRefs.invoice?.persenPajak,
    nominalDiskon: existingRefs.invoice?.nominalDiskon,
    catatanRekening: existingRefs.invoice?.catatanRekening,
    catatan: existingRefs.invoice?.catatan?.trim() || '',
  };

  const invoiceProgress = computeInvoiceProgress(baseInvoiceDraft);
  const invoice: ProjectInvoice = {
    ...baseInvoiceDraft,
    status: invoiceProgress.computedStatus,
  };

  return {
    quotation,
    agreement,
    deliveryOrder,
    handoverCertificate,
    invoice,
  };
}

export function buildSeededAutoDocumentsForProjects(
  projects: readonly WorkshopProject[],
  invoices: readonly ProjectInvoice[],
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): {
  quotations: QuotationDocument[];
  agreements: CooperationAgreementDocument[];
  deliveryOrders: DeliveryOrderDocument[];
  handoverCertificates: HandoverCertificateDocument[];
  invoices: ProjectInvoice[];
} {
  const quotations: QuotationDocument[] = [];
  const agreements: CooperationAgreementDocument[] = [];
  const deliveryOrders: DeliveryOrderDocument[] = [];
  const handoverCertificates: HandoverCertificateDocument[] = [];
  const nextInvoices: ProjectInvoice[] = [];
  const handledInvoiceIds = new Set<string>();

  for (const project of projects) {
    const existingInv = invoices.find((inv) => inv.projectId === project.id);
    if (existingInv) {
      handledInvoiceIds.add(existingInv.id);
    }
    const bundle = buildAutoProjectDocuments(
      project,
      businessConfig,
      paymentScheme,
      existingInv ? { invoice: existingInv } : undefined
    );

    quotations.push(bundle.quotation);
    agreements.push(bundle.agreement);
    deliveryOrders.push(bundle.deliveryOrder);
    handoverCertificates.push(bundle.handoverCertificate);
    nextInvoices.push(bundle.invoice);
  }

  for (const inv of invoices) {
    if (!handledInvoiceIds.has(inv.id)) {
      nextInvoices.push(inv);
    }
  }

  return {
    quotations,
    agreements,
    deliveryOrders,
    handoverCertificates,
    invoices: nextInvoices,
  };
}

export function buildDocumentSendText(
  kind: 'penawaran' | 'spks' | 'spk' | 'surat-jalan' | 'bast' | 'invoice' | 'termin',
  params: {
    project: WorkshopProject;
    businessConfig: BusinessConfig;
    docNumber: string;
    detailLine?: string;
  }
): string {
  const { project, businessConfig, docNumber, detailLine } = params;
  const brand = businessConfig.namaMerek;
  const labels: Record<typeof kind, string> = {
    penawaran: 'Surat Penawaran (Quotation)',
    spks: 'Surat Perjanjian Kerja (SPK)',
    spk: 'Surat Perintah Kerja (SPK)',
    'surat-jalan': 'Surat Jalan Pengiriman & Instalasi',
    bast: 'Berita Acara Serah Terima (BAST)',
    invoice: 'Rekap Invoice Proyek',
    termin: 'Surat Tagihan Termin Pembayaran',
  };

  const closingNote =
    kind === 'spks'
      ? `Surat Perjanjian Kerja (SPK) ini ditujukan kepada ${project.namaKlien} untuk ditinjau dan ditandatangani. Setelah SPK ditandatangani, pekerjaan dinyatakan telah disetujui dan akan segera kami kerjakan sesuai jadwal serta ketentuan perjanjian. Terima kasih.`
      : kind === 'spk'
        ? `Surat Perintah Kerja (SPK) ini ditujukan kepada ${project.namaKlien} untuk ditinjau dan ditandatangani. Setelah SPK ditandatangani, pekerjaan dinyatakan telah disetujui dan akan segera kami kerjakan sesuai jadwal serta ketentuan terlampir. Terima kasih.`
        : 'Dokumen PDF resmi terlampir. Silakan hubungi kami apabila ada yang perlu dikonfirmasi. Terima kasih.';

  const lines = [
    `Halo ${project.namaKlien},`,
    `Berikut kami sampaikan dokumen *${labels[kind]}* dari *${brand}*:`,
    '',
    `• Nomor Dokumen : ${docNumber}`,
    `• Proyek        : ${project.namaProyek}`,
    formatFullWilayahAddress(project.alamat)
      ? `• Lokasi        : ${formatFullWilayahAddress(project.alamat)}`
      : '',
    detailLine ? `• Keterangan    : ${detailLine}` : '',
    '',
    closingNote,
  ].filter(Boolean);

  return lines.join('\n');
}

export function buildDocumentWhatsAppHref(
  phoneRaw: string | undefined,
  message: string
): string | null {
  const parsed = parseIndonesianPhoneInput(phoneRaw ?? '');
  if (!parsed.digits || parsed.digits.length < 9) return null;
  return `https://wa.me/${parsed.digits}?text=${encodeURIComponent(message)}`;
}

export function formatTerminSummaryLine(
  invoice: ProjectInvoice,
  stageIndex: number,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): string {
  const effectiveScheme = resolveEffectivePaymentScheme(invoice.skemaPembayaran, paymentScheme);
  const schedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveScheme
  );
  const stage = schedule.stages[stageIndex];
  if (!stage) return `Total kontrak ${formatRupiahSigned(invoice.nilaiTotalKontrak)}`;
  const dueDate = invoice.tanggalTermin?.[stageIndex] || invoice.tanggalJatuhTempo;
  return `${stage.nama} (${stage.persentase}%) · Nominal ${formatRupiahSigned(
    stage.remainingAmount > 0 ? stage.remainingAmount : stage.targetAmount
  )} · Jatuh tempo ${formatShortDateId(dueDate)}`;
}

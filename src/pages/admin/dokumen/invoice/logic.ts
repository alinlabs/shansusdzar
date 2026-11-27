import { formatWorkshopDocumentNumber } from '../../../../lib/document-numbering';
import { computeInvoiceProgress } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  clonePaymentSchemeStages,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  FinancePaymentMethod,
  InvoiceLineItem,
  ProjectInvoice,
} from '../../../../types/finance';

export interface InvoiceValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export interface InvoicePaymentFormValues {
  date: string;
  label: string;
  amount: number;
  paymentMethod: FinancePaymentMethod;
  notes: string;
  alsoRecordCashTransaction: boolean;
}

export function createEmptyInvoiceLineItem(): InvoiceLineItem {
  return {
    id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deskripsi: '',
    jumlah: 1,
    hargaSatuan: 0,
  };
}

export function createEmptyInvoice(
  nextSeq: number,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): ProjectInvoice {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    id: `inv-${Date.now()}`,
    nomorInvoice: formatWorkshopDocumentNumber('INV', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? nextSeq,
      date: options?.date ?? today,
    }),
    namaProyek: '',
    namaKlien: '',
    lokasi: '',
    nilaiTotalKontrak: 0,
    tanggalJatuhTempo: due,
    status: 'Menunggu DP',
    nomorSpkReferensi: '',
    nomorBastReferensi: '',
    skemaPembayaran: clonePaymentSchemeStages(paymentScheme),
    riwayatPembayaran: [],
    rincianItem: [],
    catatanRekening: '',
    catatan: '',
  };
}

export function createDefaultPaymentForm(
  invoice: ProjectInvoice,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  stageIndex?: number
): InvoicePaymentFormValues {
  const progress = computeInvoiceProgress(invoice);
  const effectiveScheme = resolveEffectivePaymentScheme(
    invoice.skemaPembayaran,
    paymentScheme
  );
  const schedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveScheme
  );

  const requestedStage =
    typeof stageIndex === 'number' &&
    Number.isInteger(stageIndex) &&
    stageIndex >= 0 &&
    stageIndex < schedule.stages.length
      ? schedule.stages[stageIndex]
      : null;

  const targetStage =
    requestedStage && requestedStage.remainingAmount > 0 ? requestedStage : schedule.nextStage;

  const defaultLabel = targetStage
    ? `${targetStage.nama} ${targetStage.persentase}%`
    : progress.remainingAmount > 0
      ? 'Pelunasan Sisa Termin'
      : 'Pembayaran Tambahan';

  const suggestedAmount =
    targetStage && targetStage.remainingAmount > 0
      ? targetStage.remainingAmount
      : progress.remainingAmount > 0
        ? progress.remainingAmount
        : 0;

  return {
    date: new Date().toISOString().slice(0, 10),
    label: defaultLabel,
    amount: suggestedAmount,
    paymentMethod: 'Transfer Bank',
    notes: targetStage?.keterangan ?? '',
    alsoRecordCashTransaction: true,
  };
}

export function filterInvoices(
  invoices: readonly ProjectInvoice[],
  searchQuery: string
): ProjectInvoice[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [...invoices];
  return invoices.filter((inv) => {
    const hay = `${inv.nomorInvoice} ${inv.namaProyek} ${inv.namaKlien} ${inv.lokasi} ${inv.nomorSpkReferensi ?? ''} ${inv.nomorBastReferensi ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export function validateInvoiceDraft(draft: ProjectInvoice): InvoiceValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorInvoice.trim()) {
    fieldErrors.nomorInvoice = 'Nomor invoice wajib diisi.';
  }
  if (!draft.tanggalJatuhTempo.trim()) {
    fieldErrors.tanggalJatuhTempo = 'Target jatuh tempo wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.namaKlien.trim()) {
    fieldErrors.namaKlien = 'Nama klien wajib diisi.';
  }
  if (!Number.isFinite(draft.nilaiTotalKontrak) || draft.nilaiTotalKontrak <= 0) {
    fieldErrors.nilaiTotalKontrak = 'Nilai kontrak harus lebih besar dari Rp 0.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Nomor invoice, jatuh tempo, nama proyek, nama klien, dan nilai kontrak wajib diisi.'
      : null,
    fieldErrors,
  };
}

export function normalizeInvoicePayload(draft: ProjectInvoice): ProjectInvoice {
  const cleanedLineItems = (draft.rincianItem ?? [])
    .filter((li) => li.deskripsi.trim().length > 0)
    .map((li) => ({
      ...li,
      deskripsi: li.deskripsi.trim(),
      jumlah: Math.max(1, Math.round(li.jumlah || 1)),
      hargaSatuan: Math.max(0, Math.round(li.hargaSatuan || 0)),
    }));

  const cleanStages =
    Array.isArray(draft.skemaPembayaran) && draft.skemaPembayaran.length > 0
      ? draft.skemaPembayaran.map((st, idx) => ({
          ...st,
          urutan: idx + 1,
          nama: st.nama.trim(),
          keterangan: st.keterangan.trim(),
        }))
      : undefined;

  return {
    ...draft,
    nomorInvoice: draft.nomorInvoice.trim(),
    namaProyek: draft.namaProyek.trim(),
    namaKlien: draft.namaKlien.trim(),
    lokasi: draft.lokasi.trim(),
    nilaiTotalKontrak: Math.max(0, Math.round(draft.nilaiTotalKontrak)),
    nomorSpkReferensi: draft.nomorSpkReferensi?.trim() || '',
    nomorBastReferensi: draft.nomorBastReferensi?.trim() || '',
    skemaPembayaran: cleanStages,
    catatan: draft.catatan.trim(),
    catatanRekening: draft.catatanRekening?.trim() ?? '',
    rincianItem: cleanedLineItems,
  };
}

export function validatePaymentForm(values: InvoicePaymentFormValues): InvoiceValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!values.label.trim()) {
    fieldErrors.label = 'Tahap pembayaran wajib diisi.';
  }
  if (!values.date.trim()) {
    fieldErrors.date = 'Tanggal diterima wajib diisi.';
  }
  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    fieldErrors.amount = 'Nominal pembayaran harus lebih dari Rp 0.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi tahap pembayaran, tanggal diterima, dan nominal yang valid.'
      : null,
    fieldErrors,
  };
}

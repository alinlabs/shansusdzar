import documentLookupsData from '../../../../data/referensi-dokumen.json';
import {
  DEFAULT_PAYMENT_SCHEME,
  buildAgreementPaymentClauseText,
  clonePaymentSchemeStages,
  deriveLegacyThreeStagePercentages,
} from '../../../../lib/payment-scheme';
import type { BusinessConfig } from '../../../../types/business';
import type { PaymentSchemeConfig } from '../../../../types/cms';
import type {
  CooperationClause,
  CooperationAgreementDocument,
  CooperationAgreementStatus,
  CooperationAgreementType,
} from '../../../../types/documents';

export const AGREEMENT_TYPES: CooperationAgreementType[] =
  documentLookupsData.jenisSpks as CooperationAgreementType[];

export const AGREEMENT_STATUSES: CooperationAgreementStatus[] =
  documentLookupsData.statusSpks as CooperationAgreementStatus[];

export interface AgreementValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyAgreementClause(nextIndex: number): CooperationClause {
  return {
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    judulPasal: `Pasal ${nextIndex} — Ketentuan Tambahan`,
    isiPasal: '',
  };
}

export function createEmptyAgreement(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): CooperationAgreementDocument {
  const year = new Date().getFullYear();
  const stages = clonePaymentSchemeStages(paymentScheme);
  const legacy = deriveLegacyThreeStagePercentages(stages);

  return {
    id: `spks-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorKontrak: `SPKS-SDI-${year}-${String(seq).padStart(3, '0')}`,
    jenisPerjanjian: 'Kontrak Proyek Custom Interior',
    kotaPenandatanganan: 'Purwakarta',
    tanggalPenandatanganan: new Date().toISOString().slice(0, 10),
    status: 'Draf',
    perusahaanPihakPertama: businessConfig.namaMerek,
    perwakilanPihakPertama: businessConfig.drafPemilik.namaPemilik,
    jabatanPihakPertama: businessConfig.drafPemilik.jabatanPemilik,
    alamatPihakPertama: businessConfig.alamat.alamatLengkap,
    namaPihakKedua: '',
    nomorIdentitasPihakKedua: '',
    jabatanPihakKedua: 'Pemberi Tugas / Klien',
    teleponPihakKedua: '',
    alamatPihakKedua: '',
    judulProyek: '',
    lokasiProyek: '',
    nilaiKontrak: 15000000,
    persenDp: legacy.persenDp,
    persenProgres: legacy.persenProgres,
    persenPelunasan: legacy.persenPelunasan,
    tahapanPembayaran: stages,
    catatanPembayaran: paymentScheme.catatan,
    durasiKerjaHari: 21,
    masaGaransiBulan: 6,
    daftarPasal: [
      {
        id: `cl-${Date.now()}-1`,
        judulPasal: 'Pasal 1 — Ruang Lingkup Pekerjaan',
        isiPasal:
          'PIHAK PERTAMA melaksanakan pembuatan, pengiriman, dan pemasangan unit furniture/interior sesuai gambar kerja dan spesifikasi material yang disepakati bersama.',
      },
      {
        id: `cl-${Date.now()}-2`,
        judulPasal: 'Pasal 2 — Nilai Kontrak & Tata Cara Pembayaran',
        isiPasal: buildAgreementPaymentClauseText(stages, paymentScheme.catatan),
      },
      {
        id: `cl-${Date.now()}-3`,
        judulPasal: 'Pasal 3 — Garansi & Pemeliharaan',
        isiPasal:
          'PIHAK PERTAMA memberikan garansi penyetelan engsel/rel dan konstruksi sesuai jangka waktu masa pemeliharaan sejak berita acara serah terima ditandatangani.',
      },
    ],
    saksiPihakPertama: 'Fajar Maulana',
    saksiPihakKedua: '',
  };
}

export function applyPaymentSchemeToAgreement(
  doc: CooperationAgreementDocument,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): CooperationAgreementDocument {
  const stages = clonePaymentSchemeStages(paymentScheme);
  const legacy = deriveLegacyThreeStagePercentages(stages);
  const nextClauseText = buildAgreementPaymentClauseText(stages, paymentScheme.catatan);
  const updatedClauses = doc.daftarPasal.map((clause) => {
    const titleLower = clause.judulPasal.toLowerCase();
    if (titleLower.includes('pembayaran') || titleLower.startsWith('pasal 2')) {
      return {
        ...clause,
        isiPasal: nextClauseText,
      };
    }
    return clause;
  });

  return {
    ...doc,
    tahapanPembayaran: stages,
    catatanPembayaran: paymentScheme.catatan,
    persenDp: legacy.persenDp,
    persenProgres: legacy.persenProgres,
    persenPelunasan: legacy.persenPelunasan,
    daftarPasal: updatedClauses,
  };
}

export function computeTerminTotalPercent(
  doc: Pick<
    CooperationAgreementDocument,
    'persenDp' | 'persenProgres' | 'persenPelunasan' | 'tahapanPembayaran'
  >
): number {
  if (Array.isArray(doc.tahapanPembayaran) && doc.tahapanPembayaran.length > 0) {
    const sum = doc.tahapanPembayaran.reduce((acc, st) => acc + (st.persentase || 0), 0);
    return Math.round(sum * 100) / 100;
  }
  return (doc.persenDp || 0) + (doc.persenProgres || 0) + (doc.persenPelunasan || 0);
}

export function filterAgreements(
  agreements: readonly CooperationAgreementDocument[],
  searchQuery: string,
  statusFilter: 'all' | CooperationAgreementStatus
): CooperationAgreementDocument[] {
  const q = searchQuery.trim().toLowerCase();
  return agreements.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (q) {
      const hay = `${doc.nomorKontrak} ${doc.judulProyek} ${doc.namaPihakKedua} ${doc.jenisPerjanjian}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateAgreementDraft(
  draft: CooperationAgreementDocument
): AgreementValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorKontrak.trim()) {
    fieldErrors.nomorKontrak = 'Nomor kontrak SPKS wajib diisi.';
  }
  if (!draft.tanggalPenandatanganan.trim()) {
    fieldErrors.tanggalPenandatanganan = 'Tanggal kontrak wajib diisi.';
  }
  if (!draft.namaPihakKedua.trim()) {
    fieldErrors.namaPihakKedua = 'Nama lengkap pihak kedua / klien wajib diisi.';
  }
  if (!draft.judulProyek.trim()) {
    fieldErrors.judulProyek = 'Judul objek kerja sama / proyek wajib diisi.';
  }
  if (!Number.isFinite(draft.nilaiKontrak) || draft.nilaiKontrak < 0) {
    fieldErrors.nilaiKontrak = 'Nilai kontrak tidak valid.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor kontrak, tanggal, nama pihak kedua, dan judul objek kerja sama.'
      : null,
    fieldErrors,
  };
}

export function normalizeAgreementPayload(
  draft: CooperationAgreementDocument
): CooperationAgreementDocument {
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
    nomorKontrak: draft.nomorKontrak.trim(),
    kotaPenandatanganan: draft.kotaPenandatanganan.trim(),
    perusahaanPihakPertama: draft.perusahaanPihakPertama.trim(),
    perwakilanPihakPertama: draft.perwakilanPihakPertama.trim(),
    jabatanPihakPertama: draft.jabatanPihakPertama.trim(),
    alamatPihakPertama: draft.alamatPihakPertama.trim(),
    namaPihakKedua: draft.namaPihakKedua.trim(),
    nomorIdentitasPihakKedua: draft.nomorIdentitasPihakKedua.trim(),
    jabatanPihakKedua: draft.jabatanPihakKedua.trim(),
    teleponPihakKedua: draft.teleponPihakKedua.trim(),
    alamatPihakKedua: draft.alamatPihakKedua.trim(),
    judulProyek: draft.judulProyek.trim(),
    lokasiProyek: draft.lokasiProyek.trim(),
    nilaiKontrak: Math.max(0, Math.round(draft.nilaiKontrak || 0)),
    persenDp: Math.max(0, Math.min(100, Math.round(draft.persenDp || 0))),
    persenProgres: Math.max(0, Math.min(100, Math.round(draft.persenProgres || 0))),
    persenPelunasan: Math.max(0, Math.min(100, Math.round(draft.persenPelunasan || 0))),
    tahapanPembayaran: cleanStages,
    catatanPembayaran: draft.catatanPembayaran?.trim() || '',
    durasiKerjaHari: Math.max(1, Math.round(draft.durasiKerjaHari || 1)),
    masaGaransiBulan: Math.max(0, Math.round(draft.masaGaransiBulan || 0)),
    daftarPasal: draft.daftarPasal
      .filter((c) => c.judulPasal.trim() || c.isiPasal.trim())
      .map((c) => ({
        ...c,
        judulPasal: c.judulPasal.trim(),
        isiPasal: c.isiPasal.trim(),
      })),
    saksiPihakPertama: draft.saksiPihakPertama.trim(),
    saksiPihakKedua: draft.saksiPihakKedua.trim(),
  };
}

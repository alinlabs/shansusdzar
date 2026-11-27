import {
  getClientNameFieldLabel,
  normalizeClientEntityType,
} from '../../../../lib/agreement-identity';
import { normalizeDimensionString } from '../../../../lib/dimension-format';
import { formatWorkshopDocumentNumber } from '../../../../lib/document-numbering';
import { formatRupiahSigned } from '../../../../lib/finance-utils';
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
  CooperationAgreementProductItem,
  CooperationAgreementStatus,
  CooperationAgreementType,
} from '../../../../types/documents';

export const AGREEMENT_TYPES: CooperationAgreementType[] = [
  'Kontrak Proyek Custom Interior',
  'Perjanjian Kerja Mitra / Kontraktor',
  'Pengadaan Furniture Komersial',
];

export const AGREEMENT_STATUSES: CooperationAgreementStatus[] = [
  'Draf',
  'Ditinjau Klien',
  'Ditandatangani',
  'Aktif Berjalan',
  'Selesai',
];

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

export function createEmptyAgreementProductItem(): CooperationAgreementProductItem {
  return {
    id: `spks-prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaProduk: '',
    dimensi: '',
    customisasi: '',
    material: '',
    finishing: '',
    kodeWarna: '',
    spesifikasiMaterial: '',
    satuan: 'Unit',
    jumlah: 1,
    hargaSatuan: 0,
    subtotal: 0,
  };
}

export function computeAgreementProductsTotal(
  items?: readonly CooperationAgreementProductItem[]
): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const qty = Math.max(1, Math.round(Number(item.jumlah) || 1));
    const unitPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
    const lineTotal =
      typeof item.subtotal === 'number' && Number.isFinite(item.subtotal) && item.subtotal > 0
        ? Math.round(item.subtotal)
        : qty * unitPrice;
    return sum + lineTotal;
  }, 0);
}

export function createEmptyAgreement(
  seq: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  options?: { clientCodeOrSeq?: string | number; date?: string | Date }
): CooperationAgreementDocument {
  const stages = clonePaymentSchemeStages(paymentScheme);
  const legacy = deriveLegacyThreeStagePercentages(stages);

  const todayIso = new Date().toISOString().slice(0, 10);
  const finishIso = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

  return {
    id: `spk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorKontrak: formatWorkshopDocumentNumber('SPK', {
      clientCodeOrSeq: options?.clientCodeOrSeq ?? seq,
      date: options?.date ?? todayIso,
    }),
    jenisPerjanjian: 'Kontrak Proyek Custom Interior',
    kotaPenandatanganan: 'Purwakarta',
    tanggalPenandatanganan: todayIso,
    status: 'Draf',
    perusahaanPihakPertama: businessConfig.namaMerek,
    perwakilanPihakPertama: businessConfig.drafPemilik.namaPemilik,
    jabatanPihakPertama: businessConfig.drafPemilik.jabatanPemilik,
    teleponPihakPertama: businessConfig.whatsapp.nomorTampil,
    alamatPihakPertama: businessConfig.alamat.alamatLengkap,
    jenisPihakKedua: 'pribadi',
    namaPerusahaanPihakKedua: '',
    penanggungJawabPihakKedua: '',
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
    tanggalMulaiKerja: todayIso,
    tanggalSelesaiKerja: finishIso,
    nomorPenawaranReferensi: '',
    lampiranAcuan:
      'Surat Penawaran Harga Final, Rincian RAB / Bill of Quantities (BOQ), Gambar Kerja Teknis (Shop Drawing Final), dan Spesifikasi Material & Finishing.',
    masaGaransiBulan: 6,
    daftarProduk: [],
    daftarPasal: [
      {
        id: `cl-${Date.now()}-1`,
        judulPasal: 'Pasal 1 — Ruang Lingkup Pekerjaan (Scope of Work)',
        isiPasal:
          '1. Jenis & Cakupan Pekerjaan: PIHAK PERTAMA berkewajiban melaksanakan pekerjaan survei pengukuran ulang lokasi, penyusunan gambar kerja teknis (shop drawing), pengadaan material utama dan hardware, fabrikasi di workshop, pengemasan, pengiriman, hingga pemasangan unit furniture/interior custom di lokasi proyek sesuai kesepakatan kontrak.\n2. Lampiran Acuan & Pengecualian: Seluruh pelaksanaan pekerjaan mengacu pada Lampiran Acuan (Surat Penawaran Final, RAB/BOQ, Shop Drawing Final, dan Spesifikasi Material) sebagai bagian tak terpisahkan dari SPK ini. Pekerjaan sipil, pembobokan dinding, penarikan jalur listrik/plumbing utama, dan pengadaan perangkat elektronik di luar BOQ tidak termasuk dalam lingkup kecuali disepakati tertulis.',
      },
      {
        id: `cl-${Date.now()}-2`,
        judulPasal: 'Pasal 2 — Nilai Kontrak & Sistem Pembayaran (Termin)',
        isiPasal: `1. Nilai Kontrak & Skema Termin: ${buildAgreementPaymentClauseText(stages, paymentScheme.catatan)}\n2. Rekening Tujuan Resmi: Seluruh pembayaran hanya dianggap sah apabila ditransfer ke rekening resmi PIHAK PERTAMA pada Bank BNI No. 1905207398 atau Bank BSI No. 7370860534 a.n. Hilman Aziz Napis dengan mencantumkan nomor SPK.\n3. Penagihan & Penangguhan: Keterlambatan pembayaran termin berjalan berhak mengakibatkan penangguhan sementara jadwal produksi, pengiriman, atau instalasi hingga kewajiban termin terkait diselesaikan.`,
      },
      {
        id: `cl-${Date.now()}-3`,
        judulPasal: 'Pasal 3 — Jangka Waktu Pelaksanaan & Pengecualian Keterlambatan',
        isiPasal:
          '1. Durasi & Jadwal Efektif: Jangka waktu pelaksanaan pekerjaan dihitung sejak diterimanya pembayaran Termin 1 (Uang Muka / DP) dan disetujuinya gambar kerja final oleh PIHAK KEDUA hingga target tanggal selesai yang disepakati.\n2. Pengecualian Keterlambatan: Batas waktu pelaksanaan tidak dihitung sebagai keterlambatan Kontraktor apabila disebabkan oleh: (a) keterlambatan pembayaran termin oleh Klien; (b) keterlambatan persetujuan desain, kode warna HPL/Duco, atau material oleh Klien; (c) lokasi kerja belum siap atau terhambat pekerjaan sipil/MEP pihak lain; atau (d) Keadaan Kahar (Force Majeure).',
      },
      {
        id: `cl-${Date.now()}-4`,
        judulPasal: 'Pasal 4 — Pekerjaan Tambah / Kurang (Addendum / Variation Order)',
        isiPasal:
          '1. Prosedur Perubahan: Setiap permintaan penambahan item, pengurangan pekerjaan, perubahan dimensi signifikan, atau penggantian jenis material/finishing setelah gambar kerja dikunci wajib diajukan secara tertulis dan disetujui PARA PIHAK melalui Addendum Kontrak atau Variation Order (VO).\n2. Penyesuaian Biaya & Waktu: Setiap perubahan lingkup kerja secara otomatis mengatur penyesuaian nilai kontrak (tambah/kurang biaya) serta perpanjangan atau penyesuaian jangka waktu penyelesaian pekerjaan secara proporsional sebelum pekerjaan perubahan diproduksi.',
      },
      {
        id: `cl-${Date.now()}-5`,
        judulPasal: 'Pasal 5 — Hak dan Kewajiban Para Pihak',
        isiPasal:
          '1. Kewajiban & Hak Klien (PIHAK KEDUA): Klien berkewajiban melunasi pembayaran termin sesuai jadwal, memberikan akses lokasi kerja yang aman, menyediakan daya listrik dan air kerja memadai selama instalasi, serta memberi persetujuan desain/material tepat waktu. Klien berhak menerima hasil pekerjaan sesuai spesifikasi BOQ, gambar kerja, dan standar kerapihan kontrak.\n2. Kewajiban & Hak Kontraktor (PIHAK PERTAMA): Kontraktor berkewajiban melaksanakan pekerjaan sesuai spesifikasi material, ukuran, standar keselamatan kerja (K3), lulus pemeriksaan mutu (QC), dan menjaga kebersihan area kerja. Kontraktor berhak menerima pembayaran termin tepat waktu serta penyesuaian jadwal apabila terjadi hambatan di luar kendali Kontraktor.',
      },
      {
        id: `cl-${Date.now()}-6`,
        judulPasal: 'Pasal 6 — Masa Pemeliharaan & Garansi (Retensi)',
        isiPasal:
          '1. Durasi Garansi & Retensi: PIHAK PERTAMA memberikan garansi pemeliharaan terhitung sejak tanggal penandatanganan BAST, sedangkan porsi termin serah terima (retensi pelunasan akhir sesuai tabel termin) diselesaikan bersamaan dengan verifikasi BAST.\n2. Cakupan & Pengecualian: Garansi mencakup perbaikan cacat pengerjaan workshop, sambungan konstruksi, penyetelan engsel slow-motion, dan rel laci. Garansi tidak mencakup kerusakan akibat kesalahan pemakaian, beban berlebih, modifikasi oleh pihak ketiga, kebocoran dinding/atap bangunan, kelembapan ekstrem, atau bencana alam.',
      },
      {
        id: `cl-${Date.now()}-7`,
        judulPasal: 'Pasal 7 — Denda Keterlambatan & Pembatalan Kontrak',
        isiPasal:
          '1. Denda Kontraktor: Keterlambatan penyelesaian oleh Kontraktor di luar pengecualian Pasal 3 dan Force Majeure dikenakan denda sebesar 1‰ (0,1%) per hari kalender dari nilai pekerjaan tertunda, dengan batas maksimum 5% (lima persen) dari nilai kontrak terkait.\n2. Denda Klien: Keterlambatan pembayaran termin oleh Klien melampaui 7 (tujuh) hari kalender dari jatuh tempo memberi hak kepada Kontraktor menangguhkan produksi/instalasi tanpa penalti; penundaan lebih dari 14 (empat belas) hari kalender dapat dikenakan biaya penyimpanan workshop atau denda sebesar 1‰ (0,1%) per hari kalender dari nilai termin tertunggak (maks. 5%).\n3. Klausul Pembatalan (Force Majeure & Sepihak): (a) Keadaan Kahar (bencana alam, kebakaran, huru-hara, pemadaman listrik berkepanjangan, kebijakan pemerintah) membebaskan PARA PIHAK dari sanksi wanprestasi dengan pemberitahuan tertulis maksimal 3 hari kerja; (b) Pembatalan sepihak oleh Klien tetap mewajibkan penggantian biaya survei, desain, pengadaan material khusus, dan progres produksi berjalan; pembatalan sepihak oleh Kontraktor di luar Force Majeure mewajibkan pengembalian sisa dana termin yang belum terealisasi.',
      },
      {
        id: `cl-${Date.now()}-8`,
        judulPasal: 'Pasal 8 — Serah Terima Pekerjaan & Penyelesaian Sengketa',
        isiPasal:
          '1. Prosedur Serah Terima Pekerjaan: Setelah seluruh unit terpasang, PARA PIHAK melaksanakan pemeriksaan fisik bersama di lokasi proyek. Temuan perbaikan minor (punch-list) diselesaikan terlebih dahulu sebelum penandatanganan Berita Acara Serah Terima (BAST), yang sekaligus menandai peralihan risiko penggunaan dan dimulainya masa garansi.\n2. Penyelesaian Perselisihan: Apabila terjadi perbedaan penafsiran atau sengketa, PARA PIHAK sepakat menyelesaikannya secara musyawarah untuk mufakat dalam tenggang waktu 14 (empat belas) hari kalender; apabila tidak tercapai, perselisihan diselesaikan melalui Pengadilan Negeri sesuai domisili hukum kota penandatanganan SPK ini.',
      },
    ],
    saksiPihakPertama: '',
    saksiPihakKedua: '',
  };
}

export function applyPaymentSchemeToAgreement(
  doc: CooperationAgreementDocument,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): CooperationAgreementDocument {
  const stages = clonePaymentSchemeStages(paymentScheme);
  const legacy = deriveLegacyThreeStagePercentages(stages);
  const nextClauseText = `1. Nilai Kontrak & Skema Termin: Nilai total kontrak yang disepakati adalah sebesar ${formatRupiahSigned(doc.nilaiKontrak)}. ${buildAgreementPaymentClauseText(stages, paymentScheme.catatan)}\n2. Rekening Tujuan Resmi: Seluruh pembayaran hanya dianggap sah apabila ditransfer ke rekening resmi PIHAK PERTAMA pada Bank BNI No. 1905207398 atau Bank BSI No. 7370860534 a.n. Hilman Aziz Napis dengan mencantumkan nomor SPK.\n3. Penagihan & Penangguhan: Keterlambatan pembayaran termin berjalan berhak mengakibatkan penangguhan sementara jadwal produksi, pengiriman, atau instalasi hingga kewajiban termin terkait diselesaikan.`;
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
      const hay = `${doc.nomorKontrak} ${doc.judulProyek} ${doc.namaPihakKedua} ${doc.namaPerusahaanPihakKedua ?? ''} ${doc.penanggungJawabPihakKedua ?? ''} ${doc.jenisPerjanjian}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateAgreementDraft(
  draft: CooperationAgreementDocument
): AgreementValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  const entityType = normalizeClientEntityType(
    draft.jenisPihakKedua,
    draft.namaPerusahaanPihakKedua || draft.namaPihakKedua
  );
  const nameLabel = getClientNameFieldLabel(entityType);

  if (!draft.nomorKontrak.trim()) {
    fieldErrors.nomorKontrak = 'Nomor kontrak SPK wajib diisi.';
  }
  if (!draft.tanggalPenandatanganan.trim()) {
    fieldErrors.tanggalPenandatanganan = 'Tanggal SPK wajib diisi.';
  }
  if (!draft.namaPihakKedua.trim()) {
    fieldErrors.namaPihakKedua = `${nameLabel} pihak kedua wajib diisi.`;
  }
  if (entityType !== 'pribadi' && !(draft.penanggungJawabPihakKedua ?? '').trim()) {
    fieldErrors.penanggungJawabPihakKedua = 'Penanggung jawab pihak kedua wajib diisi.';
  }
  if (!draft.judulProyek.trim()) {
    fieldErrors.judulProyek = 'Judul objek pekerjaan / proyek wajib diisi.';
  }
  if (!Number.isFinite(draft.nilaiKontrak) || draft.nilaiKontrak < 0) {
    fieldErrors.nilaiKontrak = 'Nilai kontrak tidak valid.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor kontrak SPK, tanggal, nama pihak kedua, dan judul objek pekerjaan.'
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

  const cleanProducts = Array.isArray(draft.daftarProduk)
    ? draft.daftarProduk
        .filter((item) => item.namaProduk.trim().length > 0)
        .map((item) => {
          const jumlah = Math.max(1, Math.round(Number(item.jumlah) || 1));
          const hargaSatuan = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
          const normalizedSubtotal =
            typeof item.subtotal === 'number' &&
            Number.isFinite(item.subtotal) &&
            item.subtotal > 0 &&
            Math.abs(item.subtotal - jumlah * hargaSatuan) <= jumlah
              ? Math.round(item.subtotal)
              : jumlah * hargaSatuan;

          return {
            id: item.id,
            namaProduk: item.namaProduk.trim(),
            dimensi: normalizeDimensionString(item.dimensi) || 'Sesuai Gambar Kerja Lapangan',
            customisasi: item.customisasi?.trim() || undefined,
            material: item.material?.trim() || undefined,
            finishing: item.finishing?.trim() || undefined,
            kodeWarna: item.kodeWarna?.trim() || undefined,
            spesifikasiMaterial: item.spesifikasiMaterial.trim(),
            satuan: item.satuan?.trim() || 'Unit',
            jumlah,
            hargaSatuan,
            subtotal: normalizedSubtotal,
          };
        })
    : undefined;

  const normalizedSecondPartyType = normalizeClientEntityType(
    draft.jenisPihakKedua,
    draft.namaPerusahaanPihakKedua || draft.namaPihakKedua
  );
  const trimmedNamaPihakKedua = draft.namaPihakKedua.trim();
  const trimmedOrgName =
    normalizedSecondPartyType === 'pribadi'
      ? undefined
      : draft.namaPerusahaanPihakKedua?.trim() || trimmedNamaPihakKedua || undefined;
  const trimmedPicName =
    normalizedSecondPartyType === 'pribadi'
      ? undefined
      : draft.penanggungJawabPihakKedua?.trim() || undefined;

  return {
    ...draft,
    nomorKontrak: draft.nomorKontrak.trim(),
    kotaPenandatanganan: draft.kotaPenandatanganan.trim(),
    perusahaanPihakPertama: draft.perusahaanPihakPertama.trim(),
    perwakilanPihakPertama: draft.perwakilanPihakPertama.trim(),
    jabatanPihakPertama: draft.jabatanPihakPertama.trim(),
    teleponPihakPertama: draft.teleponPihakPertama?.trim() || undefined,
    alamatPihakPertama: draft.alamatPihakPertama.trim(),
    jenisPihakKedua: normalizedSecondPartyType,
    namaPerusahaanPihakKedua: trimmedOrgName,
    penanggungJawabPihakKedua: trimmedPicName,
    namaPihakKedua: trimmedNamaPihakKedua,
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
    tanggalMulaiKerja: draft.tanggalMulaiKerja?.trim() || undefined,
    tanggalSelesaiKerja: draft.tanggalSelesaiKerja?.trim() || undefined,
    nomorPenawaranReferensi: draft.nomorPenawaranReferensi?.trim() || undefined,
    lampiranAcuan: draft.lampiranAcuan?.trim() || undefined,
    masaGaransiBulan: Math.max(0, Math.round(draft.masaGaransiBulan || 0)),
    daftarProduk: cleanProducts && cleanProducts.length > 0 ? cleanProducts : undefined,
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

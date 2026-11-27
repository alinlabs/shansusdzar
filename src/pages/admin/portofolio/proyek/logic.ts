import {
  PORTFOLIO_CLIENT_SALUTATIONS,
  computePortfolioAreaSqm,
  deriveClientInitials,
  formatPortfolioClientWithSalutation,
  generateNextPortfolioId,
  getPortfolioSlug,
  isPortfolioSlugTaken,
  normalizePortfolioDimensions,
  normalizePortfolioSalutation,
  slugifyPortfolioTitle,
} from '../../../../lib/portfolio-filter';
import type {
  PortfolioCaseStudy,
  PortfolioDimensionItem,
  PortfolioReviewData,
} from '../../../../types/cms';

export const PRESET_PORTFOLIO_IMAGES: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Kitchen Set', url: '/sample-produk/gambar/kitchen-set-real.webp' },
  { label: 'Island Table', url: '/sample-produk/gambar/meja-dapur-real.webp' },
  { label: 'Lemari Pakaian', url: '/sample-produk/gambar/lemari-pakaian-real.webp' },
  { label: 'Backdrop TV', url: '/sample-produk/gambar/backdrop-tv-real.webp' },
  { label: 'Credenza / Meja TV', url: '/sample-produk/gambar/meja-tv-real.webp' },
  { label: 'Meja Kerja', url: '/sample-produk/gambar/meja-kerja-real.webp' },
  { label: 'Meja Resepsionis', url: '/sample-produk/gambar/meja-resepsionis-real.webp' },
];

export interface PortfolioFormDraft extends PortfolioCaseStudy {
  materialsText: string;
  galleryText: string;
  ulasanAktif: boolean;
  ulasanSapaan: string;
  ulasanKlien: string;
  ulasanPenilaian: number;
  ulasanKomentar: string;
}

export interface PortfolioValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyPortfolioDraft(
  existingProjectsOrNextIndex: readonly Pick<PortfolioCaseStudy, 'id'>[] | number = []
): PortfolioFormDraft {
  const nextId =
    typeof existingProjectsOrNextIndex === 'number'
      ? `port-${String(Math.max(1, Math.round(existingProjectsOrNextIndex))).padStart(3, '0')}`
      : generateNextPortfolioId(existingProjectsOrNextIndex);

  return {
    id: nextId,
    produkId: '',
    judul: '',
    kategori: 'Dapur & Bar',
    cakupan: 'Custom Interior',
    lokasi: 'Purwakarta',
    tahun: '2026',
    durasi: '14 Hari Kerja',
    dimensi: [{ panjang: 200, lebar: 60, tinggi: 220 }],
    referensiHarga: null,
    catatanMaterial: 'Multipleks & Blockboard',
    catatanFinishing: 'HPL',
    materialDigunakan: ['Multipleks', 'HPL'],
    materialsText: 'Multipleks\nHPL',
    deskripsi: '',
    tantangan: '',
    solusi: '',
    gambarUtama: '/sample-produk/gambar/kitchen-set-real.webp',
    galeriGambar: ['/sample-produk/gambar/kitchen-set-real.webp'],
    galleryText: '/sample-produk/gambar/kitchen-set-real.webp',
    teksAlt: 'Dokumentasi proyek interior custom Shansus Dzar Indonesia',
    tampilDiBeranda: true,
    ulasan: null,
    ulasanAktif: false,
    ulasanSapaan: '',
    ulasanKlien: '',
    ulasanPenilaian: 5,
    ulasanKomentar: '',
  };
}

export function toPortfolioFormDraft(item: PortfolioCaseStudy): PortfolioFormDraft {
  const review = item.ulasan ?? null;
  const dimensi = normalizePortfolioDimensions(item.dimensi);
  const hasReview = Boolean(
    review && review.klien.trim().length > 0 && review.komentar.trim().length > 0
  );
  return {
    ...structuredClone(item),
    produkId: item.produkId ?? '',
    dimensi: dimensi.length > 0 ? dimensi : [{ panjang: 200, lebar: 60, tinggi: 220 }],
    materialsText: item.materialDigunakan.join('\n'),
    galleryText: item.galeriGambar.join('\n'),
    ulasanAktif: hasReview,
    ulasanSapaan: review ? normalizePortfolioSalutation(review.sapaan) : '',
    ulasanKlien: review?.klien ?? '',
    ulasanPenilaian:
      review && Number.isFinite(review.penilaian)
        ? Math.max(1, Math.min(5, Math.round(review.penilaian)))
        : 5,
    ulasanKomentar: review?.komentar ?? '',
  };
}

export function validatePortfolioDraft(
  draft: PortfolioFormDraft,
  existingProjects: readonly Pick<PortfolioCaseStudy, 'id' | 'judul'>[] = []
): PortfolioValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};

  const trimmedTitle = draft.judul.trim();
  if (!trimmedTitle) {
    fieldErrors.judul = 'Judul proyek wajib diisi.';
  } else if (!slugifyPortfolioTitle(trimmedTitle)) {
    fieldErrors.judul = 'Judul harus mengandung huruf atau angka agar URL dapat dibuat.';
  } else if (isPortfolioSlugTaken(trimmedTitle, draft.id, existingProjects)) {
    fieldErrors.judul = 'Judul proyek menghasilkan tautan URL yang sama dengan proyek lain.';
  }

  if (!draft.kategori.trim()) {
    fieldErrors.kategori = 'Kategori ruangan wajib diisi.';
  }
  if (!draft.deskripsi.trim()) {
    fieldErrors.deskripsi = 'Ringkasan proyek wajib diisi.';
  }

  const validDimensi = draft.dimensi.some(
    (d) =>
      Number.isFinite(d.panjang) &&
      d.panjang > 0 &&
      ((Number.isFinite(d.tinggi) && d.tinggi > 0) || (Number.isFinite(d.lebar) && d.lebar > 0))
  );
  if (!validDimensi) {
    fieldErrors.dimensi = 'Minimal 1 ukuran dimensi valid (Panjang & Tinggi/Lebar > 0) wajib diisi.';
  }

  if (
    draft.referensiHarga !== null &&
    draft.referensiHarga !== undefined &&
    (!Number.isFinite(draft.referensiHarga) || draft.referensiHarga < 0)
  ) {
    fieldErrors.referensiHarga = 'Referensi harga tidak boleh negatif.';
  }

  if (draft.ulasanAktif) {
    if (!draft.ulasanKlien.trim()) {
      fieldErrors.ulasanKlien = 'Nama klien / pengulas wajib diisi jika ulasan disertakan.';
    }
    if (!draft.ulasanKomentar.trim()) {
      fieldErrors.ulasanKomentar = 'Isi komentar ulasan wajib diisi jika ulasan disertakan.';
    }
    if (
      !Number.isFinite(draft.ulasanPenilaian) ||
      draft.ulasanPenilaian < 1 ||
      draft.ulasanPenilaian > 5
    ) {
      fieldErrors.ulasanPenilaian = 'Penilaian bintang harus antara 1 sampai 5.';
    }
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Lengkapi kolom wajib studi kasus portofolio.',
      fieldErrors,
    };
  }

  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizePortfolioFromDraft(
  draft: PortfolioFormDraft
): PortfolioCaseStudy {
  const gallery = draft.galleryText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const materialsUsed = draft.materialsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const normalizedDimensi: PortfolioDimensionItem[] = normalizePortfolioDimensions(draft.dimensi);
  const resolvedDimensi: PortfolioDimensionItem[] =
    normalizedDimensi.length > 0 ? normalizedDimensi : [{ panjang: 200, lebar: 60, tinggi: 220 }];

  const coverImage = draft.gambarUtama.trim() || gallery[0] || '/images/atelier-studio-craft.webp';
  const cleanProductId = draft.produkId?.trim() ?? '';

  const cleanSapaan = normalizePortfolioSalutation(draft.ulasanSapaan);
  const cleanKlien = draft.ulasanKlien.trim();
  const cleanComment = draft.ulasanKomentar.trim();
  const rating = Number.isFinite(draft.ulasanPenilaian)
    ? Math.max(1, Math.min(5, Math.round(draft.ulasanPenilaian)))
    : 5;

  let normalizedReview: PortfolioReviewData | null = null;
  if (draft.ulasanAktif && cleanKlien && cleanComment) {
    normalizedReview = {
      sapaan: cleanSapaan,
      klien: cleanKlien,
      penilaian: rating,
      komentar: cleanComment,
    };
  }

  return {
    id: draft.id.trim(),
    ...(cleanProductId ? { produkId: cleanProductId } : {}),
    judul: draft.judul.trim(),
    kategori: draft.kategori.trim(),
    cakupan: draft.cakupan.trim() || 'Custom Interior',
    lokasi: draft.lokasi.trim(),
    tahun: draft.tahun.trim(),
    durasi: draft.durasi.trim(),
    dimensi: resolvedDimensi,
    referensiHarga:
      typeof draft.referensiHarga === 'number' &&
      Number.isFinite(draft.referensiHarga) &&
      draft.referensiHarga > 0
        ? Math.round(draft.referensiHarga)
        : null,
    catatanMaterial: draft.catatanMaterial.trim(),
    catatanFinishing: draft.catatanFinishing.trim(),
    materialDigunakan: materialsUsed,
    deskripsi: draft.deskripsi.trim(),
    tantangan: draft.tantangan.trim(),
    solusi: draft.solusi.trim(),
    gambarUtama: coverImage,
    galeriGambar: gallery.length > 0 ? gallery : [coverImage],
    teksAlt: draft.teksAlt.trim() || draft.judul.trim(),
    tampilDiBeranda: Boolean(draft.tampilDiBeranda),
    ulasan: normalizedReview,
  };
}

export {
  PORTFOLIO_CLIENT_SALUTATIONS,
  computePortfolioAreaSqm,
  deriveClientInitials,
  formatPortfolioClientWithSalutation,
  getPortfolioSlug,
  slugifyPortfolioTitle,
};

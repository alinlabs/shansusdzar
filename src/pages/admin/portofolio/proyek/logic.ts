import mediaPresetsData from '../../../../data/aset-media-bawaan.json';
import {
  deriveClientInitials,
  ensureUniquePortfolioSlug,
  slugifyPortfolioTitle,
} from '../../../../lib/portfolio-filter';
import type { PortfolioCaseStudy, PortfolioReviewData } from '../../../../types/cms';

export const PRESET_PORTFOLIO_IMAGES = mediaPresetsData.gambarPortofolio;

export interface PortfolioFormDraft extends PortfolioCaseStudy {
  materialsText: string;
  galleryText: string;
  ulasanAktif: boolean;
  ulasanNamaPengulas: string;
  ulasanInisial: string;
  ulasanPenilaian: number;
  ulasanKomentar: string;
}

export interface PortfolioValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyPortfolioDraft(nextOrder: number): PortfolioFormDraft {
  return {
    id: `portofolio-${Date.now()}`,
    slug: `proyek-baru-${nextOrder}`,
    judul: '',
    kategori: 'Dapur & Bar',
    cakupan: 'Custom Interior',
    namaKlien: '',
    lokasi: 'Purwakarta',
    tahun: '2026',
    durasi: '14 Hari Kerja',
    ringkasanDimensi: '',
    luasMeterPersegi: 12,
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
    terbit: true,
    urutan: Math.max(1, nextOrder),
    ulasan: null,
    ulasanAktif: false,
    ulasanNamaPengulas: '',
    ulasanInisial: '',
    ulasanPenilaian: 5,
    ulasanKomentar: '',
  };
}

export function toPortfolioFormDraft(item: PortfolioCaseStudy): PortfolioFormDraft {
  const review = item.ulasan ?? null;
  return {
    ...structuredClone(item),
    materialsText: item.materialDigunakan.join('\n'),
    galleryText: item.galeriGambar.join('\n'),
    ulasanAktif: Boolean(review?.tampil),
    ulasanNamaPengulas: review?.namaPengulas ?? '',
    ulasanInisial: review?.inisial ?? '',
    ulasanPenilaian:
      review && Number.isFinite(review.penilaian)
        ? Math.max(1, Math.min(5, Math.round(review.penilaian)))
        : 5,
    ulasanKomentar: review?.komentar ?? '',
  };
}

export function validatePortfolioDraft(draft: PortfolioFormDraft): PortfolioValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};

  if (!draft.judul.trim()) {
    fieldErrors.judul = 'Judul proyek wajib diisi.';
  }
  if (!draft.kategori.trim()) {
    fieldErrors.kategori = 'Kategori ruangan wajib diisi.';
  }
  if (!draft.deskripsi.trim()) {
    fieldErrors.deskripsi = 'Ringkasan proyek wajib diisi.';
  }
  if (
    draft.referensiHarga !== null &&
    draft.referensiHarga !== undefined &&
    (!Number.isFinite(draft.referensiHarga) || draft.referensiHarga < 0)
  ) {
    fieldErrors.referensiHarga = 'Referensi harga tidak boleh negatif.';
  }

  if (draft.ulasanAktif) {
    if (!draft.ulasanNamaPengulas.trim()) {
      fieldErrors.ulasanNamaPengulas = 'Nama pengulas / klien wajib diisi jika ulasan ditampilkan.';
    }
    if (!draft.ulasanKomentar.trim()) {
      fieldErrors.ulasanKomentar = 'Isi komentar ulasan wajib diisi jika ulasan ditampilkan.';
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
  draft: PortfolioFormDraft,
  existingProjects: readonly PortfolioCaseStudy[]
): PortfolioCaseStudy {
  const gallery = draft.galleryText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const materialsUsed = draft.materialsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const rawSlug = draft.slug.trim() || draft.judul.trim();
  const resolvedSlug = ensureUniquePortfolioSlug(rawSlug, draft.id, existingProjects);
  const coverImage = draft.gambarUtama.trim() || gallery[0] || '/images/atelier-studio-craft.webp';

  const cleanReviewer = draft.ulasanNamaPengulas.trim();
  const cleanComment = draft.ulasanKomentar.trim();
  const rawInitials = draft.ulasanInisial.trim().toUpperCase().slice(0, 3);
  const rating = Number.isFinite(draft.ulasanPenilaian)
    ? Math.max(1, Math.min(5, Math.round(draft.ulasanPenilaian)))
    : 5;

  let normalizedReview: PortfolioReviewData | null = null;
  if (draft.ulasanAktif || cleanReviewer || cleanComment) {
    normalizedReview = {
      tampil: Boolean(draft.ulasanAktif),
      namaPengulas: cleanReviewer,
      inisial: rawInitials || (cleanReviewer ? deriveClientInitials(cleanReviewer) : ''),
      penilaian: rating,
      komentar: cleanComment,
    };
  }

  const {
    materialsText: _m,
    galleryText: _g,
    ulasanAktif: _ua,
    ulasanNamaPengulas: _un,
    ulasanInisial: _ui,
    ulasanPenilaian: _up,
    ulasanKomentar: _uk,
    ...rest
  } = draft;
  void _m;
  void _g;
  void _ua;
  void _un;
  void _ui;
  void _up;
  void _uk;

  return {
    ...rest,
    slug: resolvedSlug,
    judul: draft.judul.trim(),
    kategori: draft.kategori.trim(),
    cakupan: draft.cakupan.trim() || 'Custom Interior',
    namaKlien: draft.namaKlien.trim(),
    lokasi: draft.lokasi.trim(),
    tahun: draft.tahun.trim(),
    durasi: draft.durasi.trim(),
    ringkasanDimensi: draft.ringkasanDimensi.trim(),
    luasMeterPersegi: Math.max(1, Number(draft.luasMeterPersegi) || 1),
    referensiHarga:
      typeof draft.referensiHarga === 'number' &&
      Number.isFinite(draft.referensiHarga) &&
      draft.referensiHarga > 0
        ? Math.round(draft.referensiHarga)
        : null,
    catatanMaterial: draft.catatanMaterial.trim(),
    catatanFinishing: draft.catatanFinishing.trim(),
    deskripsi: draft.deskripsi.trim(),
    tantangan: draft.tantangan.trim(),
    solusi: draft.solusi.trim(),
    gambarUtama: coverImage,
    galeriGambar: gallery.length > 0 ? gallery : [coverImage],
    materialDigunakan: materialsUsed,
    teksAlt: draft.teksAlt.trim() || draft.judul.trim(),
    ulasan: normalizedReview,
  };
}

export { deriveClientInitials, slugifyPortfolioTitle };

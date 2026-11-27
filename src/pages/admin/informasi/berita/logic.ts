import {
  generateNextNewsId,
  getNewsSlug,
  isNewsSlugTaken,
  slugifyNewsTitle,
} from '../../../../lib/informasi-filter';
import {
  createDefaultNewsImageFormat,
  createDefaultNewsTextFormat,
  normalizeNewsContentBlocks,
  sanitizeNewsImageUrl,
  type NewsArticleContentBlock,
  type NewsImageContentBlock,
  type NewsTextContentBlock,
} from '../../../../lib/news-content';
import type { NewsArticleItem } from '../../../../types/cms';

export const PRESET_NEWS_COVERS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Kabinet Dapur Modular', url: '/produk/gambar/kabinet-dapur-modular.webp' },
  { label: 'Lemari Pakaian Panel Rata', url: '/produk/gambar/lemari-pakaian-panel-rata.webp' },
  { label: 'Credenza & Panel Dinding', url: '/produk/gambar/credenza-panel-dinding.webp' },
  { label: 'Sofa Sandar Minimalis', url: '/produk/gambar/sofa-sandar-minimalis.webp' },
  { label: 'Meja Makan Arsitektural', url: '/produk/gambar/meja-makan-arsitektural.webp' },
  { label: 'Meja Kerja & Kabinet', url: '/produk/gambar/meja-kerja-kabinet-dinding.webp' },
  { label: 'Workshop Shansusdzar', url: '/images/atelier-studio-craft.webp' },
  { label: 'Interior Studio Banner', url: '/images/hero-interior-studio.webp' },
];

export const PRESET_NEWS_CONTENT_IMAGES: ReadonlyArray<{ label: string; url: string }> = [
  ...PRESET_NEWS_COVERS,
  { label: 'Kitchen Set Real', url: '/sample-produk/gambar/kitchen-set-real.webp' },
  { label: 'Kitchen Set Detail', url: '/sample-produk/gambar/kitchen-set-detail.webp' },
  { label: 'Kitchen Set Terbuka', url: '/sample-produk/gambar/kitchen-set-open.webp' },
  { label: 'Lemari Pakaian Detail', url: '/sample-produk/gambar/lemari-pakaian-detail.webp' },
  { label: 'Backdrop TV Real', url: '/sample-produk/gambar/backdrop-tv-real.webp' },
  { label: 'Wall Panel Detail', url: '/sample-produk/gambar/wall-panel-detail.webp' },
];

export interface NewsFormDraft extends NewsArticleItem {
  coverPreset: string;
  keywordsText: string;
}

export interface NewsValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyTextContentBlock(initialText = ''): NewsTextContentBlock {
  return {
    jenis: 'teks',
    isi: initialText,
    format: createDefaultNewsTextFormat(),
  };
}

export function createEmptyImageContentBlock(
  initialUrls: string[] = ['/sample-produk/gambar/kitchen-set-detail.webp']
): NewsImageContentBlock {
  const safeUrls = initialUrls.length > 0 ? [...initialUrls] : [''];
  return {
    jenis: 'gambar',
    isi: safeUrls,
    format: createDefaultNewsImageFormat(undefined, safeUrls.length),
  };
}

export function createEmptyNewsDraft(
  existingArticles: readonly Pick<NewsArticleItem, 'id'>[] = []
): NewsFormDraft {
  const today = new Date().toISOString().slice(0, 10);
  const keywords = ['interior purwakarta', 'furniture custom', 'shansusdzar indonesia'];
  const defaultCover = '/produk/gambar/kabinet-dapur-modular.webp';
  return {
    id: generateNextNewsId(existingArticles),
    judul: '',
    kategori: 'Kabar Workshop',
    ringkasan: '',
    isi: [createEmptyTextContentBlock()],
    gambarSampul: defaultCover,
    coverPreset: defaultCover,
    teksAltSampul: '',
    tanggalTerbit: today,
    judulSeo: '',
    deskripsiSeo: '',
    kataKunciSeo: keywords,
    unggulan: false,
    keywordsText: keywords.join(', '),
  };
}

export function toNewsFormDraft(article: NewsArticleItem): NewsFormDraft {
  const matchedPreset = PRESET_NEWS_COVERS.some((img) => img.url === article.gambarSampul)
    ? article.gambarSampul
    : '';
  const clonedIsi: NewsArticleContentBlock[] =
    Array.isArray(article.isi) && article.isi.length > 0
      ? structuredClone(article.isi)
      : [createEmptyTextContentBlock()];
  return {
    ...structuredClone(article),
    isi: clonedIsi,
    coverPreset: matchedPreset,
    keywordsText: article.kataKunciSeo.join(', '),
  };
}

export function validateNewsDraft(
  draft: NewsFormDraft,
  existingArticles: readonly Pick<NewsArticleItem, 'id' | 'judul'>[] = []
): NewsValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  const trimmedTitle = draft.judul.trim();

  if (!trimmedTitle) {
    fieldErrors.judul = 'Judul wajib diisi.';
  } else if (!slugifyNewsTitle(trimmedTitle)) {
    fieldErrors.judul = 'Judul harus mengandung huruf atau angka untuk membentuk tautan.';
  } else if (isNewsSlugTaken(trimmedTitle, draft.id, existingArticles)) {
    fieldErrors.judul = 'Judul ini menghasilkan tautan artikel yang sudah digunakan artikel lain.';
  }

  if (!draft.kategori.trim()) {
    fieldErrors.kategori = 'Kategori wajib diisi.';
  }

  if (!draft.ringkasan.trim()) {
    fieldErrors.ringkasan = 'Ringkasan wajib diisi.';
  }

  if (!Array.isArray(draft.isi) || draft.isi.length === 0) {
    fieldErrors.isi = 'Minimal harus ada 1 blok isi artikel (teks atau gambar).';
  } else {
    draft.isi.forEach((block, idx) => {
      if (block.jenis === 'teks') {
        if (!block.isi.trim()) {
          fieldErrors[`isi.${idx}`] = `Blok #${idx + 1} (Teks) belum diisi.`;
        }
      } else {
        const urls = Array.isArray(block.isi) ? block.isi : [];
        const hasValidUrl = urls.some((url) => sanitizeNewsImageUrl(url) !== null);
        if (urls.length === 0 || !hasValidUrl) {
          fieldErrors[`isi.${idx}`] = `Blok #${idx + 1} (Gambar) membutuhkan minimal 1 URL/path gambar yang valid.`;
        } else if (urls.some((url) => url.trim() !== '' && sanitizeNewsImageUrl(url) === null)) {
          fieldErrors[`isi.${idx}`] = `Blok #${idx + 1} (Gambar) memiliki URL yang tidak valid.`;
        }
      }
    });
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Lengkapi kolom wajib.',
      fieldErrors,
    };
  }

  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeNewsFromDraft(
  draft: NewsFormDraft,
  shortBrandName: string,
  existingArticles: readonly Pick<NewsArticleItem, 'id'>[] = []
): NewsArticleItem {
  const normalizedIsi = normalizeNewsContentBlocks(draft.isi);
  const safeIsi: NewsArticleContentBlock[] =
    normalizedIsi.length > 0
      ? normalizedIsi
      : [createEmptyTextContentBlock(draft.ringkasan.trim() || draft.judul.trim())];

  const keywords = draft.keywordsText
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const resolvedId = /^news-\d{3}$/i.test(draft.id.trim())
    ? draft.id.trim().toLowerCase()
    : generateNextNewsId(existingArticles);

  const { coverPreset: _cp, keywordsText: _kt, ...rest } = draft;
  void _cp;
  void _kt;

  const cleanRest = { ...rest } as NewsFormDraft & {
    slug?: unknown;
    terbit?: unknown;
    paragrafKonten?: unknown;
  };
  delete cleanRest.slug;
  delete cleanRest.terbit;
  delete cleanRest.paragrafKonten;

  return {
    ...cleanRest,
    id: resolvedId,
    judul: draft.judul.trim(),
    kategori: draft.kategori.trim(),
    ringkasan: draft.ringkasan.trim(),
    isi: safeIsi,
    judulSeo: draft.judulSeo.trim() || `${draft.judul.trim()} | ${shortBrandName}`,
    deskripsiSeo: draft.deskripsiSeo.trim() || draft.ringkasan.trim(),
    kataKunciSeo: keywords,
    teksAltSampul: draft.teksAltSampul.trim() || draft.judul.trim(),
  };
}

export { getNewsSlug, slugifyNewsTitle };

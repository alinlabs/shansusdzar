import mediaPresetsData from '../../../../data/aset-media-bawaan.json';
import { slugifyNewsTitle } from '../../../../lib/informasi-filter';
import type { NewsArticleItem } from '../../../../types/cms';

export const PRESET_NEWS_COVERS = mediaPresetsData.sampulBerita;

export interface NewsFormDraft extends NewsArticleItem {
  coverPreset: string;
  bodyText: string;
  keywordsText: string;
}

export interface NewsValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyNewsDraft(): NewsFormDraft {
  const today = new Date().toISOString().slice(0, 10);
  const keywords = ['interior purwakarta', 'furniture custom', 'shansusdzar indonesia'];
  const defaultCover = '/produk/gambar/kabinet-dapur-modular.webp';
  return {
    id: `news-${Date.now()}`,
    slug: '',
    judul: '',
    kategori: 'Kabar Workshop',
    ringkasan: '',
    paragrafKonten: [],
    gambarSampul: defaultCover,
    coverPreset: defaultCover,
    teksAltSampul: '',
    tanggalTerbit: today,
    judulSeo: '',
    deskripsiSeo: '',
    kataKunciSeo: keywords,
    unggulan: false,
    terbit: true,
    bodyText: '',
    keywordsText: keywords.join(', '),
  };
}

export function toNewsFormDraft(article: NewsArticleItem): NewsFormDraft {
  const matchedPreset = PRESET_NEWS_COVERS.some((img) => img.url === article.gambarSampul)
    ? article.gambarSampul
    : '';
  return {
    ...structuredClone(article),
    coverPreset: matchedPreset,
    bodyText: article.paragrafKonten.join('\n\n'),
    keywordsText: article.kataKunciSeo.join(', '),
  };
}

export function validateNewsDraft(draft: NewsFormDraft): NewsValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.judul.trim()) {
    fieldErrors.judul = 'Judul wajib diisi.';
  }
  if (!draft.kategori.trim()) {
    fieldErrors.kategori = 'Kategori wajib diisi.';
  }
  if (!draft.ringkasan.trim()) {
    fieldErrors.ringkasan = 'Ringkasan wajib diisi.';
  }
  if (!draft.bodyText.trim()) {
    fieldErrors.bodyText = 'Isi artikel wajib diisi.';
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
  shortBrandName: string
): NewsArticleItem {
  const paragraphs = draft.bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const safeParagraphs =
    paragraphs.length > 0 ? paragraphs : [draft.ringkasan.trim() || draft.judul.trim()];
  const keywords = draft.keywordsText
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const { coverPreset: _cp, bodyText: _bt, keywordsText: _kt, ...rest } = draft;
  void _cp;
  void _bt;
  void _kt;

  return {
    ...rest,
    judul: draft.judul.trim(),
    slug: draft.slug.trim() ? slugifyNewsTitle(draft.slug) : slugifyNewsTitle(draft.judul),
    kategori: draft.kategori.trim(),
    ringkasan: draft.ringkasan.trim(),
    paragrafKonten: safeParagraphs,
    judulSeo: draft.judulSeo.trim() || `${draft.judul.trim()} | ${shortBrandName}`,
    deskripsiSeo: draft.deskripsiSeo.trim() || draft.ringkasan.trim(),
    kataKunciSeo: keywords,
    teksAltSampul: draft.teksAltSampul.trim() || draft.judul.trim(),
  };
}

export { slugifyNewsTitle };

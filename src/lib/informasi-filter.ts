import type {
  FaqItem,
  MaterialCategory,
  MaterialSpecItem,
  NewsArticleContentBlock,
  NewsArticleItem,
} from '../types/cms';
import { extractNewsPlainTextList } from './news-content';

export const ALL_FAQ_CATEGORIES = 'Semua';
export const ALL_NEWS_CATEGORIES = 'Semua';

export function filterMaterialSpecs(
  materials: readonly MaterialSpecItem[],
  category: MaterialCategory | 'all',
  searchQuery: string
): MaterialSpecItem[] {
  const query = searchQuery.trim().toLowerCase();
  return materials.filter((item) => {
    if (category !== 'all' && item.kategori !== category) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      item.nama,
      item.ringkasan,
      item.tipsPerawatan,
      item.terbuatDari ?? '',
      ...(item.kelebihan ?? []),
      ...item.cocokUntuk,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function extractFaqCategories(faqs: readonly FaqItem[]): string[] {
  const seen = new Set<string>();
  const result = [ALL_FAQ_CATEGORIES];
  for (const item of faqs) {
    const cat = item.kategori.trim();
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      result.push(cat);
    }
  }
  return result;
}

export function filterFaqItems(
  faqs: readonly FaqItem[],
  category: string,
  searchQuery: string,
  includeUnpublished = false
): FaqItem[] {
  const query = searchQuery.trim().toLowerCase();
  return [...faqs]
    .filter((item) => {
      if (!includeUnpublished && !item.terbit) return false;
      if (category !== ALL_FAQ_CATEGORIES && item.kategori.trim() !== category) return false;
      if (!query) return true;
      return `${item.pertanyaan} ${item.jawaban} ${item.kategori}`.toLowerCase().includes(query);
    })
    .sort((a, b) => a.urutan - b.urutan);
}

export type FaqSortMode = 'default' | 'title-asc';

export const FAQ_SORT_OPTIONS: ReadonlyArray<{ value: FaqSortMode; label: string }> = [
  { value: 'default', label: 'Urutan Bawaan' },
  { value: 'title-asc', label: 'Pertanyaan (A–Z)' },
];

export function sortFaqItems(
  faqs: readonly FaqItem[],
  sortBy: FaqSortMode
): FaqItem[] {
  if (sortBy === 'default') {
    return [...faqs];
  }
  return [...faqs].sort((a, b) => a.pertanyaan.localeCompare(b.pertanyaan, 'id'));
}

export function generateNextNewsId(
  existingArticles: readonly Pick<NewsArticleItem, 'id'>[]
): string {
  let maxNumber = 0;
  for (const item of existingArticles) {
    const match = /^news-(\d+)$/i.exec(item.id.trim());
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  }
  return `news-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function slugifyNewsTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getNewsSlug(article: Pick<NewsArticleItem, 'judul' | 'id'>): string {
  return (
    slugifyNewsTitle(article.judul) ||
    slugifyNewsTitle(article.id) ||
    'berita-shansusdzar'
  );
}

export function isNewsSlugTaken(
  candidateTitle: string,
  currentArticleId: string,
  existingArticles: readonly Pick<NewsArticleItem, 'id' | 'judul'>[]
): boolean {
  const candidateSlug = slugifyNewsTitle(candidateTitle);
  if (!candidateSlug) return false;
  return existingArticles.some(
    (article) => article.id !== currentArticleId && getNewsSlug(article) === candidateSlug
  );
}

export function extractNewsCategories(articles: readonly NewsArticleItem[]): string[] {
  const seen = new Set<string>();
  const result = [ALL_NEWS_CATEGORIES];
  for (const item of articles) {
    const cat = item.kategori.trim();
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      result.push(cat);
    }
  }
  return result;
}

export function filterNewsArticles(
  articles: readonly NewsArticleItem[],
  category: string,
  searchQuery: string
): NewsArticleItem[] {
  const query = searchQuery.trim().toLowerCase();
  return [...articles]
    .filter((item) => {
      if (category !== ALL_NEWS_CATEGORIES && item.kategori.trim() !== category) return false;
      if (!query) return true;
      const haystack = [
        item.judul,
        item.ringkasan,
        item.kategori,
        ...item.kataKunciSeo,
        ...extractNewsPlainTextList(item.isi),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (a.unggulan !== b.unggulan) return a.unggulan ? -1 : 1;
      return b.tanggalTerbit.localeCompare(a.tanggalTerbit);
    });
}

export function estimateReadingMinutes(
  content: readonly (string | NewsArticleContentBlock)[]
): number {
  const words = extractNewsPlainTextList(content)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

const TIPS_INTERIOR_KEYWORDS = ['tips', 'panduan', 'edukasi', 'material', 'perawatan', 'interior'];

export function isTipsInteriorCategory(kategori: string): boolean {
  const cat = kategori.toLowerCase();
  return TIPS_INTERIOR_KEYWORDS.some((kw) => cat.includes(kw));
}

export function extractBeritaOnlyCategories(articles: readonly NewsArticleItem[]): string[] {
  const beritaArticles = articles.filter((item) => !isTipsInteriorCategory(item.kategori));
  return extractNewsCategories(beritaArticles);
}

export function filterBeritaOnlyArticles(
  articles: readonly NewsArticleItem[],
  category: string,
  searchQuery: string
): NewsArticleItem[] {
  const beritaArticles = articles.filter((item) => !isTipsInteriorCategory(item.kategori));
  return filterNewsArticles(beritaArticles, category, searchQuery);
}

export type BeritaSortMode = 'featured' | 'newest' | 'title-asc';

export const BERITA_SORT_OPTIONS: ReadonlyArray<{ value: BeritaSortMode; label: string }> = [
  { value: 'featured', label: 'Unggulan & Terbaru' },
  { value: 'newest', label: 'Terbaru' },
  { value: 'title-asc', label: 'Judul (A–Z)' },
];

export function sortBeritaArticles(
  articles: readonly NewsArticleItem[],
  sortBy: BeritaSortMode
): NewsArticleItem[] {
  if (sortBy === 'featured') {
    return [...articles];
  }
  if (sortBy === 'newest') {
    return [...articles].sort((a, b) => b.tanggalTerbit.localeCompare(a.tanggalTerbit));
  }
  return [...articles].sort((a, b) => a.judul.localeCompare(b.judul, 'id'));
}

export function selectPopularBeritaArticles(
  articles: readonly NewsArticleItem[],
  limit = 4,
  excludeIds: readonly string[] = []
): NewsArticleItem[] {
  const excluded = new Set(excludeIds);
  const beritaPool = articles.filter((item) => !isTipsInteriorCategory(item.kategori));
  const candidates = beritaPool.filter((item) => !excluded.has(item.id));
  const pool = candidates.length >= limit ? candidates : beritaPool;

  return [...pool]
    .sort((a, b) => {
      const scoreDiff =
        (b.kataKunciSeo.length + (b.unggulan ? 2 : 0)) -
        (a.kataKunciSeo.length + (a.unggulan ? 2 : 0));
      if (scoreDiff !== 0) return scoreDiff;
      return b.tanggalTerbit.localeCompare(a.tanggalTerbit);
    })
    .slice(0, limit);
}

export function extractTipsOnlyCategories(articles: readonly NewsArticleItem[]): string[] {
  const tipsArticles = articles.filter((item) => isTipsInteriorCategory(item.kategori));
  return extractNewsCategories(tipsArticles);
}

export function filterTipsOnlyArticles(
  articles: readonly NewsArticleItem[],
  category: string,
  searchQuery: string
): NewsArticleItem[] {
  const tipsArticles = articles.filter((item) => isTipsInteriorCategory(item.kategori));
  return filterNewsArticles(tipsArticles, category, searchQuery);
}

export function filterTipsInteriorArticles(articles: readonly NewsArticleItem[]): NewsArticleItem[] {
  const matching = articles.filter((item) => isTipsInteriorCategory(item.kategori));
  return (matching.length > 0 ? matching : [...articles]).sort((a, b) =>
    b.tanggalTerbit.localeCompare(a.tanggalTerbit)
  );
}

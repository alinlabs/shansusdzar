import type {
  FaqItem,
  MaterialCategory,
  MaterialSpecItem,
  NewsArticleItem,
} from '../types/cms';

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
    const haystack = [item.nama, item.ringkasan, item.tipsPerawatan, ...item.cocokUntuk]
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

export function extractNewsCategories(
  articles: readonly NewsArticleItem[],
  includeUnpublished = false
): string[] {
  const seen = new Set<string>();
  const result = [ALL_NEWS_CATEGORIES];
  for (const item of articles) {
    if (!includeUnpublished && !item.terbit) continue;
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
  searchQuery: string,
  includeUnpublished = false
): NewsArticleItem[] {
  const query = searchQuery.trim().toLowerCase();
  return [...articles]
    .filter((item) => {
      if (!includeUnpublished && !item.terbit) return false;
      if (category !== ALL_NEWS_CATEGORIES && item.kategori.trim() !== category) return false;
      if (!query) return true;
      const haystack = [
        item.judul,
        item.ringkasan,
        item.kategori,
        item.namaPenulis,
        ...item.kataKunciSeo,
        ...item.paragrafKonten,
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

export function slugifyNewsTitle(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'berita-shansusdzar';
}

export function estimateReadingMinutes(paragraphs: readonly string[]): number {
  const words = paragraphs
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

const TIPS_INTERIOR_KEYWORDS = ['tips', 'panduan', 'edukasi', 'material', 'perawatan', 'interior'];

export function filterTipsInteriorArticles(articles: readonly NewsArticleItem[]): NewsArticleItem[] {
  const published = articles.filter((item) => item.terbit);
  const matching = published.filter((item) => {
    const cat = item.kategori.toLowerCase();
    return TIPS_INTERIOR_KEYWORDS.some((kw) => cat.includes(kw));
  });
  return (matching.length > 0 ? matching : published).sort((a, b) =>
    b.tanggalTerbit.localeCompare(a.tanggalTerbit)
  );
}


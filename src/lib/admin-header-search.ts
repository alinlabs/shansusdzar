import { getNewsSlug } from './informasi-filter';
import { extractNewsPlainTextList } from './news-content';
import { getProductSlug } from './product-catalog';
import { formatUserSearchableAccessText } from './rbac';
import type {
  AdminUserAccount,
  FaqItem,
  MaterialCategory,
  MaterialSpecItem,
  NewsArticleItem,
  PortfolioCaseStudy,
} from '../types/cms';
import type { ProductItem } from '../types/product';

export type PublishStatusFilter = 'all' | 'terbit' | 'draft';

export function filterAdminCatalogProducts(
  products: readonly ProductItem[],
  searchQuery: string,
  categoryFilter: string
): ProductItem[] {
  const q = searchQuery.trim().toLowerCase();
  return products.filter((p) => {
    if (categoryFilter !== 'Semua' && p.kategori !== categoryFilter) return false;
    if (!q) return true;
    return `${p.nama} ${p.kategori} ${p.deskripsiSingkat} ${getProductSlug(p)}`
      .toLowerCase()
      .includes(q);
  });
}

export function filterAdminPortfolioProjects(
  projects: readonly PortfolioCaseStudy[],
  searchQuery: string
): PortfolioCaseStudy[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [...projects];
  return projects.filter((p) => {
    const reviewText = p.ulasan
      ? `${p.ulasan.sapaan ?? ''} ${p.ulasan.klien} ${p.ulasan.komentar}`
      : '';
    return `${p.judul} ${p.kategori} ${p.lokasi} ${reviewText}`
      .toLowerCase()
      .includes(q);
  });
}

export function filterAdminNewsArticles(
  articles: readonly NewsArticleItem[],
  options: {
    search: string;
    category: string;
  }
): NewsArticleItem[] {
  const q = options.search.trim().toLowerCase();
  return articles.filter((article) => {
    if (options.category !== 'Semua' && article.kategori !== options.category) return false;
    if (!q) return true;
    const bodyText = extractNewsPlainTextList(article.isi).join(' ');
    const hay = `${article.id} ${article.judul} ${article.kategori} ${getNewsSlug(article)} ${article.ringkasan} ${article.kataKunciSeo.join(' ')} ${bodyText}`.toLowerCase();
    return hay.includes(q);
  });
}

export function filterAdminMaterials(
  materials: readonly MaterialSpecItem[],
  options: {
    search: string;
    category: 'all' | MaterialCategory;
  }
): MaterialSpecItem[] {
  const q = options.search.trim().toLowerCase();
  return materials.filter((mat) => {
    if (options.category !== 'all' && mat.kategori !== options.category) return false;
    if (!q) return true;
    const catLabel = mat.kategori === 'papan' ? 'material utama' : 'finishing laminasi';
    const hay = `${mat.nama} ${catLabel} ${mat.ringkasan} ${mat.terbuatDari ?? ''} ${mat.cocokUntuk.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

export function filterAdminFaqs(
  faqs: readonly FaqItem[],
  options: {
    search: string;
    category: string;
    status: PublishStatusFilter;
  }
): FaqItem[] {
  const q = options.search.trim().toLowerCase();
  return faqs.filter((faq) => {
    if (options.category !== 'Semua' && faq.kategori !== options.category) return false;
    if (options.status === 'terbit' && !faq.terbit) return false;
    if (options.status === 'draft' && faq.terbit) return false;
    if (!q) return true;
    const hay = `${faq.pertanyaan} ${faq.jawaban} ${faq.kategori}`.toLowerCase();
    return hay.includes(q);
  });
}

export function filterAdminUsers(
  users: readonly AdminUserAccount[],
  searchQuery: string
): AdminUserAccount[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [...users];
  return users.filter((user) => {
    const accessText = formatUserSearchableAccessText(user);
    const hay = `${user.nama} ${user.email} ${user.divisi} ${accessText}`.toLowerCase();
    return hay.includes(q);
  });
}

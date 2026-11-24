import type { ClientReviewData, CustomInteriorPricingConfig, PortfolioCaseStudy } from '../types/cms';
import type { ProductItem } from '../types/product';
import { calculateCatalogVariantPrice } from './catalog-pricing';
import { getProductSlug, isVideoMediaUrl, parseReferenceSizeCm, resolveProductMediaEntry } from './product-catalog';
import { resolveVideoSource, type VisualMediaSlide } from './visual-media';

export const ALL_PORTFOLIO_CATEGORIES = 'Semua';
export const ALL_PORTFOLIO_YEARS = 'Semua';

export type PortfolioSortMode = 'order' | 'year-desc' | 'area-desc' | 'title-asc';

export interface PortfolioFilterOptions {
  searchQuery: string;
  category: string;
  year: string;
  sortBy: PortfolioSortMode;
  includeUnpublished?: boolean;
}

export interface PortfolioStatsSummary {
  totalProjects: number;
  categoriesCount: number;
  locationsCount: number;
  totalAreaSqm: number;
}

export interface PortfolioReviewStats {
  totalProjects: number;
  publishedProjects: number;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
}

export function deriveClientInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function hasVisiblePortfolioReview(project: PortfolioCaseStudy): boolean {
  const review = project.ulasan;
  if (!review || !review.tampil) return false;
  return review.namaPengulas.trim().length > 0 && review.komentar.trim().length > 0;
}

export function deriveReviewsFromPortfolio(
  projects: readonly PortfolioCaseStudy[]
): ClientReviewData[] {
  return [...projects]
    .filter((project) => project.terbit && hasVisiblePortfolioReview(project))
    .sort((a, b) => a.urutan - b.urutan)
    .map((project) => {
      const review = project.ulasan!;
      const namaPengulas = review.namaPengulas.trim();
      const rawInisial = review.inisial.trim().toUpperCase().slice(0, 3);
      const penilaian = Number.isFinite(review.penilaian)
        ? Math.max(1, Math.min(5, Math.round(review.penilaian)))
        : 5;
      const konteksParts = [project.judul.trim(), project.lokasi.trim() || project.kategori.trim()].filter(
        Boolean
      );

      return {
        id: project.id,
        namaKlien: namaPengulas,
        inisial: rawInisial || deriveClientInitials(namaPengulas),
        konteksProyek: konteksParts.join(' · '),
        penilaian,
        komentar: review.komentar.trim(),
        projectId: project.id,
        projectSlug: project.slug,
        projectTitle: project.judul,
        projectCategory: project.kategori,
        projectLocation: project.lokasi,
        projectImage: project.gambarUtama,
      };
    });
}

export function computePortfolioReviewStats(
  projects: readonly PortfolioCaseStudy[]
): PortfolioReviewStats {
  const publishedProjects = projects.filter((p) => p.terbit).length;
  const activeReviews = projects.filter((project) => hasVisiblePortfolioReview(project));

  if (activeReviews.length === 0) {
    return {
      totalProjects: projects.length,
      publishedProjects,
      totalReviews: 0,
      averageRating: 0,
      fiveStarCount: 0,
    };
  }

  const ratings = activeReviews.map((project) => {
    const score = project.ulasan?.penilaian ?? 5;
    return Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score))) : 5;
  });
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const fiveStarCount = ratings.filter((r) => r >= 5).length;

  return {
    totalProjects: projects.length,
    publishedProjects,
    totalReviews: activeReviews.length,
    averageRating: Math.round((sum / activeReviews.length) * 10) / 10,
    fiveStarCount,
  };
}

export function extractPortfolioCategories(projects: readonly PortfolioCaseStudy[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [ALL_PORTFOLIO_CATEGORIES];
  for (const project of projects) {
    const trimmed = project.kategori.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      categories.push(trimmed);
    }
  }
  return categories;
}

export function extractPortfolioYears(projects: readonly PortfolioCaseStudy[]): string[] {
  const years = Array.from(
    new Set(projects.map((p) => p.tahun.trim()).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  return [ALL_PORTFOLIO_YEARS, ...years];
}

export function filterPortfolioProjects(
  projects: readonly PortfolioCaseStudy[],
  options: PortfolioFilterOptions
): PortfolioCaseStudy[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = projects.filter((project) => {
    if (!options.includeUnpublished && !project.terbit) {
      return false;
    }

    if (
      options.category !== ALL_PORTFOLIO_CATEGORIES &&
      project.kategori.trim() !== options.category
    ) {
      return false;
    }

    if (options.year !== ALL_PORTFOLIO_YEARS && project.tahun.trim() !== options.year) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      project.judul,
      project.kategori,
      project.cakupan,
      project.namaKlien,
      project.lokasi,
      project.catatanMaterial,
      project.catatanFinishing,
      project.deskripsi,
      ...project.materialDigunakan,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'year-desc':
        return b.tahun.localeCompare(a.tahun) || a.urutan - b.urutan;
      case 'area-desc':
        return b.luasMeterPersegi - a.luasMeterPersegi || a.urutan - b.urutan;
      case 'title-asc':
        return a.judul.localeCompare(b.judul, 'id');
      case 'order':
      default:
        return a.urutan - b.urutan;
    }
  });
}

export function getPortfolioStats(projects: readonly PortfolioCaseStudy[]): PortfolioStatsSummary {
  const published = projects.filter((p) => p.terbit);
  const categories = new Set(published.map((p) => p.kategori.trim()).filter(Boolean));
  const locations = new Set(published.map((p) => p.lokasi.trim()).filter(Boolean));
  const totalAreaSqm = published.reduce(
    (sum, item) => sum + (Number.isFinite(item.luasMeterPersegi) ? Math.max(0, item.luasMeterPersegi) : 0),
    0
  );

  return {
    totalProjects: published.length,
    categoriesCount: categories.size,
    locationsCount: locations.size,
    totalAreaSqm,
  };
}

export function slugifyPortfolioTitle(title: string): string {
  const cleaned = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return cleaned || 'proyek-portofolio';
}

export function ensureUniquePortfolioSlug(
  candidateSlug: string,
  currentProjectId: string,
  existingProjects: readonly PortfolioCaseStudy[]
): string {
  const base = slugifyPortfolioTitle(candidateSlug);
  const usedSlugs = new Set(
    existingProjects
      .filter((p) => p.id !== currentProjectId)
      .map((p) => p.slug.trim().toLowerCase())
  );

  if (!usedSlugs.has(base)) return base;

  let counter = 2;
  while (usedSlugs.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export function resolveProductRealImageUrl(
  product: Pick<ProductItem, 'gambarSampul' | 'media'>
): string | null {
  const mediaImages: string[] = [];
  for (const entry of product.media ?? []) {
    const resolved = resolveProductMediaEntry(entry);
    if (resolved?.type === 'image') {
      mediaImages.push(resolved.url);
    }
  }

  const realWebpInMedia = mediaImages.find((url) => /-real\.webp(?:[?#].*)?$/i.test(url));
  if (realWebpInMedia) return realWebpInMedia;

  const cover = typeof product.gambarSampul === 'string' ? product.gambarSampul.trim() : '';
  if (cover && /-real\.webp(?:[?#].*)?$/i.test(cover)) return cover;

  const realAnyInMedia = mediaImages.find((url) => /-real\./i.test(url));
  if (realAnyInMedia) return realAnyInMedia;

  if (cover) return cover;
  return mediaImages[0] ?? null;
}

export function findMatchingProductForPortfolio(
  project: Pick<PortfolioCaseStudy, 'produkId' | 'slug' | 'judul'>,
  products: readonly ProductItem[]
): ProductItem | null {
  if (products.length === 0) return null;

  if (project.produkId) {
    const byId = products.find((p) => p.id === project.produkId);
    if (byId) return byId;
  }

  const normalizedProjectSlug = project.slug.trim().toLowerCase();
  const bySlug = products.find((p) => getProductSlug(p).toLowerCase() === normalizedProjectSlug);
  if (bySlug) return bySlug;

  const normalizedTitle = project.judul.trim().toLowerCase();
  const byExactName = products.find((p) => p.nama.trim().toLowerCase() === normalizedTitle);
  if (byExactName) return byExactName;

  return null;
}

export function resolvePortfolioReferencePrice(
  project: Pick<
    PortfolioCaseStudy,
    'referensiHarga' | 'ringkasanDimensi' | 'luasMeterPersegi' | 'catatanMaterial' | 'catatanFinishing'
  >,
  matchedProduct?: ProductItem | null,
  customPricing?: CustomInteriorPricingConfig | null
): number | null {
  if (
    typeof project.referensiHarga === 'number' &&
    Number.isFinite(project.referensiHarga) &&
    project.referensiHarga > 0
  ) {
    return Math.round(project.referensiHarga);
  }

  if (!matchedProduct) return null;

  const parsedDim = parseReferenceSizeCm(project.ringkasanDimensi);
  const areaSqm = parsedDim
    ? (parsedDim.lengthCm * parsedDim.widthCm) / 10000
    : Math.max(0.1, Number(project.luasMeterPersegi) || 1);
  const lengthCm = parsedDim ? parsedDim.lengthCm : 200;

  const variant = calculateCatalogVariantPrice({
    product: matchedProduct,
    areaSqm,
    lengthCm,
    materialLabel: project.catatanMaterial,
    finishLabel: project.catatanFinishing,
    siteCustomPricing: customPricing,
  });

  return variant.unitPrice > 0 ? Math.round(variant.unitPrice) : null;
}

export function syncPortfolioProjectsWithProducts(
  projects: readonly PortfolioCaseStudy[],
  products: readonly ProductItem[]
): PortfolioCaseStudy[] {
  if (products.length === 0) return [...projects];

  return projects.map((project) => {
    const matchedProduct = findMatchingProductForPortfolio(project, products);
    if (!matchedProduct) return project;

    const realImage = resolveProductRealImageUrl(matchedProduct);
    const resolvedPrice = resolvePortfolioReferencePrice(project, matchedProduct);

    return {
      ...project,
      produkId: matchedProduct.id,
      ...(resolvedPrice !== null ? { referensiHarga: resolvedPrice } : {}),
      ...(realImage
        ? {
            gambarUtama: realImage,
            galeriGambar: [realImage],
          }
        : {}),
    };
  });
}

const PORTFOLIO_PLACEHOLDER_SLOTS: ReadonlyArray<{ label: string; suffix: string }> = [
  { label: 'Dokumentasi Proses Workshop', suffix: 'proses' },
  { label: 'Detail Material & Finishing', suffix: 'material' },
  { label: 'Detail Sudut & Sambungan', suffix: 'detail' },
  { label: 'Tampak Terpasang di Lokasi', suffix: 'terpasang' },
];

export function buildPortfolioVisualSlides(
  project: PortfolioCaseStudy,
  matchedProduct?: ProductItem | null
): VisualMediaSlide[] {
  const galleryItems = Array.isArray(project.galeriGambar) ? project.galeriGambar : [];
  const primaryCandidate =
    (matchedProduct ? resolveProductRealImageUrl(matchedProduct) : null) ||
    (project.gambarUtama?.trim() && !isVideoMediaUrl(project.gambarUtama)
      ? project.gambarUtama.trim()
      : null) ||
    galleryItems.find((item) => typeof item === 'string' && item.trim() && !isVideoMediaUrl(item))?.trim() ||
    null;

  const slides: VisualMediaSlide[] = [
    {
      id: `${project.id}-slide-real`,
      kind: 'image',
      src: primaryCandidate,
      title: `Foto Real · ${project.judul}`,
      fallbackLabel: project.judul,
    },
  ];

  const seenVideoUrls = new Set<string>();
  const videoCandidates: Array<{ url: string; title?: string; poster?: string }> = [];

  for (const rawEntry of galleryItems) {
    if (typeof rawEntry !== 'string') continue;
    const trimmed = rawEntry.trim();
    if (!trimmed || !isVideoMediaUrl(trimmed)) continue;
    if (resolveVideoSource(trimmed).kind === 'invalid' || seenVideoUrls.has(trimmed)) continue;
    seenVideoUrls.add(trimmed);
    videoCandidates.push({ url: trimmed });
  }

  for (const mediaEntry of matchedProduct?.media ?? []) {
    const resolved = resolveProductMediaEntry(mediaEntry);
    if (!resolved || resolved.type !== 'video') continue;
    if (resolveVideoSource(resolved.url).kind === 'invalid' || seenVideoUrls.has(resolved.url)) {
      continue;
    }
    seenVideoUrls.add(resolved.url);
    videoCandidates.push({
      url: resolved.url,
      title: resolved.judul,
      poster: resolved.poster,
    });
  }

  videoCandidates.forEach((video, idx) => {
    slides.push({
      id: `${project.id}-slide-video-${idx + 1}`,
      kind: 'video',
      src: video.url,
      poster: video.poster || primaryCandidate || '/images/atelier-studio-craft.webp',
      title: video.title || `Video ${idx + 1} · ${project.judul}`,
    });
  });

  PORTFOLIO_PLACEHOLDER_SLOTS.forEach((slot) => {
    slides.push({
      id: `${project.id}-slide-placeholder-${slot.suffix}`,
      kind: 'image',
      src: null,
      title: `${slot.label} · ${project.judul}`,
      fallbackLabel: slot.label,
    });
  });

  return slides;
}

export interface PortfolioDesktopGridCell<T> {
  slide: T;
  slideIndex: number;
}

export interface PortfolioDesktopGridColumn<T> {
  top: PortfolioDesktopGridCell<T>;
  bottom: PortfolioDesktopGridCell<T> | null;
}

export function getPortfolioDesktopGridColumnIndex(slideIndex: number): number {
  if (slideIndex <= 0) return 0;
  if (slideIndex === 1) return 1;
  if (slideIndex === 2) return 0;
  if (slideIndex === 3) return 1;
  return 2 + Math.floor((slideIndex - 4) / 2);
}

export function buildPortfolioDesktopGridColumns<T>(
  slides: readonly T[]
): PortfolioDesktopGridColumn<T>[] {
  if (slides.length === 0) return [];

  const columns: PortfolioDesktopGridColumn<T>[] = [
    {
      top: { slide: slides[0], slideIndex: 0 },
      bottom: slides[2] !== undefined ? { slide: slides[2], slideIndex: 2 } : null,
    },
  ];

  if (slides.length > 1) {
    columns.push({
      top: { slide: slides[1], slideIndex: 1 },
      bottom: slides[3] !== undefined ? { slide: slides[3], slideIndex: 3 } : null,
    });
  }

  for (let i = 4; i < slides.length; i += 2) {
    columns.push({
      top: { slide: slides[i], slideIndex: i },
      bottom: slides[i + 1] !== undefined ? { slide: slides[i + 1], slideIndex: i + 1 } : null,
    });
  }

  return columns;
}

export function computeNextPortfolioGridStartCol(
  currentStartCol: number,
  activeSlideIndex: number,
  totalSlides: number
): number {
  if (totalSlides <= 4) return 0;
  const totalCols = 2 + Math.ceil((totalSlides - 4) / 2);
  const maxStartCol = Math.max(0, totalCols - 2);
  const clampedCurrent = Math.max(0, Math.min(maxStartCol, currentStartCol));
  const safeSlideIndex = Math.max(0, Math.min(totalSlides - 1, activeSlideIndex));
  const activeCol = getPortfolioDesktopGridColumnIndex(safeSlideIndex);

  if (activeCol < clampedCurrent) {
    return Math.max(0, Math.min(maxStartCol, activeCol));
  }
  if (activeCol > clampedCurrent + 1) {
    return Math.max(0, Math.min(maxStartCol, activeCol - 1));
  }
  return clampedCurrent;
}


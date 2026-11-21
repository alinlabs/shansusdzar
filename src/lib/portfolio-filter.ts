import type { ClientReviewData, PortfolioCaseStudy } from '../types/cms';

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


import type {
  ClientReviewData,
  CustomInteriorPricingConfig,
  PortfolioCaseStudy,
  PortfolioDimensionItem,
  PortfolioReviewData,
} from '../types/cms';
import type { ProductItem } from '../types/product';
import { calculateCatalogVariantPrice } from './catalog-pricing';
import { extractDimensionAreaPairCm } from './dimension-format';
import { getProductSlug, isVideoMediaUrl, resolveProductMediaEntry } from './product-catalog';
import { resolveVideoSource, type VisualMediaSlide } from './visual-media';

export const ALL_PORTFOLIO_CATEGORIES = 'Semua';
export const ALL_PORTFOLIO_YEARS = 'Semua';

export type PortfolioSortMode = 'random' | 'year-desc' | 'area-desc' | 'title-asc';

export interface PortfolioFilterOptions {
  searchQuery: string;
  category: string;
  year: string;
  sortBy: PortfolioSortMode;
  randomFn?: () => number;
}

export interface PortfolioReviewStats {
  totalProjects: number;
  totalReviews: number;
  averageRating: number;
  fiveStarCount: number;
}

export function shufflePortfolioProjects<T>(
  items: readonly T[],
  randomFn: () => number = Math.random
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const raw = randomFn();
    const bounded = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
    const j = Math.floor(bounded * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateNextPortfolioId(
  existingProjects: readonly Pick<PortfolioCaseStudy, 'id'>[]
): string {
  let maxNumber = 0;
  for (const item of existingProjects) {
    const match = /^port-(\d+)$/i.exec(item.id.trim());
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  }
  return `port-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function slugifyPortfolioTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getPortfolioSlug(
  project: Pick<PortfolioCaseStudy, 'judul' | 'id'>
): string {
  return (
    slugifyPortfolioTitle(project.judul) ||
    slugifyPortfolioTitle(project.id) ||
    'proyek-portofolio'
  );
}

export function isPortfolioSlugTaken(
  candidateTitle: string,
  currentProjectId: string,
  existingProjects: readonly Pick<PortfolioCaseStudy, 'id' | 'judul'>[]
): boolean {
  const candidateSlug = slugifyPortfolioTitle(candidateTitle);
  if (!candidateSlug) return false;
  return existingProjects.some(
    (project) =>
      project.id !== currentProjectId && getPortfolioSlug(project) === candidateSlug
  );
}

function toRoundedCm(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100) / 100;
}

export function normalizePortfolioDimensions(
  raw: unknown,
  legacyDimensionString?: unknown
): PortfolioDimensionItem[] {
  const items: PortfolioDimensionItem[] = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const panjang = toRoundedCm(rec.panjang);
      const lebar = toRoundedCm(rec.lebar);
      const tinggi = toRoundedCm(rec.tinggi);
      if (panjang > 0 || lebar > 0 || tinggi > 0) {
        items.push({ panjang, lebar, tinggi });
      }
    }
  }

  if (items.length > 0) return items;

  if (typeof legacyDimensionString === 'string' && legacyDimensionString.trim()) {
    const nums = legacyDimensionString
      .replace(/,/g, '.')
      .match(/\d+(?:\.\d+)?/g)
      ?.map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums && nums.length >= 3) {
      return [{ panjang: nums[0], lebar: nums[1], tinggi: nums[2] }];
    }
    const pair = extractDimensionAreaPairCm(legacyDimensionString);
    if (pair) {
      return [{ panjang: pair.lengthCm, lebar: 60, tinggi: pair.widthCm }];
    }
  }

  return [];
}

export function computePortfolioAreaSqm(
  dimensi: readonly PortfolioDimensionItem[] | undefined | null
): number {
  if (!Array.isArray(dimensi) || dimensi.length === 0) return 0;
  let totalSqm = 0;
  for (const item of dimensi) {
    const p = toRoundedCm(item?.panjang);
    const l = toRoundedCm(item?.lebar);
    const t = toRoundedCm(item?.tinggi);
    if (p <= 0) continue;
    const secondary = t > 0 ? t : l;
    if (secondary <= 0) continue;
    totalSqm += (p * secondary) / 10000;
  }
  return Math.round(totalSqm * 100) / 100;
}

export function getPortfolioPrimaryLengthCm(
  dimensi: readonly PortfolioDimensionItem[] | undefined | null
): number {
  if (!Array.isArray(dimensi) || dimensi.length === 0) return 200;
  let totalLength = 0;
  for (const item of dimensi) {
    const p = toRoundedCm(item?.panjang);
    if (p > 0) totalLength += p;
  }
  return totalLength > 0 ? totalLength : 200;
}

export function formatPortfolioDimensionSummary(
  dimensi: readonly PortfolioDimensionItem[] | undefined | null
): string {
  if (!Array.isArray(dimensi) || dimensi.length === 0) return '';
  return dimensi
    .filter(
      (d) =>
        d &&
        (toRoundedCm(d.panjang) > 0 || toRoundedCm(d.lebar) > 0 || toRoundedCm(d.tinggi) > 0)
    )
    .map((d) => `${toRoundedCm(d.panjang)} x ${toRoundedCm(d.lebar)} x ${toRoundedCm(d.tinggi)}`)
    .join(', ');
}

export const PORTFOLIO_CLIENT_SALUTATIONS = ['Ibu', 'Bpk.', 'Tn.', 'Ny.', 'Nn.'] as const;

const CLIENT_SALUTATION_PREFIX_RE = /^(ibu|bpk\.?|bapak|tn\.?|ny\.?|nn\.?)\s+(.+)$/i;

export function normalizePortfolioSalutation(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase().replace(/\.$/, '');
  if (lower === 'ibu') return 'Ibu';
  if (lower === 'bpk' || lower === 'bapak') return 'Bpk.';
  if (lower === 'tn' || lower === 'tuan') return 'Tn.';
  if (lower === 'ny' || lower === 'nyonya') return 'Ny.';
  if (lower === 'nn' || lower === 'nona') return 'Nn.';
  return trimmed;
}

export function extractPortfolioClientSalutation(rawClientName: string): {
  sapaan: string;
  klien: string;
} {
  const cleaned = cleanPortfolioClientName(rawClientName);
  if (!cleaned) return { sapaan: '', klien: '' };
  const match = CLIENT_SALUTATION_PREFIX_RE.exec(cleaned);
  if (!match) {
    return { sapaan: '', klien: cleaned };
  }
  return {
    sapaan: normalizePortfolioSalutation(match[1]),
    klien: match[2].trim(),
  };
}

export function formatPortfolioClientWithSalutation(
  ulasan?: Pick<PortfolioReviewData, 'sapaan' | 'klien'> | null
): string {
  if (!ulasan) return '';
  const klien = typeof ulasan.klien === 'string' ? ulasan.klien.trim() : '';
  if (!klien) return '';
  const sapaan = normalizePortfolioSalutation(ulasan.sapaan);
  return sapaan ? `${sapaan} ${klien}` : klien;
}

export function deriveClientInitials(name: string): string {
  const withoutSalutation = name
    .trim()
    .replace(/^(?:ibu|bpk\.?|bapak|tn\.?|ny\.?|nn\.?)\s+(?=\S)/i, '');
  const parts = withoutSalutation
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function hasVisiblePortfolioReview(project: PortfolioCaseStudy): boolean {
  const review = project.ulasan;
  if (!review) return false;
  return review.klien.trim().length > 0 && review.komentar.trim().length > 0;
}

export function deriveReviewsFromPortfolio(
  projects: readonly PortfolioCaseStudy[],
  randomFn: () => number = Math.random
): ClientReviewData[] {
  const validProjects = projects.filter((project) => hasVisiblePortfolioReview(project));
  return shufflePortfolioProjects(validProjects, randomFn).map((project) => {
    const review = project.ulasan!;
    const klien = review.klien.trim();
    const penilaian = Number.isFinite(review.penilaian)
      ? Math.max(1, Math.min(5, Math.round(review.penilaian)))
      : 5;
    const konteksParts = [
      project.judul.trim(),
      project.lokasi.trim() || project.kategori.trim(),
    ].filter(Boolean);

    return {
      id: project.id,
      namaKlien: klien,
      inisial: deriveClientInitials(klien),
      konteksProyek: konteksParts.join(' · '),
      penilaian,
      komentar: review.komentar.trim(),
      projectId: project.id,
      projectSlug: getPortfolioSlug(project),
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
  const activeReviews = projects.filter((project) => hasVisiblePortfolioReview(project));

  if (activeReviews.length === 0) {
    return {
      totalProjects: projects.length,
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
      formatPortfolioClientWithSalutation(project.ulasan),
      project.ulasan?.klien ?? '',
      project.lokasi,
      project.catatanMaterial,
      project.catatanFinishing,
      project.deskripsi,
      formatPortfolioDimensionSummary(project.dimensi),
      ...project.materialDigunakan,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  switch (options.sortBy) {
    case 'year-desc':
      return [...filtered].sort(
        (a, b) => b.tahun.localeCompare(a.tahun) || a.judul.localeCompare(b.judul, 'id')
      );
    case 'area-desc':
      return [...filtered].sort(
        (a, b) =>
          computePortfolioAreaSqm(b.dimensi) - computePortfolioAreaSqm(a.dimensi) ||
          a.judul.localeCompare(b.judul, 'id')
      );
    case 'title-asc':
      return [...filtered].sort((a, b) => a.judul.localeCompare(b.judul, 'id'));
    case 'random':
    default:
      return shufflePortfolioProjects(filtered, options.randomFn);
  }
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
  project: Pick<PortfolioCaseStudy, 'produkId' | 'judul'> & { id?: string },
  products: readonly ProductItem[]
): ProductItem | null {
  if (products.length === 0) return null;

  if (project.produkId) {
    const byId = products.find((p) => p.id === project.produkId);
    if (byId) return byId;
  }

  const normalizedTitleSlug = slugifyPortfolioTitle(project.judul);
  if (normalizedTitleSlug) {
    const bySlug = products.find((p) => getProductSlug(p).toLowerCase() === normalizedTitleSlug);
    if (bySlug) return bySlug;
  }

  const normalizedTitle = project.judul.trim().toLowerCase();
  const byExactName = products.find((p) => p.nama.trim().toLowerCase() === normalizedTitle);
  if (byExactName) return byExactName;

  return null;
}

export function resolvePortfolioReferencePrice(
  project: Pick<
    PortfolioCaseStudy,
    'referensiHarga' | 'dimensi' | 'catatanMaterial' | 'catatanFinishing'
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

  const computedArea = computePortfolioAreaSqm(project.dimensi);
  const areaSqm = computedArea > 0 ? computedArea : 1;
  const lengthCm = getPortfolioPrimaryLengthCm(project.dimensi);

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

const LEGACY_CLIENT_PREFIX_RE =
  /^(?:kediaman keluarga|kediaman|hunian|residence|studio kerja|perpustakaan pribadi|lobby kantor)\s+/i;

const LEGACY_PORTFOLIO_TITLES = new Set([
  'kitchen set (kabinet atas & bawah)',
  'island table / meja bar dapur',
  'lemari pakaian (wardrobe)',
  'backdrop tv ruang keluarga',
  'credenza / meja tv',
  'divan / rangka tempat tidur',
  'headboard dinding',
  'nakas (bedside table)',
  'meja rias kamar utama',
  'meja kerja / meja belajar',
  'rak buku / rak pajang (display)',
  'partisi / penyekat ruangan',
  'wall panel / kisi-kisi dinding',
  'kabinet bawah tangga',
  'lemari sepatu foyer',
  'kabinet wastafel kamar mandi (vanity)',
  'kabinet ruang cuci (laundry cabinet)',
  'meja resepsionis kantor / klinik',
  'meja resepsionis kantor/klinik',
  'meja kasir toko / kafe',
  'meja kasir toko/kafe',
  'booth pameran / gerai',
]);

export function cleanPortfolioClientName(name: string): string {
  return name.trim().replace(LEGACY_CLIENT_PREFIX_RE, '').trim();
}

export function syncPortfolioProjectsWithProducts(
  projects: readonly PortfolioCaseStudy[],
  products: readonly ProductItem[]
): PortfolioCaseStudy[] {
  if (products.length === 0) return [...projects];

  return projects.map((project) => {
    const matchedProduct = findMatchingProductForPortfolio(project, products);
    if (!matchedProduct) {
      return project;
    }

    const realImage = resolveProductRealImageUrl(matchedProduct);
    const hasCustomUploadedImage =
      typeof project.gambarUtama === 'string' && project.gambarUtama.trim().startsWith('data:');
    const resolvedPrice = resolvePortfolioReferencePrice(project, matchedProduct);
    const normalizedTitleKey = project.judul.trim().toLowerCase();
    const shouldSyncProductTitle =
      !normalizedTitleKey ||
      LEGACY_PORTFOLIO_TITLES.has(normalizedTitleKey) ||
      (/\([^)]*\)/.test(project.judul) && !/\([^)]*\)/.test(matchedProduct.nama));

    return {
      ...project,
      produkId: matchedProduct.id,
      ...(shouldSyncProductTitle ? { judul: matchedProduct.nama } : {}),
      ...(resolvedPrice !== null ? { referensiHarga: resolvedPrice } : {}),
      ...(!hasCustomUploadedImage && realImage
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

export function isDesktopPortfolioCardWide(index: number, totalCount: number): boolean {
  if (totalCount <= 1 || index < 0 || index >= totalCount) return false;
  if (totalCount % 2 === 1 && index === totalCount - 1) return false;

  const pairRow = Math.floor(index / 2);
  const posInPair = index % 2;
  return pairRow % 2 === 0 ? posInPair === 0 : posInPair === 1;
}

export interface PortfolioClientSummary {
  nama: string;
  inisial: string;
  lokasiTahun: string;
}

export function resolvePortfolioClientSummary(
  project: Pick<PortfolioCaseStudy, 'lokasi' | 'tahun' | 'ulasan'>
): PortfolioClientSummary {
  const rawKlien = project.ulasan?.klien?.trim() ?? '';
  const fullClientName = formatPortfolioClientWithSalutation(project.ulasan);
  const nama = fullClientName || 'Klien Shansus Dzar';
  const inisial = deriveClientInitials(rawKlien);
  const lokasiTahun = [project.lokasi.trim(), project.tahun.trim()].filter(Boolean).join(' · ');

  return {
    nama,
    inisial,
    lokasiTahun,
  };
}

export interface MobilePortfolioPartition {
  leadProject: PortfolioCaseStudy | null;
  horizontalProjects: PortfolioCaseStudy[];
  remainingProjects: PortfolioCaseStudy[];
}

export function partitionMobilePortfolioProjects(
  projects: readonly PortfolioCaseStudy[]
): MobilePortfolioPartition {
  if (projects.length === 0) {
    return {
      leadProject: null,
      horizontalProjects: [],
      remainingProjects: [],
    };
  }

  return {
    leadProject: projects[0],
    horizontalProjects: projects.slice(1, 5),
    remainingProjects: projects.slice(5),
  };
}

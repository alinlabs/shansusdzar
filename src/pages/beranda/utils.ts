import {
  DEFAULT_BERANDA_CONTENT,
  DEFAULT_PORTFOLIO_PROJECTS,
} from '../../lib/cms-defaults';
import { deriveReviewsFromPortfolio } from '../../lib/portfolio-filter';

export interface ValuePropositionItem {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  detail?: string;
}

export interface ProcessStepItem {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  detail?: string;
}

export interface PortfolioItem {
  id: string;
  judul: string;
  kategori: string;
  cakupan: string;
  catatanMaterial: string;
  deskripsi: string;
  gambarUtama: string;
  teksAlt: string;
}

export interface ClientReviewItem {
  id: string;
  namaKlien: string;
  inisial: string;
  konteksProyek: string;
  penilaian: number;
  komentar: string;
}

export const HERO_MEDIA = DEFAULT_BERANDA_CONTENT.mediaHero ?? {
  sumberVideo: '/hero.webm',
  sumberGambar: '/images/hero-interior-studio.webp',
};

export const BERANDA_DRAFT_COPY = {
  labelHero: DEFAULT_BERANDA_CONTENT.labelHero,
  judulHero: DEFAULT_BERANDA_CONTENT.judulHero,
  judulHeroBarisDua: DEFAULT_BERANDA_CONTENT.judulHeroBarisDua,
  deskripsiHero: DEFAULT_BERANDA_CONTENT.deskripsiHero,
  deskripsiHeroBarisDua: DEFAULT_BERANDA_CONTENT.deskripsiHeroBarisDua,
  labelPortofolio: DEFAULT_BERANDA_CONTENT.labelPortofolio,
  judulPortofolio: DEFAULT_BERANDA_CONTENT.judulPortofolio,
  labelUnggulan: DEFAULT_BERANDA_CONTENT.labelUnggulan,
  judulUnggulan: DEFAULT_BERANDA_CONTENT.judulUnggulan,
  labelKeunggulan: DEFAULT_BERANDA_CONTENT.labelKeunggulan,
  judulKeunggulan: DEFAULT_BERANDA_CONTENT.judulKeunggulan,
  labelProses: DEFAULT_BERANDA_CONTENT.labelProses,
  judulProses: DEFAULT_BERANDA_CONTENT.judulProses,
  deskripsiProses: DEFAULT_BERANDA_CONTENT.deskripsiProses,
  labelTestimoni: DEFAULT_BERANDA_CONTENT.labelTestimoni,
  judulTestimoni: DEFAULT_BERANDA_CONTENT.judulTestimoni,
} as const;

export const PORTFOLIO_ITEMS: PortfolioItem[] = DEFAULT_PORTFOLIO_PROJECTS
  .filter((item) => item.tampilDiBeranda)
  .map((item) => ({
    id: item.id,
    judul: item.judul,
    kategori: item.kategori,
    cakupan: item.cakupan,
    catatanMaterial: '',
    deskripsi: item.deskripsi,
    gambarUtama: item.gambarUtama,
    teksAlt: item.teksAlt,
  }));

export const VALUE_PROPOSITIONS_DRAFT: ValuePropositionItem[] =
  DEFAULT_BERANDA_CONTENT.daftarKeunggulan as ValuePropositionItem[];

export const PROCESS_STEPS_DRAFT: ProcessStepItem[] =
  DEFAULT_BERANDA_CONTENT.tahapanProses as ProcessStepItem[];

export const CLIENT_REVIEWS_DEMO: ClientReviewItem[] = deriveReviewsFromPortfolio(
  DEFAULT_PORTFOLIO_PROJECTS
);

export function getNextSlideIndex(currentIndex: number, totalItems: number): number {
  if (totalItems <= 0) return 0;
  return (currentIndex + 1) % totalItems;
}

export function getPrevSlideIndex(currentIndex: number, totalItems: number): number {
  if (totalItems <= 0) return 0;
  return (currentIndex - 1 + totalItems) % totalItems;
}

export function getVisibleCarouselWindow<T>(
  items: readonly T[],
  startIndex: number,
  visibleCount: number
): T[] {
  if (items.length === 0 || visibleCount <= 0) return [];
  const count = Math.min(visibleCount, items.length);
  const result: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = (((startIndex + i) % items.length) + items.length) % items.length;
    result.push(items[idx]);
  }
  return result;
}

export function pickRandomProducts<T>(
  items: readonly T[],
  count: number,
  randomFn: () => number = Math.random
): T[] {
  if (items.length === 0 || count <= 0) return [];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

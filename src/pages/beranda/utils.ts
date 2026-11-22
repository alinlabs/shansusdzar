import berandaContentData from '../../data/konten-beranda.json';
import berandaMediaData from '../../data/media-beranda.json';
import portfolioProjectsData from '../../data/proyek-portofolio.json';
import { deriveReviewsFromPortfolio } from '../../lib/portfolio-filter';
import type { PortfolioCaseStudy } from '../../types/cms';

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

export const HERO_MEDIA = berandaMediaData.mediaHero;

export const BERANDA_DRAFT_COPY = {
  labelHero: berandaContentData.labelHero,
  judulHero: berandaContentData.judulHero,
  judulHeroBarisDua: berandaContentData.judulHeroBarisDua,
  deskripsiHero: berandaContentData.deskripsiHero,
  deskripsiHeroBarisDua: berandaContentData.deskripsiHeroBarisDua,
  teksCtaUtamaHero: berandaContentData.teksCtaUtamaHero,
  teksCtaSekunderHero: berandaContentData.teksCtaSekunderHero,
  labelPortofolio: berandaContentData.labelPortofolio,
  judulPortofolio: berandaContentData.judulPortofolio,
  deskripsiPortofolio: berandaContentData.deskripsiPortofolio,
  labelUnggulan: berandaContentData.labelUnggulan,
  judulUnggulan: berandaContentData.judulUnggulan,
  deskripsiUnggulan: berandaContentData.deskripsiUnggulan,
  labelKeunggulan: berandaContentData.labelKeunggulan,
  judulKeunggulan: berandaContentData.judulKeunggulan,
  deskripsiKeunggulan: berandaContentData.deskripsiKeunggulan,
  labelProses: berandaContentData.labelProses,
  judulProses: berandaContentData.judulProses,
  deskripsiProses: berandaContentData.deskripsiProses,
  labelTestimoni: berandaContentData.labelTestimoni,
  judulTestimoni: berandaContentData.judulTestimoni,
  deskripsiTestimoni: berandaContentData.deskripsiTestimoni,
  judulCta: berandaContentData.judulCta,
  deskripsiCta: berandaContentData.deskripsiCta,
} as const;

export const PORTFOLIO_ITEMS: PortfolioItem[] = portfolioProjectsData
  .filter((item) => item.tampilDiBeranda && item.terbit)
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
  berandaContentData.daftarKeunggulan as ValuePropositionItem[];

export const PROCESS_STEPS_DRAFT: ProcessStepItem[] =
  berandaContentData.tahapanProses as ProcessStepItem[];

export const CLIENT_REVIEWS_DEMO: ClientReviewItem[] = deriveReviewsFromPortfolio(
  portfolioProjectsData as PortfolioCaseStudy[]
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

import colorPaletteJson from '../data/pilihan-warna.json';
import {
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  resolveCatalogStartingPrice,
} from '../lib/catalog-pricing';
import { createDefaultSiteContentBundle } from '../lib/cms-defaults';
import { stripNewsImageTags } from '../lib/news-content';
import { formatCurrencyIDR } from '../lib/price-format';
import {
  getDefaultProductCatalog,
  getProductCoverImage,
  getProductSlug,
} from '../lib/product-catalog';
import type {
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  PortfolioCaseStudy,
  SiteContentBundle,
} from '../types/cms';
import type { ProductItem } from '../types/product';
import { isFuzzyWordMatch, stemIndonesianWord } from './fuzzy-matcher';
import { normalizeIndonesianQuery, tokenizeIndonesianQuery } from './nlu';
import type {
  SainAiMaterialCard,
  SainAiPortfolioCard,
  SainAiProductCard,
} from './types';

export interface ColorPaletteOption {
  id: string;
  nama: string;
  hex: string;
  catatanNuansa: string;
}

export interface SainAiKnowledgeBase {
  bundle: SiteContentBundle;
  products: ProductItem[];
  portfolioProjects: PortfolioCaseStudy[];
  materials: MaterialSpecItem[];
  faqs: FaqItem[];
  articles: NewsArticleItem[];
  colors: ColorPaletteOption[];
  whatsappUrl: string;
}

export function buildKnowledgeBase(
  bundleInput?: SiteContentBundle,
  productsInput?: readonly ProductItem[]
): SainAiKnowledgeBase {
  const bundle = bundleInput ?? createDefaultSiteContentBundle();
  const baseProducts =
    productsInput && productsInput.length > 0
      ? [...productsInput]
      : [...getDefaultProductCatalog().daftarProduk];

  const portfolioProjects = [...bundle.portfolioProjects]
    .filter((item) => item.terbit !== false)
    .sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999));

  const faqs = [...bundle.faqs]
    .filter((item) => item.terbit !== false)
    .sort((a, b) => (a.urutan ?? 999) - (b.urutan ?? 999));

  const articles = [...bundle.newsArticles]
    .filter((item) => item.terbit !== false)
    .sort((a, b) => (b.tanggalTerbit ?? '').localeCompare(a.tanggalTerbit ?? ''));

  const colors = Array.isArray(colorPaletteJson.daftarWarna)
    ? (colorPaletteJson.daftarWarna as ColorPaletteOption[])
    : [];

  return {
    bundle,
    products: baseProducts,
    portfolioProjects,
    materials: [...bundle.materials],
    faqs,
    articles,
    colors,
    whatsappUrl: bundle.businessConfig.whatsapp.urlDasar,
  };
}

const PRODUCT_ALIAS_KEYWORDS: Record<string, string[]> = {
  'katalog-kitchen-set-01': ['kitchen', 'dapur', 'kabinet dapur', 'masak', 'pantry', 'sink', 'kompor'],
  'katalog-island-table-02': ['island', 'meja bar', 'mini bar', 'meja tengah'],
  'katalog-lemari-pakaian-03': ['lemari pakaian', 'wardrobe', 'lemari baju', 'gantungan baju', 'sliding'],
  'katalog-backdrop-tv-05': ['backdrop tv', 'panel tv', 'latar tv', 'ruang keluarga'],
  'katalog-credenza-meja-tv-06': ['bufet tv', 'buffet tv', 'bufet', 'credenza', 'meja tv', 'rak tv'],
  'katalog-divan-tempat-tidur-07': ['modern divan', 'divan', 'tempat tidur', 'ranjang', 'kasur', 'laci bawah kasur'],
  'katalog-headboard-dinding-08': ['headboard', 'sandaran kasur', 'sandaran tempat tidur'],
  'katalog-nakas-09': ['nakas', 'bedside', 'meja samping kasur'],
  'katalog-meja-rias-10': ['meja rias', 'meja dandan', 'meja makeup', 'cermin rias'],
  'katalog-meja-kerja-11': ['meja kerja', 'meja belajar', 'meja kantor', 'meja komputer', 'wfh'],
  'katalog-rak-buku-display-12': ['rak display', 'rak buku', 'rak pajang', 'display', 'lemari buku', 'rak koleksi'],
  'katalog-partisi-ruangan-13': ['partisi', 'penyekat', 'sekat ruangan', 'pembatas ruangan'],
  'katalog-wall-panel-14': ['wall panel', 'kisi', 'panel dinding', 'wpc'],
  'katalog-kabinet-bawah-tangga-15': ['bawah tangga', 'kabinet tangga', 'gudang tangga'],
  'katalog-lemari-sepatu-16': ['lemari sepatu', 'rak sepatu', 'tempat sepatu'],
  'katalog-vanity-kamar-mandi-17': ['vanity bathroom', 'vanity', 'kabinet wastafel', 'kamar mandi'],
  'katalog-laundry-cabinet-18': ['laundry', 'laundry cabinet', 'ruang cuci', 'mesin cuci'],
  'katalog-meja-resepsionis-19': ['resepsionis', 'meja lobi', 'lobby', 'klinik'],
  'katalog-meja-kasir-20': ['kasir', 'meja kasir', 'toko', 'kafe', 'cafe'],
  'katalog-booth-pameran-gerai-21': ['booth', 'booth pameran', 'gerai', 'pameran', 'stand', 'tenant'],
};

const SEARCH_STOPWORDS = new Set([
  'yang',
  'untuk',
  'dengan',
  'dari',
  'pada',
  'dalam',
  'atau',
  'dan',
  'ini',
  'itu',
  'ada',
  'bisa',
  'tidak',
  'bukan',
  'saja',
  'juga',
  'akan',
  'sudah',
  'belum',
  'kalau',
  'apakah',
  'bagaimana',
  'berapa',
  'dimana',
  'kapan',
  'siapa',
  'jual',
  'beli',
  'luar',
  'cari',
  'mau',
  'butuh',
  'tolong',
  'info',
  'tanya',
  'saya',
  'kami',
  'anda',
  'cukup',
  'budget',
  'anggaran',
  'dana',
  'maksimal',
  'nominal',
  'modal',
  'uang',
  'duit',
  'minimal',
  'juta',
  'ribu',
  'harga',
  'biaya',
  'estimasi',
  'tarif',
  'produk',
  'katalog',
  'unit',
  'rekomendasi',
  'semua',
  'apa',
  'buat',
  'pesan',
  'blockboard',
  'blokboard',
  'multipleks',
  'plywood',
  'triplek',
  'pvc',
  'hpl',
  'duco',
  'cat',
  'papan',
  'finishing',
  'pelapis',
  'laminasi',
  'motif',
  'ringan',
  'ekonomis',
  'kuat',
  'lembap',
  'basah',
  'meter',
  'lari',
  'persegi',
  'per',
  '18mm',
]);

function scoreFieldMatch(
  haystack: string,
  expandedTokens: readonly string[],
  rawNormalized: string
): number {
  const norm = normalizeIndonesianQuery(haystack);
  if (!norm) return 0;
  const targetWords = norm.split(/[\s,/.-]+/).filter((w) => w.length >= 3);
  const stemmedTargetWords = targetWords.map(stemIndonesianWord);

  let score = 0;
  if (rawNormalized.length >= 4 && norm.includes(rawNormalized)) {
    score += 12;
  }

  for (const token of expandedTokens) {
    if (token.length < 2 || /^\d+$/.test(token) || SEARCH_STOPWORDS.has(token)) continue;
    const stemmedTok = stemIndonesianWord(token);
    if (norm.includes(token)) {
      score += token.length >= 5 ? 3.5 : 2.2;
    } else if (stemmedTok.length >= 4 && stemmedTargetWords.includes(stemmedTok)) {
      score += 2.6;
    } else if (token.length >= 6 && targetWords.some((w) => isFuzzyWordMatch(token, w))) {
      score += 2.0;
    }
  }
  return score;
}

export function searchProductsInKnowledge(
  kb: SainAiKnowledgeBase,
  expandedTokens: readonly string[],
  rawNormalized: string,
  limit = 3,
  detectedRoom?: string | null
): ProductItem[] {
  const scored = kb.products.map((product) => {
    const slug = getProductSlug(product);
    const aliases = PRODUCT_ALIAS_KEYWORDS[product.id] ?? [];
    const searchable = [
      product.nama,
      product.kategori,
      product.deskripsiSingkat,
      slug,
      ...aliases,
      ...product.customisasi,
      ...product.include,
    ].join(' ');

    const nameScore = scoreFieldMatch(product.nama, expandedTokens, rawNormalized) * 2.1;
    const aliasScore = aliases.reduce((acc, alias) => {
      if (rawNormalized.includes(alias)) return acc + 9;
      return acc;
    }, 0);
    const categoryScore = scoreFieldMatch(product.kategori, expandedTokens, rawNormalized) * 1.4;
    const roomBonus = detectedRoom && product.kategori === detectedRoom ? 3.8 : 0;
    const bodyScore = scoreFieldMatch(searchable, expandedTokens, rawNormalized);

    return {
      product,
      score: nameScore + aliasScore + categoryScore + roomBonus + bodyScore,
    };
  });

  const matched = scored
    .filter((item) => item.score >= 3.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.product);

  return matched;
}

export function searchMaterialsInKnowledge(
  kb: SainAiKnowledgeBase,
  expandedTokens: readonly string[],
  rawNormalized: string,
  materialId?: 'blockboard' | 'multipleks' | 'pvc' | null,
  finishId?: 'hpl' | 'cat-duco' | null
): MaterialSpecItem[] {
  const explicitIds = new Set<string>();
  if (materialId === 'blockboard') explicitIds.add('mat-blockboard');
  if (materialId === 'multipleks') explicitIds.add('mat-multipleks');
  if (materialId === 'pvc') explicitIds.add('mat-pvc');
  if (finishId === 'hpl') explicitIds.add('fin-hpl');
  if (finishId === 'cat-duco') explicitIds.add('fin-cat-duco');

  const scored = kb.materials.map((mat) => {
    let score = explicitIds.has(mat.id) ? 20 : 0;
    const text = [
      mat.nama,
      mat.kategori,
      mat.ringkasan,
      mat.terbuatDari ?? '',
      ...(mat.kelebihan ?? []),
      ...(mat.cocokUntuk ?? []),
      mat.tipsPerawatan ?? '',
    ].join(' ');
    score += scoreFieldMatch(text, expandedTokens, rawNormalized);
    return { mat, score };
  });

  const matched = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.mat);

  if (matched.length > 0) {
    return matched.slice(0, 3);
  }
  return kb.materials.slice(0, 3);
}

export function searchPortfolioInKnowledge(
  kb: SainAiKnowledgeBase,
  expandedTokens: readonly string[],
  rawNormalized: string,
  limit = 2
): PortfolioCaseStudy[] {
  const scored = kb.portfolioProjects.map((project) => {
    const text = [
      project.judul,
      project.kategori,
      project.cakupan,
      project.lokasi,
      project.catatanMaterial,
      project.catatanFinishing,
      project.deskripsi,
      ...(project.materialDigunakan ?? []),
    ].join(' ');
    return {
      project,
      score: scoreFieldMatch(text, expandedTokens, rawNormalized),
    };
  });

  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.project);

  return matched.length > 0 ? matched : kb.portfolioProjects.slice(0, limit);
}

export function searchFaqsInKnowledge(
  kb: SainAiKnowledgeBase,
  expandedTokens: readonly string[],
  rawNormalized: string,
  limit = 2
): FaqItem[] {
  const queryTokens = tokenizeIndonesianQuery(rawNormalized);
  const allTokens = Array.from(new Set([...queryTokens, ...expandedTokens]));

  const scored = kb.faqs.map((faq) => {
    const questionScore = scoreFieldMatch(faq.pertanyaan, allTokens, rawNormalized) * 1.8;
    const answerScore = scoreFieldMatch(faq.jawaban, allTokens, rawNormalized);
    return {
      faq,
      score: questionScore + answerScore,
    };
  });

  return scored
    .filter((item) => item.score >= 4.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.faq);
}

export function searchArticlesInKnowledge(
  kb: SainAiKnowledgeBase,
  expandedTokens: readonly string[],
  rawNormalized: string,
  limit = 2
): NewsArticleItem[] {
  const scored = kb.articles.map((article) => {
    const plainBody = stripNewsImageTags(article.paragrafKonten.join(' '));
    const text = [
      article.judul,
      article.kategori,
      article.ringkasan,
      ...article.kataKunciSeo,
      plainBody,
    ].join(' ');
    return {
      article,
      score: scoreFieldMatch(text, expandedTokens, rawNormalized),
    };
  });

  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.article);

  return matched.length > 0 ? matched : kb.articles.slice(0, limit);
}

export function toProductCard(
  product: ProductItem,
  kb: SainAiKnowledgeBase
): SainAiProductCard {
  const starting = resolveCatalogStartingPrice(product, kb.bundle.customPricing);
  const materials = getAvailableMaterialLabelsFromTariff(product);
  const finishes = getAvailableFinishLabelsFromTariff(product);
  const unitLabel = product.meterLari ? 'per meter lari (/m)' : 'per meter persegi (/m²)';

  return {
    id: product.id,
    nama: product.nama,
    kategori: `${product.kategori} · ${materials.slice(0, 2).join('/')} · ${finishes.join('/')}`,
    startingPriceLabel: starting.label,
    promoLabel: starting.promoActive && starting.discountPercentLabel
      ? `Hemat ${starting.discountPercentLabel}`
      : null,
    unitLabel,
    gambar: getProductCoverImage(product) ?? '/images/atelier-studio-craft.webp',
    to: `/produk/${encodeURIComponent(getProductSlug(product))}`,
  };
}

export function toMaterialCard(mat: MaterialSpecItem): SainAiMaterialCard {
  return {
    id: mat.id,
    nama: mat.nama,
    kategori: mat.kategori,
    ringkasan: mat.ringkasan,
    ketahananLembap: mat.ketahananLembap,
    peringkatKeawetan: mat.peringkatKeawetan,
    keterjangkauan: mat.keterjangkauan,
    cocokUntuk: (mat.cocokUntuk ?? []).slice(0, 3),
    to: '/tips-interior',
  };
}

export function toPortfolioCard(project: PortfolioCaseStudy): SainAiPortfolioCard {
  return {
    id: project.id,
    judul: project.judul,
    kategori: project.kategori,
    lokasi: project.lokasi,
    durasi: project.durasi,
    dimensi: project.ringkasanDimensi,
    material: `${project.catatanMaterial} · ${project.catatanFinishing}`,
    hargaFormatted: formatCurrencyIDR(project.referensiHarga),
    gambar: project.gambarUtama,
    to: `/portofolio/${encodeURIComponent(project.slug)}`,
  };
}

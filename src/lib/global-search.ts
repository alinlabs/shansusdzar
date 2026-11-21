import { resolveCatalogStartingPrice } from './catalog-pricing';
import type {
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  OperationalInfo,
  PortfolioCaseStudy,
  ServicePolicyItem,
} from '../types/cms';
import type { ProductItem } from '../types/product';

export type SearchResultGroup = 'produk' | 'portofolio' | 'informasi';

export type SearchSourceKind =
  | 'produk'
  | 'portofolio'
  | 'berita'
  | 'material'
  | 'faq'
  | 'layanan';

export interface SearchDocument {
  id: string;
  group: SearchResultGroup;
  sourceKind: SearchSourceKind;
  badgeLabel: string;
  title: string;
  subtitle?: string;
  description: string;
  snippetSource: string;
  metaLabel?: string;
  to: string;
  image?: string;
  keywords: string[];
  searchableTitle: string;
  searchableKeywords: string;
  searchableBody: string;
  featured: boolean;
  priority: number;
}

export interface ScoredSearchResult extends SearchDocument {
  score: number;
  matchedTerms: string[];
}

export interface SearchIntentSuggestion {
  id: string;
  title: string;
  description: string;
  to: string;
  ctaLabel: string;
}

export type SearchFilterKey =
  | 'semua'
  | 'produk'
  | 'portofolio'
  | 'berita'
  | 'material'
  | 'faq'
  | 'layanan'
  | 'informasi';

export const SEARCH_FILTER_OPTIONS: Array<{
  id: SearchFilterKey;
  label: string;
  shortLabel: string;
}> = [
  { id: 'semua', label: 'Semua Hasil', shortLabel: 'Semua' },
  { id: 'produk', label: 'Produk Furniture', shortLabel: 'Produk' },
  { id: 'portofolio', label: 'Portofolio Proyek', shortLabel: 'Portofolio' },
  { id: 'berita', label: 'Berita & Artikel', shortLabel: 'Berita' },
  { id: 'material', label: 'Panduan Material', shortLabel: 'Material' },
  { id: 'faq', label: 'Tanya Jawab (FAQ)', shortLabel: 'FAQ' },
  { id: 'layanan', label: 'Layanan & Halaman', shortLabel: 'Layanan' },
];

const VALID_SEARCH_FILTERS: ReadonlySet<string> = new Set<SearchFilterKey>([
  'semua',
  'produk',
  'portofolio',
  'berita',
  'material',
  'faq',
  'layanan',
  'informasi',
]);

export function parseSearchFilterKey(raw: string | null | undefined): SearchFilterKey {
  if (raw === 'katalog') {
    return 'produk';
  }
  if (raw && VALID_SEARCH_FILTERS.has(raw)) {
    return raw as SearchFilterKey;
  }
  return 'semua';
}

export function filterSearchDocuments<T extends SearchDocument>(
  items: readonly T[],
  filterKey: SearchFilterKey
): T[] {
  if (filterKey === 'semua') return [...items];
  if (filterKey === 'produk' || filterKey === 'portofolio' || filterKey === 'informasi') {
    return items.filter((item) => item.group === filterKey);
  }
  return items.filter((item) => item.sourceKind === filterKey);
}

export interface GlobalSearchOutput {
  query: string;
  normalizedQuery: string;
  tokens: string[];
  expandedTokens: string[];
  results: ScoredSearchResult[];
  counts: {
    semua: number;
    produk: number;
    portofolio: number;
    informasi: number;
    berita: number;
    material: number;
    faq: number;
    layanan: number;
  };
  allDocuments: SearchDocument[];
  recommendedKeywords: string[];
  featuredRecommendations: {
    produk: SearchDocument[];
    portofolio: SearchDocument[];
    informasi: SearchDocument[];
  };
  intentSuggestion: SearchIntentSuggestion | null;
}

export interface BuildSearchIndexInput {
  products: readonly ProductItem[];
  portfolioProjects: readonly PortfolioCaseStudy[];
  newsArticles: readonly NewsArticleItem[];
  materials: readonly MaterialSpecItem[];
  faqs: readonly FaqItem[];
  policies?: readonly ServicePolicyItem[];
  operationalInfo?: OperationalInfo;
}

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  dapur: ['kitchen', 'kitchen set', 'pantry', 'island', 'sink', 'kabinet dapur'],
  kitchen: ['dapur', 'kitchen set', 'pantry', 'island', 'kabinet'],
  lemari: ['wardrobe', 'kabinet', 'pakaian', 'penyimpanan', 'storage'],
  wardrobe: ['lemari', 'pakaian', 'kamar tidur'],
  meja: ['desk', 'makan', 'kerja', 'belajar', 'bar', 'credenza', 'nakas', 'rias'],
  tamu: ['sofa', 'backdrop', 'tv', 'credenza', 'rak', 'partisi', 'ruang keluarga'],
  kamar: ['tidur', 'wardrobe', 'lemari', 'nakas', 'dipan', 'meja rias'],
  kantor: ['kerja', 'meeting', 'resepsionis', 'display', 'komersial'],
  harga: ['biaya', 'tarif', 'estimasi', 'kalkulator', 'custom', 'dp', 'pembayaran'],
  biaya: ['harga', 'tarif', 'estimasi', 'kalkulator', 'custom', 'dp'],
  estimasi: ['kalkulator', 'custom', 'harga', 'biaya', 'ukur', 'ukuran'],
  custom: ['kalkulator', 'estimasi', 'ukuran', 'desain', 'build', 'interior'],
  ukur: ['survei', 'pengukuran', 'dimensi', 'ukuran', 'estimasi', 'kalkulator'],
  survei: ['ukur', 'pengukuran', 'lokasi', 'jadwal', 'purwakarta', 'karawang', 'subang', 'bandung'],
  bahan: ['material', 'papan', 'multipleks', 'mdf', 'pvc', 'blockboard', 'particle board'],
  material: ['bahan', 'papan', 'multipleks', 'mdf', 'pvc', 'blockboard', 'particle board', 'hpl', 'duco', 'sheet'],
  finishing: ['laminasi', 'hpl', 'cat duco', 'duco', 'sheet'],
  hpl: ['finishing', 'laminasi', 'high pressure laminate', 'tahan gores'],
  duco: ['cat duco', 'finishing', 'cat semprot', 'premium'],
  pvc: ['tahan air', 'anti rayap', 'lembap', 'sink', 'dapur'],
  multipleks: ['plywood', 'kuat', 'kabinet', 'lemari'],
  pesan: ['pesanan', 'keranjang', 'order', 'pdf', 'whatsapp', 'konsultasi'],
  garansi: ['perawatan', 'engsel', 'hardware', 'perbaikan', 'layanan'],
};

const STOP_WORDS = new Set([
  'dan',
  'atau',
  'yang',
  'di',
  'ke',
  'dari',
  'untuk',
  'dengan',
  'pada',
  'ini',
  'itu',
  'apa',
  'cara',
  'bagaimana',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const rawTokens = normalized.split(' ').filter(Boolean);
  const meaningful = rawTokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return meaningful.length > 0 ? meaningful : rawTokens;
}

function expandTokensWithSynonyms(tokens: readonly string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const directSynonyms = KEYWORD_SYNONYMS[token];
    if (directSynonyms) {
      for (const syn of directSynonyms) {
        for (const sub of normalizeText(syn).split(' ')) {
          if (sub.length > 1) expanded.add(sub);
        }
      }
    }
    for (const [key, list] of Object.entries(KEYWORD_SYNONYMS)) {
      if (key !== token && list.some((entry) => normalizeText(entry) === token)) {
        expanded.add(key);
      }
    }
  }
  return Array.from(expanded);
}

function formatProductMetaLabel(product: ProductItem): string {
  const starting = resolveCatalogStartingPrice(product);
  return starting.isStartingFrom ? `Mulai ${starting.formattedAmount}` : starting.formattedAmount;
}

export function buildSearchDocuments(input: BuildSearchIndexInput): SearchDocument[] {
  const docs: SearchDocument[] = [];

  for (const product of input.products) {
    const colorNames = product.pilihanWarna.map((c) => c.nama);
    const customValues = product.opsiKustom.flatMap((opt) => [opt.label, ...opt.daftarNilai]);
    const keywords = Array.from(
      new Set([product.kategori, ...product.daftarMaterial, ...colorNames])
    ).filter(Boolean);
    const bodyText = [
      product.deskripsiSingkat,
      product.dimensi.catatan ?? '',
      ...product.daftarMaterial,
      ...colorNames,
      ...customValues,
    ].join(' ');

    docs.push({
      id: `produk:${product.id}`,
      group: 'produk',
      sourceKind: 'produk',
      badgeLabel: 'Produk',
      title: product.nama,
      subtitle: product.kategori,
      description: product.deskripsiSingkat,
      snippetSource: [
        product.nama,
        product.deskripsiSingkat,
        product.dimensi.catatan ?? '',
        ...product.daftarMaterial,
        ...colorNames,
        ...customValues,
      ]
        .filter(Boolean)
        .join(' · '),
      metaLabel: formatProductMetaLabel(product),
      to: `/produk/${encodeURIComponent(product.slug)}`,
      image: product.daftarGambar[0],
      keywords,
      searchableTitle: normalizeText(product.nama),
      searchableKeywords: normalizeText(keywords.join(' ')),
      searchableBody: normalizeText(bodyText),
      featured: product.unggulan,
      priority: product.unggulan ? 100 - product.urutan : 50 - product.urutan,
    });
  }

  for (const project of input.portfolioProjects) {
    if (!project.terbit) continue;
    const keywords = Array.from(
      new Set([project.kategori, project.lokasi, project.tahun, ...project.materialDigunakan])
    ).filter(Boolean);
    const bodyText = [
      project.cakupan,
      project.namaKlien,
      project.lokasi,
      project.catatanMaterial,
      project.catatanFinishing,
      project.deskripsi,
      project.tantangan,
      project.solusi,
      ...project.materialDigunakan,
    ].join(' ');

    docs.push({
      id: `portofolio:${project.id}`,
      group: 'portofolio',
      sourceKind: 'portofolio',
      badgeLabel: 'Portofolio',
      title: project.judul,
      subtitle: [project.kategori, project.lokasi].filter(Boolean).join(' · '),
      description: project.deskripsi,
      snippetSource: [
        project.judul,
        project.deskripsi,
        project.lokasi,
        project.catatanMaterial,
        project.catatanFinishing,
        project.solusi,
        ...project.materialDigunakan,
      ]
        .filter(Boolean)
        .join(' · '),
      metaLabel: [project.tahun, project.luasMeterPersegi ? `${project.luasMeterPersegi} m²` : '']
        .filter(Boolean)
        .join(' · '),
      to: `/portofolio/${project.slug}`,
      image: project.gambarUtama,
      keywords,
      searchableTitle: normalizeText(project.judul),
      searchableKeywords: normalizeText(keywords.join(' ')),
      searchableBody: normalizeText(bodyText),
      featured: project.tampilDiBeranda,
      priority: project.tampilDiBeranda ? 95 - project.urutan : 55 - project.urutan,
    });
  }

  for (const article of input.newsArticles) {
    if (!article.terbit) continue;
    const keywords = Array.from(new Set([article.kategori, ...article.kataKunciSeo])).filter(Boolean);
    const bodyText = [
      article.ringkasan,
      article.kategori,
      article.namaPenulis,
      article.deskripsiSeo,
      ...article.kataKunciSeo,
      ...article.paragrafKonten,
    ].join(' ');

    docs.push({
      id: `berita:${article.id}`,
      group: 'informasi',
      sourceKind: 'berita',
      badgeLabel: 'Berita & Artikel',
      title: article.judul,
      subtitle: `${article.kategori} · ${article.menitBaca} menit baca`,
      description: article.ringkasan,
      snippetSource: [article.judul, article.ringkasan, ...article.paragrafKonten]
        .filter(Boolean)
        .join(' '),
      metaLabel: article.tanggalTerbit,
      to: `/berita/${article.slug}`,
      image: article.gambarSampul,
      keywords,
      searchableTitle: normalizeText(article.judul),
      searchableKeywords: normalizeText(keywords.join(' ')),
      searchableBody: normalizeText(bodyText),
      featured: article.unggulan,
      priority: article.unggulan ? 90 : 60,
    });
  }

  for (const material of input.materials) {
    const categoryLabel = material.kategori === 'papan' ? 'Material Utama' : 'Finishing/Laminasi';
    const keywords = [categoryLabel, material.tingkatHarga, ...material.cocokUntuk];
    const bodyText = [
      material.nama,
      categoryLabel,
      material.tingkatHarga,
      material.ringkasan,
      material.tipsPerawatan,
      ...material.cocokUntuk,
    ].join(' ');

    docs.push({
      id: `material:${material.id}`,
      group: 'informasi',
      sourceKind: 'material',
      badgeLabel: 'Panduan Material',
      title: `${material.nama} (${categoryLabel})`,
      subtitle: `Kelas ${material.tingkatHarga} · Keawetan ${material.peringkatKeawetan}/5`,
      description: material.ringkasan,
      snippetSource: [
        material.nama,
        material.ringkasan,
        material.tipsPerawatan,
        ...material.cocokUntuk,
      ]
        .filter(Boolean)
        .join(' · '),
      metaLabel: material.cocokUntuk.slice(0, 2).join(', '),
      to: '/tips-interior',
      keywords,
      searchableTitle: normalizeText(material.nama),
      searchableKeywords: normalizeText(keywords.join(' ')),
      searchableBody: normalizeText(bodyText),
      featured: material.peringkatKeawetan >= 5,
      priority: 70 + material.peringkatKeawetan,
    });
  }

  for (const faq of input.faqs) {
    if (!faq.terbit) continue;
    const keywords = [faq.kategori, 'FAQ', 'pertanyaan'];
    docs.push({
      id: `faq:${faq.id}`,
      group: 'informasi',
      sourceKind: 'faq',
      badgeLabel: 'FAQ',
      title: faq.pertanyaan,
      subtitle: faq.kategori,
      description: faq.jawaban,
      snippetSource: [faq.pertanyaan, faq.jawaban].filter(Boolean).join(' — '),
      metaLabel: 'Tanya Jawab',
      to: '/faq',
      keywords,
      searchableTitle: normalizeText(faq.pertanyaan),
      searchableKeywords: normalizeText(keywords.join(' ')),
      searchableBody: normalizeText(`${faq.kategori} ${faq.jawaban}`),
      featured: faq.urutan <= 2,
      priority: 65 - faq.urutan,
    });
  }

  const servicePages: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    to: string;
    keywords: string[];
    featured: boolean;
    priority: number;
  }> = [
    {
      id: 'layanan:custom-interior',
      title: 'Kalkulator & Perencana Custom Interior',
      subtitle: 'Hitung Estimasi Biaya Desain, Build, atau Desain + Build',
      description:
        'Simulasikan kebutuhan ukuran bidang (m²), pilihan material utama (MDF, Blockboard, PVC, Multipleks, Particle Board), dan finishing/laminasi (Cat Duco, Sheet, HPL) untuk menghitung estimasi biaya dan DP proyek.',
      to: '/produk/custom',
      keywords: [
        'custom interior',
        'kalkulator harga',
        'estimasi biaya',
        'per meter persegi',
        'desain dan build',
        'uang muka dp',
      ],
      featured: true,
      priority: 92,
    },
    {
      id: 'layanan:pesanan',
      title: 'Pengajuan Pesanan & Dokumen PDF',
      subtitle: 'Ringkasan Keranjang & Konsultasi WhatsApp',
      description:
        'Tinjau unit katalog dan konfigurasi custom interior di keranjang, isi data kontak/lokasi survei, lalu unduh dokumen ringkasan PDF atau kirim via WhatsApp.',
      to: '/pesanan',
      keywords: ['pesanan', 'keranjang', 'order', 'pdf', 'whatsapp', 'checkout'],
      featured: false,
      priority: 72,
    },
    {
      id: 'layanan:tentang',
      title: 'Tentang Shansus Dzar Indonesia & Workshop',
      subtitle: 'Profil Studio, Tim, dan Alur Kerja',
      description:
        input.operationalInfo
          ? `Workshop interior design & building. Jam operasional: ${input.operationalInfo.jamOperasional}. Area survei: ${input.operationalInfo.areaJangkauanSurvei.join(', ')}.`
          : 'Mengenal profil Shansus Dzar Indonesia, standar produksi workshop, tim desain & lapangan, serta jangkauan area survei.',
      to: '/tentang',
      keywords: [
        'tentang studio',
        'workshop',
        'purwakarta',
        'jam operasional',
        'area survei',
        ...(input.operationalInfo?.areaJangkauanSurvei ?? []),
      ],
      featured: true,
      priority: 78,
    },
  ];

  for (const page of servicePages) {
    docs.push({
      id: page.id,
      group: 'informasi',
      sourceKind: 'layanan',
      badgeLabel: 'Layanan & Halaman',
      title: page.title,
      subtitle: page.subtitle,
      description: page.description,
      snippetSource: [page.title, page.description].filter(Boolean).join(' — '),
      metaLabel: 'Halaman Studio',
      to: page.to,
      keywords: page.keywords,
      searchableTitle: normalizeText(page.title),
      searchableKeywords: normalizeText(page.keywords.join(' ')),
      searchableBody: normalizeText(`${page.subtitle} ${page.description} ${page.keywords.join(' ')}`),
      featured: page.featured,
      priority: page.priority,
    });
  }

  if (input.policies && input.policies.length > 0) {
    for (const policy of input.policies) {
      docs.push({
        id: `kebijakan:${policy.id}`,
        group: 'informasi',
        sourceKind: 'layanan',
        badgeLabel: 'Standar Layanan',
        title: policy.judul,
        subtitle: 'Kebijakan & Komitmen Studio',
        description: policy.ringkasan,
        snippetSource: [policy.judul, policy.ringkasan, policy.rincian]
          .filter(Boolean)
          .join(' — '),
        metaLabel: 'Informasi Layanan',
        to: '/tips-interior',
        keywords: ['kebijakan', 'garansi', 'layanan', policy.judul],
        searchableTitle: normalizeText(policy.judul),
        searchableKeywords: normalizeText(`kebijakan layanan ${policy.judul}`),
        searchableBody: normalizeText(`${policy.ringkasan} ${policy.rincian}`),
        featured: false,
        priority: 45,
      });
    }
  }

  return docs;
}

function scoreDocument(
  doc: SearchDocument,
  normalizedQuery: string,
  primaryTokens: readonly string[],
  expandedTokens: readonly string[]
): { score: number; matchedTerms: string[] } {
  const normalizedVisible = normalizeText(doc.snippetSource);
  const hasVisibleDirectMatch =
    normalizedVisible.includes(normalizedQuery) ||
    primaryTokens.some((token) => normalizedVisible.includes(token));

  if (!hasVisibleDirectMatch) {
    return { score: 0, matchedTerms: [] };
  }

  let score = 0;
  const matchedTerms = new Set<string>();

  if (doc.searchableTitle === normalizedQuery) {
    score += 120;
    matchedTerms.add(normalizedQuery);
  } else if (doc.searchableTitle.startsWith(normalizedQuery)) {
    score += 85;
    matchedTerms.add(normalizedQuery);
  } else if (doc.searchableTitle.includes(normalizedQuery)) {
    score += 65;
    matchedTerms.add(normalizedQuery);
  }

  if (doc.searchableKeywords.includes(normalizedQuery)) {
    score += 48;
    matchedTerms.add(normalizedQuery);
  } else if (doc.searchableBody.includes(normalizedQuery)) {
    score += 28;
    matchedTerms.add(normalizedQuery);
  }

  let primaryMatches = 0;
  for (const token of primaryTokens) {
    let matchedToken = false;
    if (doc.searchableTitle.includes(token)) {
      score += 34;
      matchedToken = true;
    }
    if (doc.searchableKeywords.includes(token)) {
      score += 22;
      matchedToken = true;
    }
    if (doc.searchableBody.includes(token)) {
      score += 12;
      matchedToken = true;
    }
    if (matchedToken) {
      primaryMatches += 1;
      matchedTerms.add(token);
    }
  }

  if (primaryTokens.length > 1 && primaryMatches === primaryTokens.length) {
    score += 30;
  }

  const primarySet = new Set(primaryTokens);
  for (const syn of expandedTokens) {
    if (primarySet.has(syn)) continue;
    if (doc.searchableTitle.includes(syn)) {
      score += 14;
      matchedTerms.add(syn);
    } else if (doc.searchableKeywords.includes(syn)) {
      score += 9;
      matchedTerms.add(syn);
    } else if (doc.searchableBody.includes(syn)) {
      score += 4;
      matchedTerms.add(syn);
    }
  }

  if (score > 0 && doc.featured) {
    score += 4;
  }

  return {
    score,
    matchedTerms: Array.from(matchedTerms),
  };
}

function detectIntentSuggestion(
  normalizedQuery: string,
  tokens: readonly string[]
): SearchIntentSuggestion | null {
  if (!normalizedQuery) return null;
  const combined = new Set(tokens);

  const customSignals = [
    'custom',
    'kalkulator',
    'harga',
    'biaya',
    'estimasi',
    'tarif',
    'ukuran',
    'ukur',
    'meter',
    'dp',
  ];
  if (customSignals.some((signal) => combined.has(signal) || normalizedQuery.includes(signal))) {
    return {
      id: 'intent-custom-calculator',
      title: 'Butuh simulasi harga atau ukuran custom ruangan?',
      description:
        'Gunakan perencana Custom Interior untuk menghitung estimasi biaya desain, build, atau keduanya per meter persegi.',
      to: '/produk/custom',
      ctaLabel: 'Buka Kalkulator Custom',
    };
  }

  const materialSignals = [
    'material',
    'bahan',
    'papan',
    'mdf',
    'blockboard',
    'pvc',
    'multipleks',
    'particle',
    'finishing',
    'hpl',
    'duco',
    'sheet',
    'rayap',
    'lembap',
  ];
  if (materialSignals.some((signal) => combined.has(signal) || normalizedQuery.includes(signal))) {
    return {
      id: 'intent-material-guide',
      title: 'Membandingkan material utama & finishing/laminasi interior?',
      description:
        'Lihat matriks perbandingan ketahanan lembap, peringkat keawetan, dan tips perawatan MDF, Blockboard, PVC, Multipleks, serta finishing/laminasi HPL/Cat Duco/Sheet.',
      to: '/tips-interior',
      ctaLabel: 'Lihat Panduan Material',
    };
  }

  const surveySignals = [
    'survei',
    'lokasi',
    'purwakarta',
    'karawang',
    'subang',
    'bandung',
    'garansi',
    'durasi',
    'pembayaran',
    'termin',
  ];
  if (surveySignals.some((signal) => combined.has(signal) || normalizedQuery.includes(signal))) {
    return {
      id: 'intent-faq',
      title: 'Mencari informasi survei lokasi, garansi, atau termin?',
      description:
        'Temukan jawaban lengkap mengenai jadwal survei lapangan, durasi produksi workshop, dan ketentuan garansi.',
      to: '/faq',
      ctaLabel: 'Buka Halaman FAQ',
    };
  }

  return null;
}

export function extractRecommendedKeywords(
  docs: readonly SearchDocument[],
  query: string,
  results: readonly ScoredSearchResult[]
): string[] {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    const baseKeywords = [
      'Kitchen Set',
      'Wardrobe',
      'Credenza',
      'Custom Interior',
      'Multipleks',
      'PVC',
      'HPL',
      'Cat Duco',
      'Survei Lokasi',
      'Purwakarta',
    ];
    const dynamicFromDocs = docs
      .filter((doc) => doc.featured)
      .flatMap((doc) => doc.keywords)
      .map((kw) => kw.trim())
      .filter((kw) => kw.length >= 3 && kw.length <= 24);

    return Array.from(new Set([...baseKeywords, ...dynamicFromDocs])).slice(0, 10);
  }

  const related = new Set<string>();
  for (const item of results.slice(0, 8)) {
    for (const kw of item.keywords) {
      const cleaned = kw.trim();
      if (
        cleaned.length >= 2 &&
        cleaned.length <= 28 &&
        normalizeText(cleaned) !== normalizedQuery
      ) {
        related.add(cleaned);
      }
    }
  }

  const tokens = tokenizeSearchQuery(query);
  for (const token of tokens) {
    const syns = KEYWORD_SYNONYMS[token];
    if (syns) {
      for (const syn of syns) {
        if (normalizeText(syn) !== normalizedQuery) {
          related.add(syn.charAt(0).toUpperCase() + syn.slice(1));
        }
      }
    }
  }

  if (related.size === 0) {
    return ['Kitchen Set', 'Lemari Pakaian', 'Multipleks', 'HPL', 'Custom Interior', 'FAQ'];
  }

  return Array.from(related).slice(0, 8);
}

export function searchGlobalContent(
  input: BuildSearchIndexInput,
  query: string
): GlobalSearchOutput {
  const docs = buildSearchDocuments(input);
  const normalizedQuery = normalizeText(query);
  const tokens = tokenizeSearchQuery(query);
  const expandedTokens = expandTokensWithSynonyms(tokens);

  const featuredRecommendations = {
    produk: docs
      .filter((d) => d.group === 'produk')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.priority - a.priority)
      .slice(0, 4),
    portofolio: docs
      .filter((d) => d.group === 'portofolio')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.priority - a.priority)
      .slice(0, 3),
    informasi: docs
      .filter((d) => d.group === 'informasi')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.priority - a.priority)
      .slice(0, 4),
  };

  if (!normalizedQuery) {
    return {
      query,
      normalizedQuery,
      tokens: [],
      expandedTokens: [],
      results: [],
      counts: {
        semua: 0,
        produk: 0,
        portofolio: 0,
        informasi: 0,
        berita: 0,
        material: 0,
        faq: 0,
        layanan: 0,
      },
      allDocuments: docs,
      recommendedKeywords: extractRecommendedKeywords(docs, '', []),
      featuredRecommendations,
      intentSuggestion: null,
    };
  }

  const scoredResults: ScoredSearchResult[] = [];
  for (const doc of docs) {
    const { score, matchedTerms } = scoreDocument(doc, normalizedQuery, tokens, expandedTokens);
    if (score > 0) {
      scoredResults.push({
        ...doc,
        score,
        matchedTerms,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score || b.priority - a.priority);

  const counts = {
    semua: scoredResults.length,
    produk: scoredResults.filter((r) => r.group === 'produk').length,
    portofolio: scoredResults.filter((r) => r.group === 'portofolio').length,
    informasi: scoredResults.filter((r) => r.group === 'informasi').length,
    berita: scoredResults.filter((r) => r.sourceKind === 'berita').length,
    material: scoredResults.filter((r) => r.sourceKind === 'material').length,
    faq: scoredResults.filter((r) => r.sourceKind === 'faq').length,
    layanan: scoredResults.filter((r) => r.sourceKind === 'layanan').length,
  };

  return {
    query,
    normalizedQuery,
    tokens,
    expandedTokens,
    results: scoredResults,
    counts,
    allDocuments: docs,
    recommendedKeywords: extractRecommendedKeywords(docs, query, scoredResults),
    featuredRecommendations,
    intentSuggestion: detectIntentSuggestion(normalizedQuery, tokens),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectHighlightTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const tokens = tokenizeSearchQuery(trimmed);
  const combined = new Set<string>([trimmed, ...tokens]);
  return Array.from(combined)
    .map((t) => t.trim())
    .filter((t) => (trimmed.length === 1 ? t.length >= 1 : t.length >= 2))
    .sort((a, b) => b.length - a.length);
}

export function extractKeywordSnippet(
  doc: Pick<SearchDocument, 'description' | 'snippetSource'>,
  query: string,
  maxChars = 120
): string {
  const cleanSource = (doc.snippetSource || doc.description || '').replace(/\s+/g, ' ').trim();
  if (!cleanSource) return '';

  const terms = collectHighlightTerms(query);
  if (terms.length === 0) {
    return cleanSource.length > maxChars
      ? `${cleanSource.slice(0, maxChars).trimEnd()}...`
      : cleanSource;
  }

  const lowerSource = cleanSource.toLowerCase();
  let earliestIndex = -1;

  for (const term of terms) {
    const idx = lowerSource.indexOf(term.toLowerCase());
    if (idx !== -1 && (earliestIndex === -1 || idx < earliestIndex)) {
      earliestIndex = idx;
    }
  }

  if (earliestIndex === -1 || earliestIndex < 24) {
    if (cleanSource.length <= maxChars) return cleanSource;
    const cut = cleanSource.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    const safeCut = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
    return `${safeCut.trimEnd()}...`;
  }

  let start = Math.max(0, earliestIndex - 16);
  if (start > 0) {
    const nextSpace = cleanSource.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < earliestIndex) {
      start = nextSpace + 1;
    }
  }

  let end = Math.min(cleanSource.length, start + maxChars);
  if (end < cleanSource.length) {
    const lastSpace = cleanSource.lastIndexOf(' ', end);
    if (lastSpace > earliestIndex) {
      end = lastSpace;
    }
  }

  const prefix = start > 0 ? '... ' : '';
  const suffix = end < cleanSource.length ? '...' : '';
  return `${prefix}${cleanSource.slice(start, end).trim()}${suffix}`;
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const terms = collectHighlightTerms(query);
  if (terms.length === 0) {
    return [{ text, highlighted: false }];
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);
  const termSet = new Set(terms.map((t) => t.toLowerCase()));

  const segments: HighlightSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    segments.push({
      text: part,
      highlighted: termSet.has(part.toLowerCase()),
    });
  }
  return segments;
}


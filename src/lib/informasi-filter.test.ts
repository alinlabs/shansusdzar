import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG } from './business-config';
import { DEFAULT_FAQS, DEFAULT_MATERIAL_SPECS, DEFAULT_NEWS_ARTICLES } from './cms-defaults';
import {
  ALL_FAQ_CATEGORIES,
  ALL_NEWS_CATEGORIES,
  estimateReadingMinutes,
  extractFaqCategories,
  extractNewsCategories,
  filterFaqItems,
  filterMaterialSpecs,
  filterNewsArticles,
  filterTipsInteriorArticles,
  slugifyNewsTitle,
} from './informasi-filter';
import {
  buildArticleJsonLd,
  buildBeritaListJsonLd,
  buildFaqPageJsonLd,
  buildInformasiHubJsonLd,
  buildTipsInteriorJsonLd,
} from './seo-schema';

test('filterMaterialSpecs exposes strictly 3 bahan dasar and 2 finishing and filters cleanly', () => {
  const boards = filterMaterialSpecs(DEFAULT_MATERIAL_SPECS, 'papan', '');
  assert.deepEqual(
    boards.map((m) => m.nama),
    ['Blockboard', 'Multipleks', 'PVC Board']
  );

  const finishes = filterMaterialSpecs(DEFAULT_MATERIAL_SPECS, 'finishing', '');
  assert.deepEqual(
    finishes.map((m) => m.nama),
    ['HPL', 'Cat Duco']
  );

  const pvc = filterMaterialSpecs(DEFAULT_MATERIAL_SPECS, 'all', 'tahan air');
  assert.ok(pvc.some((m) => m.id === 'mat-pvc'));
});

test('filterFaqItems filters published FAQs by category and query', () => {
  const categories = extractFaqCategories(DEFAULT_FAQS);
  assert.equal(categories[0], ALL_FAQ_CATEGORIES);

  const sample = [
    ...DEFAULT_FAQS,
    {
      id: 'faq-hidden',
      kategori: 'Garansi & Perawatan',
      pertanyaan: 'Draft pertanyaan tersembunyi',
      jawaban: 'Belum terbit',
      urutan: 99,
      terbit: false,
    },
  ];

  const publicResult = filterFaqItems(sample, ALL_FAQ_CATEGORIES, '');
  assert.equal(publicResult.some((f) => f.id === 'faq-hidden'), false);

  const searchResult = filterFaqItems(sample, ALL_FAQ_CATEGORIES, 'pvc');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].id, 'faq-material-dapur');
});

test('filterNewsArticles excludes drafts unless requested and matches SEO keywords', () => {
  const categories = extractNewsCategories(DEFAULT_NEWS_ARTICLES);
  assert.equal(categories[0], ALL_NEWS_CATEGORIES);
  assert.ok(categories.includes('Edukasi Material'));

  const sample = [
    ...DEFAULT_NEWS_ARTICLES,
    {
      ...DEFAULT_NEWS_ARTICLES[0],
      id: 'news-draft',
      slug: 'draft-internal',
      judul: 'Rencana Produksi Internal',
      terbit: false,
    },
  ];

  const publicNews = filterNewsArticles(sample, ALL_NEWS_CATEGORIES, '');
  assert.equal(publicNews.some((n) => n.id === 'news-draft'), false);

  const keywordMatch = filterNewsArticles(sample, ALL_NEWS_CATEGORIES, 'kitchen set purwakarta');
  assert.ok(keywordMatch.some((n) => n.id === 'news-kitchen-set-purwakarta'));
});

test('filterTipsInteriorArticles prioritizes interior tips and material guides', () => {
  const tips = filterTipsInteriorArticles(DEFAULT_NEWS_ARTICLES);
  assert.ok(tips.length >= 2);
  assert.ok(tips.some((t) => t.kategori === 'Tips Interior' || t.kategori === 'Edukasi Material'));

  const allPublished = filterNewsArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.ok(allPublished.some((t) => t.kategori === 'Kabar Workshop'));
  assert.equal(allPublished.length, DEFAULT_NEWS_ARTICLES.filter((a) => a.terbit).length);
});

test('slugifyNewsTitle and estimateReadingMinutes produce clean SEO values', () => {
  assert.equal(
    slugifyNewsTitle('Tips Memilih Kitchen Set Anti-Rayap 2026!'),
    'tips-memilih-kitchen-set-anti-rayap-2026'
  );
  assert.equal(estimateReadingMinutes(['Kata singkat']), 1);
  assert.equal(estimateReadingMinutes([new Array(380).fill('interior').join(' ')]), 3);
});

test('SEO Schema builders output valid Article, Berita, Tips Interior, and FAQPage data', () => {
  const origin = 'https://sdi-furniture.vercel.app';
  const articleSchema = buildArticleJsonLd(DEFAULT_NEWS_ARTICLES[0], BUSINESS_CONFIG, origin);
  assert.equal(articleSchema['@type'], 'Article');
  assert.equal(articleSchema['inLanguage'], 'id-ID');
  assert.equal(
    (articleSchema.mainEntityOfPage as { '@id': string })['@id'],
    `${origin}/berita/${DEFAULT_NEWS_ARTICLES[0].slug}`
  );

  const beritaSchema = buildBeritaListJsonLd(DEFAULT_NEWS_ARTICLES, BUSINESS_CONFIG, origin);
  assert.equal(beritaSchema['@type'], 'CollectionPage');

  const tipsSchema = buildTipsInteriorJsonLd(DEFAULT_NEWS_ARTICLES, BUSINESS_CONFIG, origin);
  assert.equal(tipsSchema['@type'], 'CollectionPage');

  const faqSchema = buildFaqPageJsonLd(DEFAULT_FAQS, origin);
  assert.equal(faqSchema['@type'], 'FAQPage');
  assert.ok(Array.isArray(faqSchema['mainEntity']));

  const hubSchema = buildInformasiHubJsonLd(
    DEFAULT_NEWS_ARTICLES,
    DEFAULT_FAQS,
    BUSINESS_CONFIG,
    origin
  );
  assert.ok(Array.isArray(hubSchema['@graph']));
});

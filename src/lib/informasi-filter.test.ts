import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_CONFIG } from './business-config';
import { DEFAULT_FAQS, DEFAULT_MATERIAL_SPECS, DEFAULT_NEWS_ARTICLES } from './cms-defaults';
import {
  ALL_FAQ_CATEGORIES,
  ALL_NEWS_CATEGORIES,
  estimateReadingMinutes,
  extractBeritaOnlyCategories,
  extractFaqCategories,
  extractNewsCategories,
  extractTipsOnlyCategories,
  filterBeritaOnlyArticles,
  filterFaqItems,
  filterMaterialSpecs,
  filterNewsArticles,
  filterTipsInteriorArticles,
  filterTipsOnlyArticles,
  isTipsInteriorCategory,
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

  const jamMatches = filterFaqItems(DEFAULT_FAQS, ALL_FAQ_CATEGORIES, '07.00');
  assert.ok(jamMatches.some((f) => f.id === 'faq-jam-layanan'));

  const areaMatches = filterFaqItems(DEFAULT_FAQS, ALL_FAQ_CATEGORIES, 'karawang');
  assert.ok(areaMatches.some((f) => f.id === 'faq-area-jangkauan'));

  const terminMatches = filterFaqItems(DEFAULT_FAQS, ALL_FAQ_CATEGORIES, 'termin');
  assert.ok(terminMatches.some((f) => f.id === 'faq-pembayaran'));
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

test('filterBeritaOnlyArticles and filterTipsOnlyArticles strictly separate berita and tips', () => {
  const beritaCats = extractBeritaOnlyCategories(DEFAULT_NEWS_ARTICLES);
  const tipsCats = extractTipsOnlyCategories(DEFAULT_NEWS_ARTICLES);

  assert.ok(beritaCats.includes('Kabar Workshop'));
  assert.equal(beritaCats.some((c) => isTipsInteriorCategory(c)), false);
  assert.ok(tipsCats.includes('Tips Interior'));
  assert.equal(tipsCats.includes('Kabar Workshop'), false);

  const beritaList = filterBeritaOnlyArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  const tipsList = filterTipsOnlyArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');

  assert.ok(beritaList.length >= 3);
  assert.ok(tipsList.length >= 3);
  assert.equal(beritaList.some((a) => isTipsInteriorCategory(a.kategori)), false);
  assert.equal(tipsList.every((a) => isTipsInteriorCategory(a.kategori)), true);
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
  const origin = 'https://shansusdzar.vercel.app';
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

import {
  buildNewsImageTagsMarkup,
  parseNewsContentBlocks,
  resolveNewsImageGroupLayout,
  sanitizeNewsImageUrl,
  stripNewsImageTags,
} from './news-content';

test('parseNewsContentBlocks handles inline, trailing, spaced, multiple, and unsafe <image> tags', () => {
  assert.equal(sanitizeNewsImageUrl(' https://contoh.png '), 'https://contoh.png/');
  assert.equal(sanitizeNewsImageUrl('/sample-produk/gambar/kitchen-set-real.webp'), '/sample-produk/gambar/kitchen-set-real.webp');
  assert.equal(sanitizeNewsImageUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeNewsImageUrl('//evil.example/img.png'), null);

  const blocks = parseNewsContentBlocks([
    'Penjelasan awal produksi. <image>https://contoh.png </image> Lanjutan penjelasan.',
    'Penjelasan kedua. <image>/sample-produk/gambar/a.webp</image> <image>/sample-produk/gambar/b.webp</image>',
    '<image>/sample-produk/gambar/c.webp</image>',
    'Kalimat dengan tag tidak aman <image>javascript:alert(1)</image> tetap utuh.',
  ]);

  assert.deepEqual(blocks, [
    { type: 'paragraph', text: 'Penjelasan awal produksi.' },
    { type: 'image-group', images: [{ url: 'https://contoh.png/' }] },
    { type: 'paragraph', text: 'Lanjutan penjelasan.' },
    { type: 'paragraph', text: 'Penjelasan kedua.' },
    {
      type: 'image-group',
      images: [
        { url: '/sample-produk/gambar/a.webp' },
        { url: '/sample-produk/gambar/b.webp' },
        { url: '/sample-produk/gambar/c.webp' },
      ],
    },
    {
      type: 'paragraph',
      text: 'Kalimat dengan tag tidak aman tetap utuh.',
    },
  ]);

  assert.equal(
    stripNewsImageTags('Teks <image>https://contoh.png </image> akhir'),
    'Teks akhir'
  );
});

test('parseNewsContentBlocks & resolveNewsImageGroupLayout support full, fit, crop modes and 1/2/3 grids', () => {
  const blocks = parseNewsContentBlocks([
    '<image mode="full" ratio="16/9" caption="Detail penuh workshop">/sample-produk/gambar/kitchen-set-detail.webp</image> <image grid="3" mode="crop" ratio="4/3" caption="Tiga variasi panel">/sample-produk/gambar/a.webp</image> <image grid="3" mode="crop" ratio="4/3">/sample-produk/gambar/b.webp</image> <image grid="3" mode="crop" ratio="4/3">/sample-produk/gambar/c.webp</image>',
    '<image mode="fit" caption="Proporsi asli">/images/promo-interior-banner.webp</image>',
  ]);

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'image-group');
  assert.equal(blocks[1].type, 'image-group');
  assert.equal(blocks[2].type, 'image-group');

  if (blocks[0].type === 'image-group' && blocks[1].type === 'image-group' && blocks[2].type === 'image-group') {
    const fullLayout = resolveNewsImageGroupLayout(blocks[0]);
    assert.equal(fullLayout.mode, 'full');
    assert.equal(fullLayout.isFullBleed, true);
    assert.equal(fullLayout.grid, '1');
    assert.equal(blocks[0].caption, 'Detail penuh workshop');

    const grid3Layout = resolveNewsImageGroupLayout(blocks[1]);
    assert.equal(grid3Layout.mode, 'crop');
    assert.equal(grid3Layout.grid, '3');
    assert.equal(grid3Layout.ratio, '4/3');
    // Maksimal 2 kolom di mobile (grid-cols-2), 3 kolom di desktop (md:grid-cols-3)
    assert.ok(grid3Layout.gridClassName.includes('grid-cols-2'));
    assert.ok(grid3Layout.gridClassName.includes('md:grid-cols-3'));

    const fitLayout = resolveNewsImageGroupLayout(blocks[2]);
    assert.equal(fitLayout.mode, 'fit');
    assert.equal(fitLayout.isFullBleed, false);
  }

  const markup = buildNewsImageTagsMarkup({
    urls: ['/a.webp', '/b.webp', '/c.webp'],
    mode: 'crop',
    ratio: '4/3',
    grid: '3',
    caption: 'Galeri proyek',
  });
  assert.ok(markup.includes('grid="3"'));
  assert.ok(markup.includes('ratio="4/3"'));
  assert.ok(markup.includes('caption="Galeri proyek"'));
  assert.equal(stripNewsImageTags(markup), '');
});

test('Berita JSON entries omit namaPenulis and menitBaca while preserving customized image blocks', () => {
  const beritaEntries = DEFAULT_NEWS_ARTICLES.filter((a) => !isTipsInteriorCategory(a.kategori));
  assert.ok(beritaEntries.length >= 4);
  for (const item of beritaEntries) {
    const raw = item as unknown as Record<string, unknown>;
    assert.equal(raw.namaPenulis, undefined);
    assert.equal(raw.menitBaca, undefined);
    assert.ok(parseNewsContentBlocks(item.paragrafKonten).some((b) => b.type === 'image-group'));
  }

  const leadBlocks = parseNewsContentBlocks(beritaEntries[0].paragrafKonten);
  assert.ok(
    leadBlocks.some((b) => b.type === 'image-group' && b.mode === 'full'),
    'Lead berita demonstrates full-bleed inline image'
  );
  assert.ok(
    leadBlocks.some((b) => b.type === 'image-group' && b.grid === '3' && b.images.length === 3),
    'Lead berita demonstrates 3-grid horizontal card row'
  );
});

test('Enriched materials expose terbuatDari details, 3 0-100 indicators, and buildTipsInteriorJsonLd lists material/finishing URLs', () => {
  for (const mat of DEFAULT_MATERIAL_SPECS) {
    assert.ok(mat.terbuatDari && mat.terbuatDari.length > 20, `${mat.nama} should explain terbuatDari`);
    assert.ok(mat.tipsPerawatan && mat.tipsPerawatan.length >= 160, `${mat.nama} should include detailed tipsPerawatan`);
    assert.equal(mat.cocokUntuk.length, 5, `${mat.nama} should list strictly 5 cocokUntuk items`);
    assert.ok(mat.kelebihan && mat.kelebihan.length >= 2, `${mat.nama} should include kelebihan`);
    assert.ok(mat.ketahananLembap >= 0 && mat.ketahananLembap <= 100 && mat.ketahananLembap > 5);
    assert.ok(mat.peringkatKeawetan >= 0 && mat.peringkatKeawetan <= 100 && mat.peringkatKeawetan > 5);
    assert.ok(
      typeof mat.keterjangkauan === 'number' &&
        mat.keterjangkauan >= 0 &&
        mat.keterjangkauan <= 100
    );
    const rawMat = mat as unknown as Record<string, unknown>;
    assert.equal(rawMat.ketahananPermukaan, undefined);
    assert.equal(rawMat.tingkatHarga, undefined);
    assert.equal(rawMat.ketebalanStandar, undefined);
    assert.equal(rawMat.catatanPenggunaan, undefined);
    assert.equal(rawMat.keterjangkauanHarga, undefined);
  }

  const matchesByComposition = filterMaterialSpecs(DEFAULT_MATERIAL_SPECS, 'all', 'veneer');
  assert.ok(matchesByComposition.some((m) => m.id === 'mat-multipleks'));

  const tipsJsonLd = buildTipsInteriorJsonLd(
    DEFAULT_MATERIAL_SPECS,
    BUSINESS_CONFIG,
    'https://shansusdzar.vercel.app'
  );
  assert.equal(tipsJsonLd['@type'], 'CollectionPage');
  const itemList = (tipsJsonLd.mainEntity as { itemListElement: Array<{ url: string }> }).itemListElement;
  assert.equal(itemList.length, DEFAULT_MATERIAL_SPECS.length);
  assert.ok(itemList.every((el) => el.url.includes('/tips-interior/')));
});

import { selectPopularBeritaArticles } from './informasi-filter';

test('selectPopularBeritaArticles selects curated published Berita stories cleanly for the magazine Terpopuler column', () => {
  const allBerita = filterBeritaOnlyArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.ok(allBerita.length >= 6);

  const popular = selectPopularBeritaArticles(DEFAULT_NEWS_ARTICLES, 4);
  assert.equal(popular.length, 4);
  assert.ok(popular.every((item) => item.terbit && !isTipsInteriorCategory(item.kategori)));
  assert.equal(popular[0].id, 'news-ekspansi-workshop-cibogohilir');

  const withoutLead = selectPopularBeritaArticles(DEFAULT_NEWS_ARTICLES, 4, [allBerita[0].id]);
  assert.equal(withoutLead.length, 4);
  assert.equal(withoutLead.some((item) => item.id === allBerita[0].id), false);
});


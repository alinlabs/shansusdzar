import test from 'node:test';
import assert from 'node:assert/strict';
import artikelBeritaJson from '../../src/data/artikel-berita.json';
import { BUSINESS_CONFIG } from '../../src/lib/business-config';
import { DEFAULT_FAQS, DEFAULT_MATERIAL_SPECS, DEFAULT_NEWS_ARTICLES } from '../../src/lib/cms-defaults';
import {
  ALL_FAQ_CATEGORIES,
  ALL_NEWS_CATEGORIES,
  BERITA_SORT_OPTIONS,
  FAQ_SORT_OPTIONS,
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
  generateNextNewsId,
  getNewsSlug,
  isNewsSlugTaken,
  isTipsInteriorCategory,
  selectPopularBeritaArticles,
  slugifyNewsTitle,
  sortBeritaArticles,
  sortFaqItems,
} from '../../src/lib/informasi-filter';
import {
  buildNewsImageTagsMarkup,
  convertLegacyParagraphsToContentBlocks,
  normalizeNewsContentBlocks,
  parseNewsContentBlocks,
  resolveNewsContentRenderBlocks,
  resolveNewsImageGroupLayout,
  sanitizeNewsImageUrl,
  stripNewsImageTags,
} from '../../src/lib/news-content';
import {
  buildArticleJsonLd,
  buildBeritaListJsonLd,
  buildFaqPageJsonLd,
  buildInformasiHubJsonLd,
  buildTipsInteriorJsonLd,
} from '../../src/lib/seo-schema';

test('src/data/artikel-berita.json strictly conforms to news-000 IDs, no slug/terbit, and structured isi blocks', () => {
  assert.ok(artikelBeritaJson.length >= 9);

  for (let i = 0; i < artikelBeritaJson.length; i += 1) {
    const raw = artikelBeritaJson[i] as Record<string, unknown>;
    assert.match(String(raw.id), /^news-\d{3}$/, `Invalid news id: ${String(raw.id)}`);
    assert.equal(raw.id, `news-${String(i + 1).padStart(3, '0')}`);

    assert.equal('slug' in raw, false, `${String(raw.id)} must not contain slug`);
    assert.equal('terbit' in raw, false, `${String(raw.id)} must not contain terbit`);
    assert.equal('paragrafKonten' in raw, false, `${String(raw.id)} must not contain paragrafKonten`);
    assert.equal('namaPenulis' in raw, false, `${String(raw.id)} must not contain namaPenulis`);
    assert.equal('menitBaca' in raw, false, `${String(raw.id)} must not contain menitBaca`);

    assert.ok(Array.isArray(raw.isi), `${String(raw.id)} isi must be an array`);
    assert.ok((raw.isi as unknown[]).length >= 1, `${String(raw.id)} isi must not be empty`);

    for (const block of raw.isi as Array<Record<string, unknown>>) {
      assert.ok(block.jenis === 'teks' || block.jenis === 'gambar');
      assert.ok(block.format && typeof block.format === 'object');
      if (block.jenis === 'teks') {
        assert.equal(typeof block.isi, 'string');
        assert.ok((block.isi as string).trim().length > 0);
      } else {
        assert.ok(Array.isArray(block.isi) && block.isi.length >= 1);
      }
    }
  }
});

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

test('filterNewsArticles matches categories, keywords, and isi text blocks', () => {
  const categories = extractNewsCategories(DEFAULT_NEWS_ARTICLES);
  assert.equal(categories[0], ALL_NEWS_CATEGORIES);
  assert.ok(categories.includes('Edukasi Material'));

  const allNews = filterNewsArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.equal(allNews.length, DEFAULT_NEWS_ARTICLES.length);

  const keywordMatch = filterNewsArticles(
    DEFAULT_NEWS_ARTICLES,
    ALL_NEWS_CATEGORIES,
    'kitchen set purwakarta'
  );
  assert.ok(keywordMatch.some((n) => n.id === 'news-007'));
});

test('filterTipsInteriorArticles prioritizes interior tips and material guides', () => {
  const tips = filterTipsInteriorArticles(DEFAULT_NEWS_ARTICLES);
  assert.ok(tips.length >= 2);
  assert.ok(tips.some((t) => t.kategori === 'Tips Interior' || t.kategori === 'Edukasi Material'));

  const allPublished = filterNewsArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.ok(allPublished.some((t) => t.kategori === 'Kabar Workshop'));
  assert.equal(allPublished.length, DEFAULT_NEWS_ARTICLES.length);
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

test('slugifyNewsTitle, getNewsSlug, isNewsSlugTaken, generateNextNewsId, and estimateReadingMinutes work cleanly', () => {
  assert.equal(
    slugifyNewsTitle('Tips Memilih Kitchen Set Anti-Rayap 2026!'),
    'tips-memilih-kitchen-set-anti-rayap-2026'
  );
  assert.equal(generateNextNewsId([]), 'news-001');
  assert.equal(generateNextNewsId(DEFAULT_NEWS_ARTICLES), 'news-010');

  assert.equal(
    isNewsSlugTaken(DEFAULT_NEWS_ARTICLES[0].judul, 'news-999', DEFAULT_NEWS_ARTICLES),
    true
  );
  assert.equal(
    isNewsSlugTaken(
      DEFAULT_NEWS_ARTICLES[0].judul,
      DEFAULT_NEWS_ARTICLES[0].id,
      DEFAULT_NEWS_ARTICLES
    ),
    false
  );

  assert.equal(estimateReadingMinutes(['Kata singkat']), 1);
  assert.equal(
    estimateReadingMinutes([
      {
        jenis: 'teks',
        isi: new Array(380).fill('interior').join(' '),
        format: { gaya: 'paragraf', rata: 'justify' },
      },
    ]),
    3
  );
});

test('SEO Schema builders output valid Article, Berita, Tips Interior, and FAQPage data', () => {
  const origin = 'https://shansusdzar.vercel.app';
  const articleSchema = buildArticleJsonLd(DEFAULT_NEWS_ARTICLES[0], BUSINESS_CONFIG, origin);
  assert.equal(articleSchema['@type'], 'Article');
  assert.equal(articleSchema['inLanguage'], 'id-ID');
  assert.equal(
    (articleSchema.mainEntityOfPage as { '@id': string })['@id'],
    `${origin}/berita/${getNewsSlug(DEFAULT_NEWS_ARTICLES[0])}`
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

test('parseNewsContentBlocks and resolveNewsContentRenderBlocks preserve order and image layout options', () => {
  assert.equal(sanitizeNewsImageUrl(' https://contoh.png '), 'https://contoh.png/');
  assert.equal(
    sanitizeNewsImageUrl('/sample-produk/gambar/kitchen-set-real.webp'),
    '/sample-produk/gambar/kitchen-set-real.webp'
  );
  assert.equal(sanitizeNewsImageUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeNewsImageUrl('//evil.example/img.png'), null);

  const structuredBlocks = resolveNewsContentRenderBlocks([
    {
      jenis: 'teks',
      isi: 'Paragraf pembuka.',
      format: { gaya: 'paragraf', rata: 'justify' },
    },
    {
      jenis: 'gambar',
      isi: ['/sample-produk/gambar/kitchen-set-detail.webp'],
      format: { mode: 'full', grid: '1', ratio: '16/9', caption: 'Detail penuh' },
    },
    {
      jenis: 'teks',
      isi: 'Subjudul Proses',
      format: { gaya: 'subjudul', rata: 'left' },
    },
  ]);

  assert.equal(structuredBlocks.length, 3);
  assert.equal(structuredBlocks[0].type, 'paragraph');
  assert.equal(structuredBlocks[1].type, 'image-group');
  assert.equal(structuredBlocks[2].type, 'paragraph');
  if (structuredBlocks[2].type === 'paragraph') {
    assert.equal(structuredBlocks[2].gaya, 'subjudul');
    assert.equal(structuredBlocks[2].rata, 'left');
  }

  const converted = convertLegacyParagraphsToContentBlocks([
    'Penjelasan awal. <image mode="fit">/images/promo-interior-banner.webp</image>',
  ]);
  assert.equal(converted.length, 2);
  assert.equal(converted[0].jenis, 'teks');
  assert.equal(converted[1].jenis, 'gambar');
  if (converted[1].jenis === 'gambar') {
    assert.equal(converted[1].format.mode, 'fit');
  }

  const normalized = normalizeNewsContentBlocks([
    { jenis: 'gambar', isi: ['javascript:alert(1)', '/sample-produk/gambar/a.webp'], format: { mode: 'crop', grid: '2' } },
  ]);
  assert.equal(normalized.length, 1);
  if (normalized[0].jenis === 'gambar') {
    assert.deepEqual(normalized[0].isi, ['/sample-produk/gambar/a.webp']);
  }

  const legacyBlocks = parseNewsContentBlocks([
    '<image mode="full" ratio="16/9" caption="Detail penuh workshop">/sample-produk/gambar/kitchen-set-detail.webp</image> <image grid="3" mode="crop" ratio="4/3" caption="Tiga variasi panel">/sample-produk/gambar/a.webp</image> <image grid="3" mode="crop" ratio="4/3">/sample-produk/gambar/b.webp</image> <image grid="3" mode="crop" ratio="4/3">/sample-produk/gambar/c.webp</image>',
    '<image mode="fit" caption="Proporsi asli">/images/promo-interior-banner.webp</image>',
  ]);

  assert.equal(legacyBlocks.length, 3);
  if (
    legacyBlocks[0].type === 'image-group' &&
    legacyBlocks[1].type === 'image-group' &&
    legacyBlocks[2].type === 'image-group'
  ) {
    const fullLayout = resolveNewsImageGroupLayout(legacyBlocks[0]);
    assert.equal(fullLayout.mode, 'full');
    assert.equal(fullLayout.isFullBleed, true);
    assert.equal(fullLayout.grid, '1');

    const grid3Layout = resolveNewsImageGroupLayout(legacyBlocks[1]);
    assert.equal(grid3Layout.mode, 'crop');
    assert.equal(grid3Layout.grid, '3');
    assert.equal(grid3Layout.ratio, '4/3');
    assert.ok(grid3Layout.gridClassName.includes('grid-cols-2'));
    assert.ok(grid3Layout.gridClassName.includes('md:grid-cols-3'));

    const fitLayout = resolveNewsImageGroupLayout(legacyBlocks[2]);
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
  assert.equal(stripNewsImageTags(markup), '');
});

test('Berita JSON entries preserve customized image blocks in isi array', () => {
  const beritaEntries = DEFAULT_NEWS_ARTICLES.filter((a) => !isTipsInteriorCategory(a.kategori));
  assert.ok(beritaEntries.length >= 4);
  for (const item of beritaEntries) {
    assert.ok(parseNewsContentBlocks(item.isi).some((b) => b.type === 'image-group'));
  }

  const leadBlocks = parseNewsContentBlocks(beritaEntries[0].isi);
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

test('selectPopularBeritaArticles selects curated Berita stories cleanly for the magazine Terpopuler column', () => {
  const allBerita = filterBeritaOnlyArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.ok(allBerita.length >= 6);

  const popular = selectPopularBeritaArticles(DEFAULT_NEWS_ARTICLES, 4);
  assert.equal(popular.length, 4);
  assert.ok(popular.every((item) => !isTipsInteriorCategory(item.kategori)));
  assert.equal(popular[0].id, 'news-001');

  const withoutLead = selectPopularBeritaArticles(DEFAULT_NEWS_ARTICLES, 4, [allBerita[0].id]);
  assert.equal(withoutLead.length, 4);
  assert.equal(withoutLead.some((item) => item.id === allBerita[0].id), false);
});

test('sortBeritaArticles supports featured, newest, and title-asc ordering cleanly', () => {
  assert.deepEqual(
    BERITA_SORT_OPTIONS.map((opt) => opt.value),
    ['featured', 'newest', 'title-asc']
  );

  const sample = filterBeritaOnlyArticles(DEFAULT_NEWS_ARTICLES, ALL_NEWS_CATEGORIES, '');
  assert.ok(sample.length >= 3);

  const featuredOrder = sortBeritaArticles(sample, 'featured');
  assert.deepEqual(
    featuredOrder.map((a) => a.id),
    sample.map((a) => a.id)
  );

  const newestOrder = sortBeritaArticles(sample, 'newest');
  for (let i = 1; i < newestOrder.length; i += 1) {
    assert.ok(newestOrder[i - 1].tanggalTerbit >= newestOrder[i].tanggalTerbit);
  }

  const titleOrder = sortBeritaArticles(sample, 'title-asc');
  for (let i = 1; i < titleOrder.length; i += 1) {
    assert.ok(titleOrder[i - 1].judul.localeCompare(titleOrder[i].judul, 'id') <= 0);
  }
});

test('sortFaqItems supports default urutan and alphabetical question sorting cleanly', () => {
  assert.deepEqual(
    FAQ_SORT_OPTIONS.map((opt) => opt.value),
    ['default', 'title-asc']
  );

  const sample = filterFaqItems(DEFAULT_FAQS, ALL_FAQ_CATEGORIES, '');
  assert.ok(sample.length >= 3);

  const defaultOrder = sortFaqItems(sample, 'default');
  assert.deepEqual(
    defaultOrder.map((item) => item.id),
    sample.map((item) => item.id)
  );

  const alphaOrder = sortFaqItems(sample, 'title-asc');
  for (let i = 1; i < alphaOrder.length; i += 1) {
    assert.ok(alphaOrder[i - 1].pertanyaan.localeCompare(alphaOrder[i].pertanyaan, 'id') <= 0);
  }
});

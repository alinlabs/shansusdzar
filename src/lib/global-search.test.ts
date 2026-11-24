import test from 'node:test';
import assert from 'node:assert/strict';
import catalogJson from '../data/produk.json';
import {
  DEFAULT_FAQS,
  DEFAULT_MATERIAL_SPECS,
  DEFAULT_NEWS_ARTICLES,
  DEFAULT_OPERATIONAL_INFO,
  DEFAULT_PORTFOLIO_PROJECTS,
} from './cms-defaults';
import { parseProductCatalog } from './product-catalog';
import {
  extractKeywordSnippet,
  filterSearchDocuments,
  parseSearchFilterKey,
  searchGlobalContent,
  splitHighlightSegments,
  tokenizeSearchQuery,
} from './global-search';

function createTestSearchInput() {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  return {
    products: parsed.catalog.daftarProduk,
    portfolioProjects: DEFAULT_PORTFOLIO_PROJECTS,
    newsArticles: DEFAULT_NEWS_ARTICLES,
    materials: DEFAULT_MATERIAL_SPECS,
    faqs: DEFAULT_FAQS,
    operationalInfo: DEFAULT_OPERATIONAL_INFO,
  };
}

test('tokenizeSearchQuery strips stopwords and normalizes punctuation', () => {
  assert.deepEqual(tokenizeSearchQuery('Bagaimana cara pesan kitchen set di Purwakarta?'), [
    'pesan',
    'kitchen',
    'set',
    'purwakarta',
  ]);
  assert.deepEqual(tokenizeSearchQuery('   '), []);
});

test('searchGlobalContent returns curated recommendations and popular keywords when query is empty', () => {
  const input = createTestSearchInput();
  const output = searchGlobalContent(input, '');

  assert.equal(output.results.length, 0);
  assert.equal(output.counts.semua, 0);
  assert.ok(output.recommendedKeywords.length >= 5);
  assert.ok(output.featuredRecommendations.produk.length > 0);
  assert.ok(output.featuredRecommendations.portofolio.length > 0);
  assert.ok(output.featuredRecommendations.informasi.length > 0);
  assert.equal(output.intentSuggestion, null);
});

test('searchGlobalContent detects keywords across produk, portofolio, and informasi', () => {
  const input = createTestSearchInput();
  const output = searchGlobalContent(input, 'dapur');

  assert.ok(output.counts.semua > 0);
  assert.ok(output.counts.produk > 0, 'should match product items via kitchen/dapur');
  assert.ok(output.counts.informasi > 0, 'should match FAQ / material / news for dapur');
  assert.ok(
    output.results.some((r) => r.sourceKind === 'produk' && r.to.startsWith('/produk/')),
    'should include deep link to product detail page'
  );
});

test('searchGlobalContent surfaces material guide intent & records for PVC Board or HPL', () => {
  const input = createTestSearchInput();
  const output = searchGlobalContent(input, 'PVC tahan air');

  assert.ok(output.results.some((r) => r.sourceKind === 'material' && r.title.includes('PVC')));
  assert.equal(output.intentSuggestion?.to, '/tips-interior');
});

test('searchGlobalContent surfaces custom interior calculator intent for pricing/sizing queries', () => {
  const input = createTestSearchInput();
  const output = searchGlobalContent(input, 'estimasi biaya custom ukuran');

  assert.equal(output.intentSuggestion?.to, '/produk/custom');
  assert.ok(output.results.some((r) => r.to === '/produk/custom'));
});

test('searchGlobalContent excludes unpublished portfolio/news/faq entries', () => {
  const input = createTestSearchInput();
  const withDrafts = {
    ...input,
    portfolioProjects: [
      ...input.portfolioProjects,
      {
        ...input.portfolioProjects[0],
        id: 'draft-porto-hidden',
        slug: 'draft-porto-hidden',
        judul: 'Proyek Rahasia XYZ999',
        terbit: false,
      },
    ],
    newsArticles: [
      ...input.newsArticles,
      {
        ...input.newsArticles[0],
        id: 'draft-news-hidden',
        slug: 'draft-news-hidden',
        judul: 'Artikel Rahasia XYZ999',
        terbit: false,
      },
    ],
    faqs: [
      ...input.faqs,
      {
        ...input.faqs[0],
        id: 'draft-faq-hidden',
        pertanyaan: 'Pertanyaan Rahasia XYZ999',
        terbit: false,
      },
    ],
  };

  const output = searchGlobalContent(withDrafts, 'XYZ999');
  assert.equal(output.results.length, 0);
  assert.ok(output.recommendedKeywords.length > 0);
});

test('parseSearchFilterKey and filterSearchDocuments filter cleanly by group and sourceKind', () => {
  assert.equal(parseSearchFilterKey('berita'), 'berita');
  assert.equal(parseSearchFilterKey('produk'), 'produk');
  assert.equal(parseSearchFilterKey('katalog'), 'produk');
  assert.equal(parseSearchFilterKey('unknown-key'), 'semua');
  assert.equal(parseSearchFilterKey(null), 'semua');

  const input = createTestSearchInput();
  const output = searchGlobalContent(input, 'dapur');

  const produkOnly = filterSearchDocuments(output.results, 'produk');
  assert.ok(produkOnly.length > 0);
  assert.ok(produkOnly.every((item) => item.group === 'produk'));

  const beritaBrowse = filterSearchDocuments(output.allDocuments, 'berita');
  assert.ok(beritaBrowse.length > 0);
  assert.ok(beritaBrowse.every((item) => item.sourceKind === 'berita'));

  const faqBrowse = filterSearchDocuments(output.allDocuments, 'faq');
  assert.ok(faqBrowse.length > 0);
  assert.ok(faqBrowse.every((item) => item.sourceKind === 'faq'));
});

test('extractKeywordSnippet centers around late keyword matches and splitHighlightSegments marks matches', () => {
  const snippet = extractKeywordSnippet(
    {
      description: 'Ringkasan singkat.',
      snippetSource:
        'Paragraf pengenalan panjang tentang desain interior modern ruang tamu keluarga yang nyaman dan fungsional untuk rumah tinggal di kawasan Purwakarta dengan finishing HPL tahan gores.',
    },
    'Purwakarta'
  );
  assert.ok(snippet.includes('Purwakarta'));

  const segments = splitHighlightSegments(snippet, 'Purwakarta');
  const highlighted = segments.filter((s) => s.highlighted);
  assert.equal(highlighted.length, 1);
  assert.equal(highlighted[0].text, 'Purwakarta');
});

test('every search result for kitchen visibly contains kitchen in its 2-line snippet', () => {
  const input = createTestSearchInput();
  const output = searchGlobalContent(input, 'kitchen');
  assert.ok(output.results.length > 0);

  for (const item of output.results) {
    const snippet = extractKeywordSnippet(item, 'kitchen', 120);
    assert.ok(
      snippet.toLowerCase().includes('kitchen'),
      `Expected snippet for ${item.id} to visibly contain "kitchen", got: ${snippet}`
    );
  }
});

test('searchGlobalContent finds renamed products Bufet TV and Wardrobe with concise slugs', () => {
  const input = createTestSearchInput();
  const bufetOutput = searchGlobalContent(input, 'bufet tv');
  assert.ok(bufetOutput.results.some((r) => r.sourceKind === 'produk' && r.to === '/produk/bufet-tv'));

  const wardrobeOutput = searchGlobalContent(input, 'wardrobe');
  assert.ok(wardrobeOutput.results.some((r) => r.sourceKind === 'produk' && r.to === '/produk/wardrobe'));
});


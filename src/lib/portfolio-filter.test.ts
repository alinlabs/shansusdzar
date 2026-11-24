import test from 'node:test';
import assert from 'node:assert/strict';
import catalogJson from '../data/produk.json';
import portfolioJson from '../data/proyek-portofolio.json';
import { DEFAULT_PORTFOLIO_PROJECTS } from './cms-defaults';
import { BUSINESS_CONFIG } from './business-config';
import {
  ALL_PORTFOLIO_CATEGORIES,
  ALL_PORTFOLIO_YEARS,
  buildPortfolioDesktopGridColumns,
  buildPortfolioVisualSlides,
  computeNextPortfolioGridStartCol,
  computePortfolioReviewStats,
  deriveClientInitials,
  deriveReviewsFromPortfolio,
  ensureUniquePortfolioSlug,
  extractPortfolioCategories,
  extractPortfolioYears,
  filterPortfolioProjects,
  findMatchingProductForPortfolio,
  hasVisiblePortfolioReview,
  partitionMobilePortfolioProjects,
  resolvePortfolioReferencePrice,
  resolveProductRealImageUrl,
  slugifyPortfolioTitle,
  syncPortfolioProjectsWithProducts,
} from './portfolio-filter';
import { parseProductCatalog } from './product-catalog';
import { buildPortfolioProjectJsonLd } from './seo-schema';

test('DEFAULT_PORTFOLIO_PROJECTS strictly covers all catalog products with -real.webp images', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  assert.equal(DEFAULT_PORTFOLIO_PROJECTS.length, products.length);

  const portfolioProductIds = new Set<string>();
  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    const matched = findMatchingProductForPortfolio(project, products);
    assert.ok(matched, `Portfolio "${project.id}" must correspond to a product in produk.json`);
    portfolioProductIds.add(matched.id);

    const expectedRealUrl = resolveProductRealImageUrl(matched);
    assert.ok(expectedRealUrl, `Product "${matched.id}" must have a -real.webp image`);
    assert.match(expectedRealUrl, /-real\.webp$/i);
    assert.equal(project.gambarUtama, expectedRealUrl);
    assert.equal(project.galeriGambar[0], expectedRealUrl);
  }

  assert.equal(portfolioProductIds.size, products.length);
});

test('syncPortfolioProjectsWithProducts resolves -real.webp image from matching product', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  const staleProjects = [
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      gambarUtama: '/produk/gambar/stale-image.webp',
      galeriGambar: ['/produk/gambar/stale-image.webp'],
    },
  ];

  const synced = syncPortfolioProjectsWithProducts(staleProjects, products);
  assert.equal(synced[0].gambarUtama, '/sample-produk/gambar/kitchen-set-real.webp');
  assert.deepEqual(synced[0].galeriGambar, ['/sample-produk/gambar/kitchen-set-real.webp']);
});

test('extractPortfolioCategories returns Semua plus unique product categories', () => {
  const categories = extractPortfolioCategories(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(categories[0], ALL_PORTFOLIO_CATEGORIES);
  assert.ok(categories.includes('Dapur & Bar'));
  assert.ok(categories.includes('Kamar Tidur'));
  assert.ok(categories.includes('Komersial & Gerai'));
});

test('filterPortfolioProjects excludes unpublished projects unless specified', () => {
  const sample = [
    ...DEFAULT_PORTFOLIO_PROJECTS,
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      id: 'draft-1',
      judul: 'Proyek Draft Internal',
      terbit: false,
      urutan: 99,
    },
  ];

  const publicList = filterPortfolioProjects(sample, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
  });
  assert.equal(publicList.some((p) => p.id === 'draft-1'), false);

  const adminList = filterPortfolioProjects(sample, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
    includeUnpublished: true,
  });
  assert.equal(adminList.some((p) => p.id === 'draft-1'), true);
});

test('filterPortfolioProjects filters by search query, category, and sorts by area-desc', () => {
  const byCategory = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: 'Dapur & Bar',
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
  });
  assert.equal(byCategory.length, 2);
  assert.equal(byCategory[0].id, 'portofolio-kitchen-set-01');

  const byQuery = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: 'karawang',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
  });
  assert.ok(byQuery.length >= 1);
  assert.ok(byQuery.every((p) => p.lokasi === 'Karawang'));

  const sortedArea = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'area-desc',
  });
  assert.ok(sortedArea[0].luasMeterPersegi >= sortedArea[1].luasMeterPersegi);
});

test('extractPortfolioYears extracts sorted unique years with Semua first', () => {
  const years = extractPortfolioYears(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(years[0], ALL_PORTFOLIO_YEARS);
  assert.ok(years.includes('2026'));
});

test('slugifyPortfolioTitle and ensureUniquePortfolioSlug produce clean unique URL slugs', () => {
  assert.equal(
    slugifyPortfolioTitle('Kitchen Set Minimalis L-Shape & Island (Purwakarta)!'),
    'kitchen-set-minimalis-l-shape-island-purwakarta'
  );
  const existingSlug = DEFAULT_PORTFOLIO_PROJECTS[0].slug;
  assert.equal(
    ensureUniquePortfolioSlug(existingSlug, 'new-project-id', DEFAULT_PORTFOLIO_PROJECTS),
    `${existingSlug}-2`
  );
  assert.equal(
    ensureUniquePortfolioSlug(
      existingSlug,
      DEFAULT_PORTFOLIO_PROJECTS[0].id,
      DEFAULT_PORTFOLIO_PROJECTS
    ),
    existingSlug
  );
});

test('buildPortfolioProjectJsonLd builds valid CreativeWork structured data', () => {
  const project = DEFAULT_PORTFOLIO_PROJECTS[0];
  const schema = buildPortfolioProjectJsonLd(
    project,
    BUSINESS_CONFIG,
    'https://shansusdzar.vercel.app'
  );
  assert.equal(schema['@type'], 'CreativeWork');
  assert.equal(schema.name, project.judul);
  assert.equal(
    (schema.mainEntityOfPage as { '@id': string })['@id'],
    `https://shansusdzar.vercel.app/portofolio/${project.slug}`
  );
});

test('deriveReviewsFromPortfolio derives verified client reviews from published portfolio projects only', () => {
  const reviews = deriveReviewsFromPortfolio(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(reviews.length, DEFAULT_PORTFOLIO_PROJECTS.length);
  for (const rev of reviews) {
    assert.ok(rev.projectId);
    assert.ok(rev.projectSlug);
    assert.ok(rev.projectTitle);
    assert.ok(rev.namaKlien.length > 0);
    assert.ok(rev.komentar.length > 0);
    assert.ok(rev.penilaian >= 1 && rev.penilaian <= 5);
  }

  const withDraftAndHidden = [
    ...DEFAULT_PORTFOLIO_PROJECTS,
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      id: 'draft-reviewed',
      slug: 'draft-reviewed',
      terbit: false,
      urutan: 100,
      ulasan: {
        tampil: true,
        namaPengulas: 'Klien Draft',
        inisial: 'KD',
        penilaian: 5,
        komentar: 'Tidak boleh tampil karena proyek masih draft.',
      },
    },
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      id: 'published-hidden-review',
      slug: 'published-hidden-review',
      terbit: true,
      urutan: 101,
      ulasan: {
        tampil: false,
        namaPengulas: 'Klien Tersembunyi',
        inisial: 'KT',
        penilaian: 4,
        komentar: 'Disembunyikan sementara.',
      },
    },
  ];

  const derived = deriveReviewsFromPortfolio(withDraftAndHidden);
  assert.equal(derived.length, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(derived.some((r) => r.projectId === 'draft-reviewed'), false);
  assert.equal(derived.some((r) => r.projectId === 'published-hidden-review'), false);
});

test('deriveClientInitials, hasVisiblePortfolioReview, and computePortfolioReviewStats behave consistently', () => {
  assert.equal(deriveClientInitials('Raka Pratama'), 'RP');
  assert.equal(deriveClientInitials('Nadia'), 'NA');
  assert.equal(deriveClientInitials('   '), 'KL');

  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    assert.equal(
      hasVisiblePortfolioReview(project),
      true,
      `Project "${project.id}" must include a visible client review`
    );
  }
  for (const rawProject of portfolioJson) {
    assert.ok(rawProject.ulasan, `JSON project "${rawProject.id}" must have non-null ulasan`);
    assert.equal(rawProject.ulasan?.tampil, true);
    assert.ok(rawProject.ulasan?.namaPengulas.trim());
    assert.ok(rawProject.ulasan?.komentar.trim());
  }

  const stats = computePortfolioReviewStats(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(stats.totalProjects, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(stats.totalReviews, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(stats.fiveStarCount, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(stats.averageRating, 5);
});

test('buildPortfolioVisualSlides emits exactly 1 -real.webp slide plus 4 placeholder slides and preserves valid video slides', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const firstProduct = parsed.catalog.daftarProduk[0];
  const firstProject = DEFAULT_PORTFOLIO_PROJECTS[0];

  const defaultSlides = buildPortfolioVisualSlides(firstProject, firstProduct);
  assert.equal(defaultSlides.length, 5);
  assert.equal(defaultSlides[0].kind, 'image');
  assert.match(defaultSlides[0].src ?? '', /-real\.webp$/i);
  assert.equal(
    defaultSlides.slice(1).every((slide) => slide.kind === 'image' && slide.src === null),
    true
  );

  const projectWithVideos = {
    ...firstProject,
    galeriGambar: [
      firstProject.gambarUtama,
      '/hero.webm',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
    ],
  };
  const productWithVideo = {
    ...firstProduct,
    media: [...firstProduct.media, { url: '/hero.webm', judul: 'Video Workshop' }],
  };

  const videoSlides = buildPortfolioVisualSlides(projectWithVideos, productWithVideo);
  assert.equal(videoSlides.length, 7);
  assert.equal(videoSlides[0].kind, 'image');
  assert.match(videoSlides[0].src ?? '', /-real\.webp$/i);
  assert.equal(videoSlides[1].kind, 'video');
  assert.equal(videoSlides[1].src, '/hero.webm');
  assert.equal(videoSlides[2].kind, 'video');
  assert.equal(videoSlides[2].src, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(
    videoSlides.slice(3).every((slide) => slide.kind === 'image' && slide.src === null),
    true
  );
});

test('all portfolio projects in JSON & defaults carry positive referensiHarga and resolvePortfolioReferencePrice computes fallback', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  assert.equal(portfolioJson.length, products.length);
  for (const rawProject of portfolioJson) {
    assert.equal(
      typeof rawProject.referensiHarga,
      'number',
      `Portfolio JSON "${rawProject.id}" missing numeric referensiHarga`
    );
    assert.ok(
      rawProject.referensiHarga > 0,
      `Portfolio JSON "${rawProject.id}" must have positive referensiHarga`
    );
  }

  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    const matched = findMatchingProductForPortfolio(project, products);
    const resolved = resolvePortfolioReferencePrice(project, matched);
    assert.ok(resolved !== null && resolved > 0, `Resolved price missing for "${project.id}"`);
    assert.equal(resolved, project.referensiHarga);

    const dynamicFallback = resolvePortfolioReferencePrice(
      { ...project, referensiHarga: null },
      matched
    );
    assert.ok(
      dynamicFallback !== null && dynamicFallback > 0,
      `Dynamic fallback price failed for "${project.id}"`
    );
  }
});

test('buildPortfolioDesktopGridColumns and computeNextPortfolioGridStartCol implement 1|2|5|7 / 3|4|6|8 sliding window', () => {
  const items8 = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const cols8 = buildPortfolioDesktopGridColumns(items8);
  assert.equal(cols8.length, 4);
  assert.deepEqual(
    cols8.map((c) => [c.top.slide, c.bottom?.slide ?? null]),
    [
      ['1', '3'],
      ['2', '4'],
      ['5', '6'],
      ['7', '8'],
    ]
  );

  // Initial [1,2 / 3,4] while sliding through 1..4 stays at startCol 0
  let startCol = 0;
  startCol = computeNextPortfolioGridStartCol(startCol, 3, 8); // slide #4
  assert.equal(startCol, 0);

  // Sliding from #4 (idx 3) to #5 (idx 4) shifts window to [2,5 / 4,6] (startCol 1)
  startCol = computeNextPortfolioGridStartCol(startCol, 4, 8);
  assert.equal(startCol, 1);

  // Sliding from #5 to #4 keeps startCol 1
  startCol = computeNextPortfolioGridStartCol(startCol, 3, 8);
  assert.equal(startCol, 1);

  // Sliding back to #3 or #1 shifts window back to [1,2 / 3,4] (startCol 0)
  startCol = computeNextPortfolioGridStartCol(startCol, 0, 8);
  assert.equal(startCol, 0);

  // 5-slide default (1 real + 4 placeholders) produces 3 columns and includes all 5 cards
  const cols5 = buildPortfolioDesktopGridColumns(['1', '2', '3', '4', '5']);
  assert.equal(cols5.length, 3);
  assert.deepEqual(
    cols5.map((c) => [c.top.slide, c.bottom?.slide ?? null]),
    [
      ['1', '3'],
      ['2', '4'],
      ['5', null],
    ]
  );
  assert.equal(computeNextPortfolioGridStartCol(0, 4, 5), 1);

  // Independent user-slid grid scenarios:
  // 1) User manually slid grid to Slide 2 ([2,5 / 4,6], startCol=1) while main visual is #1 (idx 0).
  //    Main visual then moves to #2 (idx 1) -> #2 is already visible, so grid stays at startCol=1.
  assert.equal(computeNextPortfolioGridStartCol(1, 1, 8), 1);

  // 2) User manually slid grid to Slide 3 ([5,7 / 6,8], startCol=2) while main visual is #1 (idx 0).
  //    Main visual then moves to #2 (idx 1) -> finds #2 at nearest grid slide (-1 => startCol=1, [2,5 / 4,6]).
  assert.equal(computeNextPortfolioGridStartCol(2, 1, 8), 1);
});

test('isDesktopPortfolioCardWide alternates 1 wide | 1 small and 1 small | 1 wide cleanly', async () => {
  const { isDesktopPortfolioCardWide, resolvePortfolioClientSummary } = await import(
    './portfolio-filter'
  );
  const pattern8 = Array.from({ length: 8 }, (_, idx) => isDesktopPortfolioCardWide(idx, 8));
  assert.deepEqual(pattern8, [true, false, false, true, true, false, false, true]);

  assert.equal(isDesktopPortfolioCardWide(0, 1), false);
  assert.deepEqual(
    [0, 1, 2].map((idx) => isDesktopPortfolioCardWide(idx, 3)),
    [true, false, false]
  );

  const clientSummary = resolvePortfolioClientSummary(DEFAULT_PORTFOLIO_PROJECTS[0]);
  assert.equal(clientSummary.nama, 'Raka Pratama');
  assert.equal(clientSummary.inisial, 'RP');
  assert.equal(clientSummary.lokasiTahun, 'Purwakarta · 2026');
});

test('partitionMobilePortfolioProjects splits 1 lead, up to 4 horizontal cards, and remaining list', () => {
  const empty = partitionMobilePortfolioProjects([]);
  assert.equal(empty.leadProject, null);
  assert.equal(empty.horizontalProjects.length, 0);
  assert.equal(empty.remainingProjects.length, 0);

  const single = partitionMobilePortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS.slice(0, 1));
  assert.equal(single.leadProject?.id, DEFAULT_PORTFOLIO_PROJECTS[0].id);
  assert.equal(single.horizontalProjects.length, 0);
  assert.equal(single.remainingProjects.length, 0);

  const five = partitionMobilePortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS.slice(0, 5));
  assert.equal(five.leadProject?.id, DEFAULT_PORTFOLIO_PROJECTS[0].id);
  assert.equal(five.horizontalProjects.length, 4);
  assert.equal(five.remainingProjects.length, 0);

  const full = partitionMobilePortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(full.leadProject?.id, DEFAULT_PORTFOLIO_PROJECTS[0].id);
  assert.equal(full.horizontalProjects.length, 4);
  assert.deepEqual(
    full.horizontalProjects.map((p) => p.id),
    DEFAULT_PORTFOLIO_PROJECTS.slice(1, 5).map((p) => p.id)
  );
  assert.equal(full.remainingProjects.length, DEFAULT_PORTFOLIO_PROJECTS.length - 5);
  assert.equal(full.remainingProjects[0]?.id, DEFAULT_PORTFOLIO_PROJECTS[5].id);
});




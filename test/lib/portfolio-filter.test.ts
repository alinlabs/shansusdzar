import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import catalogJson from '../../src/data/produk.json';
import portfolioJson from '../../src/data/portofolio.json';
import { DEFAULT_PORTFOLIO_PROJECTS } from '../../src/lib/cms-defaults';
import { BUSINESS_CONFIG } from '../../src/lib/business-config';
import {
  ALL_PORTFOLIO_CATEGORIES,
  ALL_PORTFOLIO_YEARS,
  buildPortfolioDesktopGridColumns,
  buildPortfolioVisualSlides,
  cleanPortfolioClientName,
  computeNextPortfolioGridStartCol,
  computePortfolioAreaSqm,
  computePortfolioReviewStats,
  deriveClientInitials,
  deriveReviewsFromPortfolio,
  extractPortfolioCategories,
  extractPortfolioClientSalutation,
  extractPortfolioYears,
  filterPortfolioProjects,
  findMatchingProductForPortfolio,
  formatPortfolioClientWithSalutation,
  formatPortfolioDimensionSummary,
  generateNextPortfolioId,
  getPortfolioSlug,
  hasVisiblePortfolioReview,
  isPortfolioSlugTaken,
  normalizePortfolioDimensions,
  normalizePortfolioSalutation,
  partitionMobilePortfolioProjects,
  resolvePortfolioReferencePrice,
  resolveProductRealImageUrl,
  shufflePortfolioProjects,
  slugifyPortfolioTitle,
  syncPortfolioProjectsWithProducts,
} from '../../src/lib/portfolio-filter';
import { getProductSlug, parseProductCatalog } from '../../src/lib/product-catalog';
import { buildPortfolioProjectJsonLd } from '../../src/lib/seo-schema';

test('src/data/portofolio.json strictly conforms to port-000 IDs, produk.json IDs, 3-axis dimensi arrays, and clean schema', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;
  const productIds = new Set(products.map((p) => p.id));

  assert.equal(portfolioJson.length, products.length);

  for (let i = 0; i < portfolioJson.length; i += 1) {
    const raw = portfolioJson[i] as Record<string, unknown>;
    assert.match(String(raw.id), /^port-\d{3}$/, `Invalid portfolio id: ${String(raw.id)}`);
    assert.equal(raw.id, `port-${String(i + 1).padStart(3, '0')}`);

    assert.ok(
      typeof raw.produkId === 'string' && productIds.has(raw.produkId),
      `Portfolio "${String(raw.id)}" must reference an exact product id in produk.json, got "${String(raw.produkId)}"`
    );

    // Removed top-level fields including namaKlien
    assert.equal('namaKlien' in raw, false, `${String(raw.id)} must not contain namaKlien`);
    assert.equal('slug' in raw, false, `${String(raw.id)} must not contain slug`);
    assert.equal('ringkasanDimensi' in raw, false, `${String(raw.id)} must not contain ringkasanDimensi`);
    assert.equal('luasMeterPersegi' in raw, false, `${String(raw.id)} must not contain luasMeterPersegi`);
    assert.equal('terbit' in raw, false, `${String(raw.id)} must not contain terbit`);
    assert.equal('urutan' in raw, false, `${String(raw.id)} must not contain urutan`);

    // dimensi array of objects with panjang, lebar, tinggi
    assert.ok(Array.isArray(raw.dimensi), `${String(raw.id)} dimensi must be an array`);
    assert.ok((raw.dimensi as unknown[]).length >= 1);
    for (const dim of raw.dimensi as Array<Record<string, unknown>>) {
      assert.equal(typeof dim.panjang, 'number');
      assert.equal(typeof dim.lebar, 'number');
      assert.equal(typeof dim.tinggi, 'number');
      assert.ok((dim.panjang as number) > 0);
      assert.ok((dim.lebar as number) > 0);
      assert.ok((dim.tinggi as number) > 0);
    }

    // ulasan with sapaan + klien, without namaPengulas/tampil/inisial
    const ulasan = raw.ulasan as Record<string, unknown> | null | undefined;
    assert.ok(ulasan && typeof ulasan === 'object', `${String(raw.id)} must have ulasan object`);
    assert.equal('tampil' in ulasan, false, `${String(raw.id)} ulasan must not contain tampil`);
    assert.equal('inisial' in ulasan, false, `${String(raw.id)} ulasan must not contain inisial`);
    assert.equal('namaPengulas' in ulasan, false, `${String(raw.id)} ulasan must not contain namaPengulas`);
    assert.equal(typeof ulasan.sapaan, 'string');
    assert.ok(
      ['', 'Ibu', 'Bpk.', 'Tn.', 'Ny.', 'Nn.'].includes(ulasan.sapaan as string),
      `${String(raw.id)} ulasan.sapaan must be valid salutation, got "${String(ulasan.sapaan)}"`
    );
    assert.ok(typeof ulasan.klien === 'string' && ulasan.klien.trim().length > 0);
    assert.ok(typeof ulasan.komentar === 'string' && ulasan.komentar.trim().length > 0);
  }
});

test('DEFAULT_PORTFOLIO_PROJECTS strictly covers all catalog products with -real.webp images', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  assert.equal(DEFAULT_PORTFOLIO_PROJECTS.length, products.length);

  const portfolioProductIds = new Set<string>();
  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    const matched = findMatchingProductForPortfolio(project, products);
    assert.ok(matched, `Portfolio "${project.id}" must correspond to a product in produk.json`);
    assert.equal(project.produkId, matched.id);
    portfolioProductIds.add(matched.id);

    const expectedRealUrl = resolveProductRealImageUrl(matched);
    assert.ok(expectedRealUrl, `Product "${matched.id}" must have a -real.webp image`);
    assert.match(expectedRealUrl, /-real\.webp$/i);
    assert.equal(project.gambarUtama, expectedRealUrl);
    assert.equal(project.galeriGambar[0], expectedRealUrl);
  }

  assert.equal(portfolioProductIds.size, products.length);
});

test('computePortfolioAreaSqm, formatPortfolioDimensionSummary, and normalizePortfolioDimensions work accurately', () => {
  const first = DEFAULT_PORTFOLIO_PROJECTS[0];
  assert.equal(formatPortfolioDimensionSummary(first.dimensi), '250 x 60 x 220');
  assert.equal(computePortfolioAreaSqm(first.dimensi), 5.5);

  const multiUnit = [
    { panjang: 200, lebar: 60, tinggi: 220 },
    { panjang: 100, lebar: 60, tinggi: 80 },
  ];
  assert.equal(computePortfolioAreaSqm(multiUnit), 5.2);
  assert.equal(formatPortfolioDimensionSummary(multiUnit), '200 x 60 x 220, 100 x 60 x 80');

  assert.deepEqual(normalizePortfolioDimensions(undefined, '250 x 220'), [
    { panjang: 250, lebar: 60, tinggi: 220 },
  ]);
  assert.deepEqual(normalizePortfolioDimensions(undefined, '360 x 60 x 250'), [
    { panjang: 360, lebar: 60, tinggi: 250 },
  ]);
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

test('filterPortfolioProjects supports random ordering, category/query filters, and area-desc sort from dimensi', () => {
  const byCategory = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: 'Dapur & Bar',
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'title-asc',
  });
  assert.equal(byCategory.length, 2);
  assert.deepEqual(
    byCategory.map((p) => p.id),
    ['port-002', 'port-001']
  );

  const byQuery = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: 'karawang',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'title-asc',
  });
  assert.ok(byQuery.length >= 1);
  assert.ok(byQuery.every((p) => p.lokasi === 'Karawang'));

  const sortedArea = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'area-desc',
  });
  assert.ok(
    computePortfolioAreaSqm(sortedArea[0].dimensi) >=
      computePortfolioAreaSqm(sortedArea[1].dimensi)
  );

  // Random mode reorders list deterministically with supplied randomFn without mutating source
  const fixedZero = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'random',
    randomFn: () => 0,
  });
  assert.equal(fixedZero.length, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.notEqual(fixedZero[0].id, DEFAULT_PORTFOLIO_PROJECTS[0].id);
});

test('extractPortfolioYears extracts sorted unique years with Semua first', () => {
  const years = extractPortfolioYears(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(years[0], ALL_PORTFOLIO_YEARS);
  assert.ok(years.includes('2026'));
});

test('getPortfolioSlug derives URL slugs from judul matching product slug mechanism and checks uniqueness', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  assert.equal(
    slugifyPortfolioTitle('Kitchen Set Minimalis L-Shape & Island (Purwakarta)!'),
    'kitchen-set-minimalis-l-shape-island-purwakarta'
  );

  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    const matched = findMatchingProductForPortfolio(project, products);
    assert.ok(matched);
    assert.equal(getPortfolioSlug(project), getProductSlug(matched));
  }

  assert.equal(
    isPortfolioSlugTaken(DEFAULT_PORTFOLIO_PROJECTS[0].judul, 'port-999', DEFAULT_PORTFOLIO_PROJECTS),
    true
  );
  assert.equal(
    isPortfolioSlugTaken(
      DEFAULT_PORTFOLIO_PROJECTS[0].judul,
      DEFAULT_PORTFOLIO_PROJECTS[0].id,
      DEFAULT_PORTFOLIO_PROJECTS
    ),
    false
  );
});

test('generateNextPortfolioId formats sequential port-000 IDs', () => {
  assert.equal(generateNextPortfolioId([]), 'port-001');
  assert.equal(generateNextPortfolioId(DEFAULT_PORTFOLIO_PROJECTS), 'port-021');
});

test('buildPortfolioProjectJsonLd builds valid CreativeWork structured data using derived slug', () => {
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
    `https://shansusdzar.vercel.app/portofolio/${getPortfolioSlug(project)}`
  );
});

test('deriveReviewsFromPortfolio shows reviews purely based on presence of ulasan (name only, without sapaan) and randomizes order', () => {
  const reviews = deriveReviewsFromPortfolio(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(reviews.length, DEFAULT_PORTFOLIO_PROJECTS.length);
  for (const rev of reviews) {
    assert.ok(rev.projectId);
    assert.ok(rev.projectSlug);
    assert.ok(rev.projectTitle);
    assert.ok(rev.namaKlien.length > 0);
    assert.equal(/^(?:Ibu|Bpk\.|Tn\.|Ny\.|Nn\.)\s+/i.test(rev.namaKlien), false);
    assert.ok(rev.inisial.length >= 2);
    assert.ok(rev.komentar.length > 0);
    assert.ok(rev.penilaian >= 1 && rev.penilaian <= 5);
  }

  const withNullReview = [
    ...DEFAULT_PORTFOLIO_PROJECTS,
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      id: 'port-099',
      judul: 'Proyek Tanpa Ulasan',
      ulasan: null,
    },
  ];

  const derived = deriveReviewsFromPortfolio(withNullReview);
  assert.equal(derived.length, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(derived.some((r) => r.projectId === 'port-099'), false);

  const shuffledFixed = shufflePortfolioProjects(['a', 'b', 'c', 'd'], () => 0);
  assert.deepEqual(shuffledFixed, ['b', 'c', 'd', 'a']);
});

test('deriveClientInitials, hasVisiblePortfolioReview, and computePortfolioReviewStats behave consistently', () => {
  assert.equal(deriveClientInitials('Raka Pratama'), 'RP');
  assert.equal(deriveClientInitials('Bpk. Raka Pratama'), 'RP');
  assert.equal(deriveClientInitials('Nadia'), 'NA');
  assert.equal(deriveClientInitials('   '), 'KL');

  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    assert.equal(
      hasVisiblePortfolioReview(project),
      true,
      `Project "${project.id}" must include a visible client review`
    );
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

test('all portfolio projects in JSON & defaults carry positive referensiHarga and resolvePortfolioReferencePrice computes fallback from dimensi', () => {
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

  let startCol = 0;
  startCol = computeNextPortfolioGridStartCol(startCol, 3, 8);
  assert.equal(startCol, 0);

  startCol = computeNextPortfolioGridStartCol(startCol, 4, 8);
  assert.equal(startCol, 1);

  startCol = computeNextPortfolioGridStartCol(startCol, 3, 8);
  assert.equal(startCol, 1);

  startCol = computeNextPortfolioGridStartCol(startCol, 0, 8);
  assert.equal(startCol, 0);

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
  assert.equal(computeNextPortfolioGridStartCol(1, 1, 8), 1);
  assert.equal(computeNextPortfolioGridStartCol(2, 1, 8), 1);
});

test('isDesktopPortfolioCardWide alternates 1 wide | 1 small and 1 small | 1 wide cleanly', async () => {
  const { isDesktopPortfolioCardWide, resolvePortfolioClientSummary } = await import(
    '../../src/lib/portfolio-filter'
  );
  const pattern8 = Array.from({ length: 8 }, (_, idx) => isDesktopPortfolioCardWide(idx, 8));
  assert.deepEqual(pattern8, [true, false, false, true, true, false, false, true]);

  assert.equal(isDesktopPortfolioCardWide(0, 1), false);
  assert.deepEqual(
    [0, 1, 2].map((idx) => isDesktopPortfolioCardWide(idx, 3)),
    [true, false, false]
  );

  const clientSummary = resolvePortfolioClientSummary(DEFAULT_PORTFOLIO_PROJECTS[0]);
  assert.equal(clientSummary.nama, 'Bpk. Raka Pratama');
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

test('DEFAULT_PORTFOLIO_PROJECTS align judul with produk.json names and format salutation + klien cleanly', () => {
  const parsed = parseProductCatalog(catalogJson);
  assert.equal(parsed.status, 'success');
  const products = parsed.catalog.daftarProduk;

  const forbiddenPrefixRe =
    /^(?:kediaman keluarga|kediaman|hunian|residence|studio kerja|perpustakaan pribadi|lobby kantor)\b/i;

  for (const project of DEFAULT_PORTFOLIO_PROJECTS) {
    const matched = findMatchingProductForPortfolio(project, products);
    assert.ok(matched, `Missing matched product for ${project.id}`);
    assert.equal(project.judul, matched.nama);
    assert.equal(/\([^)]*\)/.test(project.judul), false, `Unexpected parentheses in "${project.judul}"`);
    assert.ok(project.ulasan);
    assert.equal(
      forbiddenPrefixRe.test(project.ulasan.klien),
      false,
      `Unexpected residence prefix in "${project.ulasan.klien}"`
    );
  }

  assert.equal(cleanPortfolioClientName('Kediaman Keluarga Bpk. Raka Pratama'), 'Bpk. Raka Pratama');
  assert.equal(cleanPortfolioClientName('Hunian Ibu Nadia Kusuma'), 'Ibu Nadia Kusuma');
  assert.equal(cleanPortfolioClientName('Lobby Kantor PT Mandala Karya'), 'PT Mandala Karya');

  assert.deepEqual(extractPortfolioClientSalutation('Kediaman Keluarga Bpk. Raka Pratama'), {
    sapaan: 'Bpk.',
    klien: 'Raka Pratama',
  });
  assert.deepEqual(extractPortfolioClientSalutation('tn. Budi Santoso'), {
    sapaan: 'Tn.',
    klien: 'Budi Santoso',
  });
  assert.equal(normalizePortfolioSalutation('ny'), 'Ny.');
  assert.equal(normalizePortfolioSalutation('nn.'), 'Nn.');
  assert.equal(
    formatPortfolioClientWithSalutation({ sapaan: 'Ibu', klien: 'Nadia Kusuma' }),
    'Ibu Nadia Kusuma'
  );
  assert.equal(
    formatPortfolioClientWithSalutation({ sapaan: '', klien: 'PT Mandala Karya' }),
    'PT Mandala Karya'
  );

  const legacyProjects = [
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[0],
      judul: 'Kitchen Set (Kabinet Atas & Bawah)',
    },
    {
      ...DEFAULT_PORTFOLIO_PROJECTS[3],
      judul: 'Backdrop TV Ruang Keluarga',
    },
  ];
  const migrated = syncPortfolioProjectsWithProducts(legacyProjects, products);
  assert.equal(migrated[0].judul, 'Kitchen Set');
  assert.equal(migrated[1].judul, 'Backdrop TV');
});

test('MobileLeadPortfolioShowcase wraps the lead mobile card inside a bordered rounded card container', () => {
  const showcaseSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/portofolio/mobile-showcase.tsx'),
    'utf8'
  );
  const leadBlockMatch = showcaseSrc.match(
    /function MobileLeadPortfolioShowcase[\s\S]*?\n\}\n\nfunction MobilePortfolioListRow/
  );
  assert.ok(leadBlockMatch, 'MobileLeadPortfolioShowcase block should exist');
  const leadBlock = leadBlockMatch[0];

  assert.equal(/\bw-screen\b/.test(leadBlock), false, 'Lead card must not use w-screen breakout');
  assert.equal(
    /-translate-x-1\/2/.test(leadBlock),
    false,
    'Lead card must not break out with -translate-x-1/2'
  );
  assert.match(leadBlock, /data-testid="portfolio-mobile-lead"/);
  assert.match(leadBlock, /rounded-\[var\(--radius-lg\)\]/);
  assert.match(leadBlock, /border border-\[var\(--border\)\]/);
  assert.match(leadBlock, /bg-\[var\(--surface\)\]/);
  assert.match(leadBlock, /overflow-hidden/);
});


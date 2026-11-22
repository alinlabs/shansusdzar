import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PORTFOLIO_PROJECTS } from './cms-defaults';
import { BUSINESS_CONFIG } from './business-config';
import {
  ALL_PORTFOLIO_CATEGORIES,
  ALL_PORTFOLIO_YEARS,
  computePortfolioReviewStats,
  deriveClientInitials,
  deriveReviewsFromPortfolio,
  ensureUniquePortfolioSlug,
  extractPortfolioCategories,
  extractPortfolioYears,
  filterPortfolioProjects,
  getPortfolioStats,
  hasVisiblePortfolioReview,
  slugifyPortfolioTitle,
} from './portfolio-filter';
import { buildPortfolioProjectJsonLd } from './seo-schema';

test('extractPortfolioCategories returns Semua plus unique categories', () => {
  const categories = extractPortfolioCategories(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(categories[0], ALL_PORTFOLIO_CATEGORIES);
  assert.ok(categories.includes('Dapur & Kabinet'));
  assert.ok(categories.includes('Kamar Tidur'));
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
    category: 'Dapur & Kabinet',
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
  });
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].id, 'portofolio-dapur-modular');

  const byQuery = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: 'karawang',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'order',
  });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].lokasi, 'Karawang');

  const sortedArea = filterPortfolioProjects(DEFAULT_PORTFOLIO_PROJECTS, {
    searchQuery: '',
    category: ALL_PORTFOLIO_CATEGORIES,
    year: ALL_PORTFOLIO_YEARS,
    sortBy: 'area-desc',
  });
  assert.ok(sortedArea[0].luasMeterPersegi >= sortedArea[1].luasMeterPersegi);
});

test('extractPortfolioYears and getPortfolioStats compute accurate summaries', () => {
  const years = extractPortfolioYears(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(years[0], ALL_PORTFOLIO_YEARS);
  assert.ok(years.includes('2026'));

  const stats = getPortfolioStats(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(stats.totalProjects, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.ok(stats.categoriesCount >= 5);
  assert.ok(stats.totalAreaSqm > 0);
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
    'https://sdi-furniture.vercel.app'
  );
  assert.equal(schema['@type'], 'CreativeWork');
  assert.equal(schema.name, project.judul);
  assert.equal(
    (schema.mainEntityOfPage as { '@id': string })['@id'],
    `https://sdi-furniture.vercel.app/portofolio/${project.slug}`
  );
});

test('deriveReviewsFromPortfolio derives verified client reviews from published portfolio projects only', () => {
  const reviews = deriveReviewsFromPortfolio(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(reviews.length, 5);
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
      urutan: 10,
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
      urutan: 11,
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
  assert.equal(derived.length, 5);
  assert.equal(derived.some((r) => r.projectId === 'draft-reviewed'), false);
  assert.equal(derived.some((r) => r.projectId === 'published-hidden-review'), false);
});

test('deriveClientInitials, hasVisiblePortfolioReview, and computePortfolioReviewStats behave consistently', () => {
  assert.equal(deriveClientInitials('Raka Pratama'), 'RP');
  assert.equal(deriveClientInitials('Nadia'), 'NA');
  assert.equal(deriveClientInitials('   '), 'KL');

  assert.equal(hasVisiblePortfolioReview(DEFAULT_PORTFOLIO_PROJECTS[0]), true);
  assert.equal(
    hasVisiblePortfolioReview(DEFAULT_PORTFOLIO_PROJECTS[DEFAULT_PORTFOLIO_PROJECTS.length - 1]),
    false
  );

  const stats = computePortfolioReviewStats(DEFAULT_PORTFOLIO_PROJECTS);
  assert.equal(stats.totalProjects, DEFAULT_PORTFOLIO_PROJECTS.length);
  assert.equal(stats.totalReviews, 5);
  assert.equal(stats.fiveStarCount, 5);
  assert.equal(stats.averageRating, 5);
});


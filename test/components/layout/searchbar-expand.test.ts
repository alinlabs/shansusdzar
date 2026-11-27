import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

const EXPANDED_SEARCH_PUBLIC_PAGES = [
  'src/pages/produk/katalog/index.tsx',
  'src/pages/portofolio/index.tsx',
  'src/pages/berita/index.tsx',
  'src/pages/faq/index.tsx',
] as const;

test('NavigasiHeader implements full-width expanded header searchbar matching searchbar-expand.md', () => {
  const headerSrc = readProjectFile('src/components/layout/navigasi-header.tsx');

  // Expanded mode renders PublicHeaderSearchBar and removes desktop 3-column grid
  assert.match(headerSrc, /effectivePageSearchActive && headerSearch/);
  assert.match(headerSrc, /<PublicHeaderSearchBar search=\{headerSearch\} onClose=\{closePageSearch\} \/>/);
  assert.match(headerSrc, /hideDesktopNav \|\| effectivePageSearchActive/);

  // Normal logo/nav/action clusters are hidden when effectivePageSearchActive is true
  assert.match(headerSrc, /effectivePageSearchActive\s*\?\s*'hidden'/);
  assert.match(headerSrc, /!hideDesktopNav && !effectivePageSearchActive/);
  assert.match(headerSrc, /data-testid="header-search-trigger"/);

  // Expanded header search structure: ChevronLeft back, bare borderless input without Search icon, Filter button right
  assert.match(headerSrc, /data-testid="public-header-search-back"/);
  assert.match(headerSrc, /<ChevronLeft/);
  assert.match(headerSrc, /data-testid="public-header-search-input"/);
  assert.match(headerSrc, /bg-transparent border-0 rounded-none shadow-none/);
  assert.match(headerSrc, /data-testid="public-header-search-filter"/);
  assert.match(headerSrc, /<Filter/);
  assert.match(headerSrc, /onResetAllRef\.current\?\.\(\)/);
});

test('Public pages implementing searchbar-expand.md avoid inline search inputs and hide non-grid sections on search active', () => {
  for (const pagePath of EXPANDED_SEARCH_PUBLIC_PAGES) {
    const src = readProjectFile(pagePath);

    // Registers header.search via useAdaptiveNavConfig
    assert.match(src, /useAdaptiveNavConfig\(adaptiveNavConfig\)/, `${pagePath} must call useAdaptiveNavConfig`);
    assert.match(src, /onActiveChange:\s*setIsSearchActive/, `${pagePath} must bind onActiveChange: setIsSearchActive`);
    assert.match(src, /onResetAll:/, `${pagePath} must provide onResetAll`);
    assert.match(src, /renderFilterContent:\s*\(closeFilter\)/, `${pagePath} must provide renderFilterContent`);

    // No inline <Input> searchbar in page body
    assert.equal(/<Input\b/.test(src), false, `${pagePath} must not render inline <Input> in body`);

    // Heading & secondary sections gated behind !isSearchActive
    assert.match(src, /\{!isSearchActive &&/, `${pagePath} must hide intro headings/special UI when isSearchActive`);
  }
});

test('Portofolio page renders uniform cards (no showcase or wide cards) when isSearchActive is true', () => {
  const portfolioSrc = readProjectFile('src/pages/portofolio/index.tsx');

  // Filter options preserved in header filter dialog
  assert.match(portfolioSrc, /PORTFOLIO_SORT_OPTIONS/);
  assert.match(portfolioSrc, /categories\.length > 1/);
  assert.match(portfolioSrc, /years\.length > 1/);
  assert.match(portfolioSrc, /Reset Filter/);
  assert.match(portfolioSrc, /Selesai/);

  // Uniform search grid rendered when isSearchActive, bypassing MobilePortfolioShowcase and desktop featuredWide
  assert.match(portfolioSrc, /isSearchActive \?/);
  assert.match(portfolioSrc, /data-testid="portfolio-search-results"/);
  assert.match(portfolioSrc, /featuredWide=\{false\}/);
  assert.match(portfolioSrc, /<MobilePortfolioShowcase/);
  assert.match(portfolioSrc, /featuredWide=\{isDesktopPortfolioCardWide\(/);
});

test('Berita page renders uniform 2-column horizontal desktop / vertical mobile cards when isSearchActive is true', () => {
  const beritaSrc = readProjectFile('src/pages/berita/index.tsx');

  // Header filter dialog options
  assert.match(beritaSrc, /BERITA_SORT_OPTIONS/);
  assert.match(beritaSrc, /beritaCategories\.length > 1/);
  assert.match(beritaSrc, /Reset Filter/);
  assert.match(beritaSrc, /Selesai/);

  // Search mode skips magazine collage/banner and uses uniform AdaptiveEditorialCard in 2-col grid (mobile 2-col top-image, desktop 2-col left-image)
  assert.match(beritaSrc, /isSearchActive \?/);
  assert.match(beritaSrc, /data-testid="berita-search-results"/);
  assert.match(beritaSrc, /grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2/);
  assert.match(beritaSrc, /testId="berita-search-card"/);
  assert.match(beritaSrc, /flex flex-col h-full sm:hidden/);
  assert.match(beritaSrc, /hidden sm:grid sm:grid-cols-12 items-stretch h-full/);
  assert.match(beritaSrc, /berita-magazine-collage/);
});

test('Tips Bahan, Tentang, and Pengaturan pages remove searchbar from both header (hideSearchIcon) and page body across desktop and mobile', () => {
  for (const pagePath of [
    'src/pages/tips-interior/index.tsx',
    'src/pages/tips-interior/detail.tsx',
    'src/pages/tentang/index.tsx',
    'src/pages/pengaturan/index.tsx',
  ]) {
    const src = readProjectFile(pagePath);
    assert.match(src, /hideSearchIcon:\s*true/, `${pagePath} must set hideSearchIcon: true`);
    assert.match(src, /useAdaptiveNavConfig\(/, `${pagePath} must apply adaptive nav config`);
    assert.equal(/<Input\b/.test(src), false, `${pagePath} must not render any <Input> searchbar`);
    assert.equal(/header\.search|search:\s*\{/.test(src), false, `${pagePath} must not register header.search`);
    assert.equal(/<Search\b/.test(src), false, `${pagePath} must not render Search icon`);
  }

  const pengaturanSrc = readProjectFile('src/pages/pengaturan/index.tsx');
  assert.match(pengaturanSrc, /-mt-5 sm:-mt-9/);

  const profileFormSrc = readProjectFile('src/components/ui/user-profile-form.tsx');
  assert.match(profileFormSrc, /<FormFieldStyleProvider labelTone="thin">/);
});

test('FAQ page uses header expanded search, hides category tabs/intro on search, and keeps all FAQ cards closed by default', () => {
  const faqSrc = readProjectFile('src/pages/faq/index.tsx');

  // All FAQ accordion items start collapsed by default
  assert.match(faqSrc, /useState<string \| null>\(null\)/);
  assert.equal(/useState<string \| null>\(faqs\[0\]/.test(faqSrc), false);

  // Header filter dialog options and search mode content hiding
  assert.match(faqSrc, /FAQ_SORT_OPTIONS/);
  assert.match(faqSrc, /faqCategories\.length > 1/);
  assert.match(faqSrc, /Reset Filter/);
  assert.match(faqSrc, /Selesai/);
  assert.match(faqSrc, /data-testid="faq-header-row"/);
  assert.match(faqSrc, /data-testid="faq-category-tablist"/);
});

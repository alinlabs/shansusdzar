import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useLocation } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { Button } from '../../components/ui/button';
import { PortfolioCard } from '../../components/ui/portfolio-card';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { parseDetailSearchRedirectState } from '../../lib/detail-search-navigation';
import {
  ALL_PORTFOLIO_CATEGORIES,
  ALL_PORTFOLIO_YEARS,
  extractPortfolioCategories,
  extractPortfolioYears,
  filterPortfolioProjects,
  isDesktopPortfolioCardWide,
  syncPortfolioProjectsWithProducts,
  type PortfolioSortMode,
} from '../../lib/portfolio-filter';
import { getDefaultProductCatalog } from '../../lib/product-catalog';
import { useSiteContentStore } from '../../store/site-content-store';
import { MobilePortfolioShowcase } from './mobile-showcase';

const PORTFOLIO_SORT_OPTIONS: ReadonlyArray<{ value: PortfolioSortMode; label: string }> = [
  { value: 'random', label: 'Acak' },
  { value: 'year-desc', label: 'Tahun Terbaru' },
  { value: 'area-desc', label: 'Luas Terbesar' },
  { value: 'title-asc', label: 'Judul (A–Z)' },
];

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function PortofolioPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const beranda = useSiteContentStore((state) => state.beranda);
  const rawProjects = useSiteContentStore((state) => state.portfolioProjects);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeProducts = useMemo(
    () => (catalogOverride ?? loadedBaseCatalog ?? getDefaultProductCatalog()).daftarProduk,
    [catalogOverride, loadedBaseCatalog]
  );

  const projects = useMemo(
    () => syncPortfolioProjectsWithProducts(rawProjects, activeProducts),
    [rawProjects, activeProducts]
  );

  useDocumentTitle(
    `Portofolio Proyek | ${businessConfig.namaMerek}`,
    'Dokumentasi studi kasus penataan ruang dan pengerjaan furniture custom dari workshop Purwakarta.'
  );

  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_PORTFOLIO_CATEGORIES);
  const [selectedYear, setSelectedYear] = useState(ALL_PORTFOLIO_YEARS);
  const [sortBy, setSortBy] = useState<PortfolioSortMode>('random');
  const [shuffleSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff) + 1);
  const [isSearchActive, setIsSearchActive] = useState(() =>
    Boolean(parseDetailSearchRedirectState(location.state)?.openSearch)
  );

  const categories = useMemo(
    () => extractPortfolioCategories(projects),
    [projects]
  );
  const years = useMemo(() => extractPortfolioYears(projects), [projects]);

  const filteredProjects = useMemo(
    () =>
      filterPortfolioProjects(projects, {
        searchQuery,
        category: selectedCategory,
        year: selectedYear,
        sortBy,
        randomFn: createSeededRandom(shuffleSeed),
      }),
    [projects, searchQuery, selectedCategory, selectedYear, sortBy, shuffleSeed]
  );

  const hasPopupFilterActive =
    selectedCategory !== ALL_PORTFOLIO_CATEGORIES ||
    selectedYear !== ALL_PORTFOLIO_YEARS ||
    sortBy !== 'random';

  const resetPopupFilters = useCallback(() => {
    setSelectedCategory(ALL_PORTFOLIO_CATEGORIES);
    setSelectedYear(ALL_PORTFOLIO_YEARS);
    setSortBy('random');
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    resetPopupFilters();
  }, [resetPopupFilters]);

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        search: {
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari proyek, lokasi, atau material...',
          ariaLabel: 'Cari proyek portofolio',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasPopupFilterActive,
          onResetAll: resetFilters,
          filterAriaLabel: 'Filter dan urutkan portofolio',
          filterTitle: 'Urutkan & Filter',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Urutkan
                </p>
                <div role="radiogroup" aria-label="Urutkan portofolio" className="space-y-1">
                  {PORTFOLIO_SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSortBy(opt.value)}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer text-left',
                          isSelected
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <Check className="size-3.5 text-[var(--text)] shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {categories.length > 1 && (
                <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Kategori
                  </p>
                  <div
                    role="group"
                    aria-label="Filter kategori portofolio"
                    className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto"
                  >
                    {categories.map((cat) => {
                      const isActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSelectedCategory(cat)}
                          className={[
                            'min-h-8 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                            isActive
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
                          ].join(' ')}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {years.length > 1 && (
                <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Tahun
                  </p>
                  <div
                    role="group"
                    aria-label="Filter tahun portofolio"
                    className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto"
                  >
                    {years.map((yr) => {
                      const isActive = selectedYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSelectedYear(yr)}
                          className={[
                            'min-h-8 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                            isActive
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
                          ].join(' ')}
                        >
                          {yr === ALL_PORTFOLIO_YEARS ? 'Semua Tahun' : yr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasPopupFilterActive}
                  onClick={resetPopupFilters}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Filter
                </button>
                <button
                  type="button"
                  onClick={closeFilter}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </>
          ),
        },
      },
    }),
    [
      searchQuery,
      sortBy,
      selectedCategory,
      selectedYear,
      hasPopupFilterActive,
      categories,
      years,
      resetPopupFilters,
      resetFilters,
    ]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  return (
    <div className={isSearchActive ? undefined : 'space-y-7 sm:space-y-10'}>
      {!isSearchActive && (
        <div data-testid="portfolio-header-row">
          <SectionHeading
            as="h1"
            align="left"
            eyebrow={beranda.labelPortofolio}
            title={beranda.judulPortofolio}
            className="min-w-0"
          />
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <div className="py-12 border-t border-[var(--border)] text-center space-y-4">
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Tidak ada proyek portofolio yang sesuai
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Coba pilih kategori lain atau atur ulang kata kunci pencarian Anda.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Tampilkan Semua Portofolio
          </Button>
        </div>
      ) : isSearchActive ? (
        <div
          data-testid="portfolio-search-results"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6"
        >
          {filteredProjects.map((project, index) => (
            <PortfolioCard
              key={project.id}
              project={project}
              activeProducts={activeProducts}
              eager={index < 4}
              featuredWide={false}
              titleAs="h2"
            />
          ))}
        </div>
      ) : (
        <>
          <MobilePortfolioShowcase
            projects={filteredProjects}
            activeProducts={activeProducts}
          />
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredProjects.map((project, index) => (
              <PortfolioCard
                key={project.id}
                project={project}
                activeProducts={activeProducts}
                eager={index < 4}
                featuredWide={isDesktopPortfolioCardWide(index, filteredProjects.length)}
                titleAs="h2"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

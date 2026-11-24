import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { PortfolioCard } from '../../components/ui/portfolio-card';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
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
  { value: 'order', label: 'Urutan Kurasi' },
  { value: 'year-desc', label: 'Tahun Terbaru' },
  { value: 'area-desc', label: 'Luas Terbesar' },
  { value: 'title-asc', label: 'Judul (A–Z)' },
];

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
    `Portofolio Proyek | ${businessConfig.namaMerekSingkat}`,
    'Dokumentasi studi kasus penataan ruang dan pengerjaan furniture custom dari workshop Purwakarta.'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_PORTFOLIO_CATEGORIES);
  const [selectedYear, setSelectedYear] = useState(ALL_PORTFOLIO_YEARS);
  const [sortBy, setSortBy] = useState<PortfolioSortMode>('order');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuContainerRef = useRef<HTMLDivElement>(null);

  const publishedProjects = useMemo(() => projects.filter((p) => p.terbit), [projects]);
  const categories = useMemo(
    () => extractPortfolioCategories(publishedProjects),
    [publishedProjects]
  );
  const years = useMemo(() => extractPortfolioYears(publishedProjects), [publishedProjects]);

  const filteredProjects = useMemo(
    () =>
      filterPortfolioProjects(publishedProjects, {
        searchQuery,
        category: selectedCategory,
        year: selectedYear,
        sortBy,
      }),
    [publishedProjects, searchQuery, selectedCategory, selectedYear, sortBy]
  );

  const hasPopupFilterActive =
    selectedCategory !== ALL_PORTFOLIO_CATEGORIES ||
    selectedYear !== ALL_PORTFOLIO_YEARS ||
    sortBy !== 'order';

  const hasActiveFilter = searchQuery.trim().length > 0 || hasPopupFilterActive;

  const resetPopupFilters = () => {
    setSelectedCategory(ALL_PORTFOLIO_CATEGORIES);
    setSelectedYear(ALL_PORTFOLIO_YEARS);
    setSortBy('order');
  };

  const resetFilters = () => {
    setSearchQuery('');
    resetPopupFilters();
  };

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        filterMenuContainerRef.current &&
        !filterMenuContainerRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  return (
    <div className="space-y-7 sm:space-y-10">
      <div className="space-y-3.5">
        <div
          data-testid="portfolio-header-row"
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <SectionHeading
            as="h1"
            align="left"
            eyebrow={beranda.labelPortofolio}
            title={beranda.judulPortofolio}
            className="min-w-0"
          />

          <div
            ref={filterMenuContainerRef}
            className="relative w-full md:w-[360px] lg:w-[420px] md:ml-auto shrink-0"
          >
            <label htmlFor="portfolio-search" className="sr-only">
              Cari proyek portofolio
            </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <Input
            id="portfolio-search"
            type="text"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari proyek, lokasi, atau material..."
            className="pl-10 pr-22 outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                aria-label="Hapus kata kunci pencarian"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center justify-center size-8 rounded-[calc(var(--radius-md)-2px)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              data-testid="portfolio-filter-trigger"
              aria-label="Filter dan urutkan portofolio"
              aria-expanded={isFilterMenuOpen}
              aria-haspopup="dialog"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              className={[
                'relative inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none',
                isFilterMenuOpen || hasPopupFilterActive
                  ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
              ].join(' ')}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {hasPopupFilterActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[var(--accent)]"
                />
              )}
            </button>
          </div>

          {isFilterMenuOpen && (
            <div
              role="dialog"
              data-testid="portfolio-filter-popover"
              aria-label="Menu filter kategori, tahun, dan urutan portofolio"
              className="absolute right-0 top-full mt-2 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-[75dvh] overflow-y-auto app-scroll-region rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)] p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-[var(--text)]">
                  Urutkan &amp; Filter
                </p>
                {hasPopupFilterActive && (
                  <button
                    type="button"
                    onClick={resetPopupFilters}
                    className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] underline-offset-4 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">Urutan</p>
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
                          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs transition-colors cursor-pointer text-left',
                          isSelected
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-medium'
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
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">Kategori</p>
                  <div
                    role="group"
                    aria-label="Filter kategori portofolio"
                    className="flex flex-wrap gap-1.5"
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
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">Tahun</p>
                  <div
                    role="group"
                    aria-label="Filter tahun portofolio"
                    className="flex flex-wrap gap-1.5"
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
            </div>
          )}
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-end text-xs text-[var(--text-muted)]">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        )}
      </div>

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

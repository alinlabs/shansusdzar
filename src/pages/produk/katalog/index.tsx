import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Ruler, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Input } from '../../../components/ui/form-controls';
import { SectionHeading } from '../../../components/ui/section-heading';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { prefetchRoute } from '../../../lib/route-prefetch';
import { useSiteContentStore } from '../../../store/site-content-store';
import { SectionProductGrid } from './section-product-grid';
import type { CatalogFilterState } from './types';
import { ALL_CATEGORIES_VALUE, SORT_OPTIONS, extractAvailableCategories } from './utils';

export default function KatalogPage() {
  useDocumentTitle(
    'Produk Furniture | Shansus Dzar Indonesia',
    'Telusuri daftar produk furniture siap pesan Design & Build (Gratis Desain) atau buka kalkulator Custom Interior sesuai kategori, ukuran, material 18 mm, dan finishing pilihan Anda.'
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isLegacyCustomQuery = searchParams.get('mode') === 'custom';
  const requestedProductSlug = searchParams.get('produk');

  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  const [filters, setFilters] = useState<CatalogFilterState>({
    searchQuery: '',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'featured',
  });
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const gridStatus: 'loading' | 'error' | 'ready' = activeCatalog
    ? 'ready'
    : catalogLoadStatus === 'error'
      ? 'error'
      : 'loading';

  const categories = useMemo(
    () => extractAvailableCategories(activeCatalog?.daftarProduk ?? []),
    [activeCatalog]
  );

  const hasPopupFilterActive =
    filters.category !== ALL_CATEGORIES_VALUE || filters.sortBy !== 'featured';

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

  if (isLegacyCustomQuery) {
    return <Navigate to="/produk/custom" replace />;
  }

  if (requestedProductSlug) {
    return <Navigate to={`/produk/${encodeURIComponent(requestedProductSlug)}`} replace />;
  }

  return (
    <div className="space-y-7 sm:space-y-9">
      <div className="space-y-5">
        <SectionHeading
          as="h1"
          align="center"
          eyebrow="Koleksi Studio"
          title="Produk Furniture"
        />

        {/* Direct Searchbar & Filter Bar */}
        <div ref={filterMenuContainerRef} className="relative">
          <label htmlFor="produk-search" className="sr-only">
            Cari produk furniture
          </label>
          <Search
            className="size-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            id="produk-search"
            type="text"
            enterKeyHint="search"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            placeholder="Cari nama produk, ruangan, atau material..."
            className="pl-10 pr-22 outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {filters.searchQuery.trim().length > 0 && (
              <button
                type="button"
                aria-label="Hapus kata kunci pencarian"
                onClick={() => setFilters({ ...filters, searchQuery: '' })}
                className="inline-flex items-center justify-center size-8 rounded-[calc(var(--radius-md)-2px)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              aria-label="Filter dan urutkan produk"
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
              aria-label="Menu urutan dan kategori produk"
              className="absolute right-0 top-full mt-2 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)] p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-[var(--text)]">
                  Urutkan &amp; Filter
                </p>
                {hasPopupFilterActive && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        category: ALL_CATEGORIES_VALUE,
                        sortBy: 'featured',
                      })
                    }
                    className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] underline-offset-4 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">Urutan</p>
                <div role="radiogroup" aria-label="Urutkan produk" className="space-y-1">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = filters.sortBy === opt.nilai;
                    return (
                      <button
                        key={opt.nilai}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() =>
                          setFilters({
                            ...filters,
                            sortBy: opt.nilai,
                          })
                        }
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
                    aria-label="Filter kategori produk"
                    className="flex flex-wrap gap-1.5"
                  >
                    {categories.map((cat) => {
                      const isActive = filters.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setFilters({ ...filters, category: cat })}
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
            </div>
          )}
        </div>

        {/* Custom Interior Entry Card Directly Below Searchbar */}
        <Link
          to="/produk/custom"
          data-testid="catalog-custom-entry-card"
          onMouseEnter={() => prefetchRoute('/produk/custom')}
          onFocus={() => prefetchRoute('/produk/custom')}
          onPointerDown={() => prefetchRoute('/produk/custom')}
          className="group flex items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              aria-hidden="true"
              className="hidden sm:flex size-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] items-center justify-center text-[var(--text)] shrink-0"
            >
              <Ruler className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm sm:text-base font-semibold text-[var(--text)] leading-snug">
                Hitung Estimasi Custom Sendiri
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Harga yang Sama, Hasil Yang Lebih Customize
              </p>
            </div>
          </div>

          <ChevronRight
            className="size-5 text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:translate-x-0.5 transition-all duration-200 shrink-0"
            aria-hidden="true"
          />
        </Link>
      </div>

      <SectionProductGrid
        status={gridStatus}
        errorMessage={catalogError ?? undefined}
        catalog={activeCatalog ?? undefined}
        filters={filters}
        onFiltersChange={setFilters}
        onRetry={() => void ensureBaseCatalogLoaded(true)}
        onNavigateToCustom={() => navigate('/produk/custom')}
      />
    </div>
  );
}

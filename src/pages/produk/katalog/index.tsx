import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Ruler } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../../components/layout/adaptive-nav-context';
import { SectionHeading } from '../../../components/ui/section-heading';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { parseDetailSearchRedirectState } from '../../../lib/detail-search-navigation';
import { usePageRefreshStore } from '../../../lib/page-refresh';
import { prefetchRoute } from '../../../lib/route-prefetch';
import { useSiteContentStore } from '../../../store/site-content-store';
import { SectionProductGrid } from './section-product-grid';
import { SectionTopCatalogCollage } from './section-top-collage';
import type { CatalogFilterState } from './types';
import { ALL_CATEGORIES_VALUE, SORT_OPTIONS, extractAvailableCategories } from './utils';

export default function KatalogPage() {
  useDocumentTitle(
    'Produk Furniture | Shansus Dzar Indonesia',
    'Telusuri daftar produk furniture siap pesan Design & Build (Gratis Desain) atau buka kalkulator Custom Interior sesuai kategori, ukuran, material 18 mm, dan finishing pilihan Anda.'
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isLegacyCustomQuery = searchParams.get('mode') === 'custom';
  const requestedProductSlug = searchParams.get('produk');

  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const refreshEpoch = usePageRefreshStore((state) => state.epoch);

  const [filters, setFilters] = useState<CatalogFilterState>({
    searchQuery: '',
    category: ALL_CATEGORIES_VALUE,
    sortBy: 'featured',
  });
  const [isSearchActive, setIsSearchActive] = useState(() =>
    Boolean(parseDetailSearchRedirectState(location.state)?.openSearch)
  );

  useEffect(() => {
    void ensureBaseCatalogLoaded(refreshEpoch > 0);
  }, [ensureBaseCatalogLoaded, refreshEpoch]);

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

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        search: {
          value: filters.searchQuery,
          onChange: (nextValue) => setFilters((prev) => ({ ...prev, searchQuery: nextValue })),
          placeholder: 'Cari produk, ruangan, atau material...',
          ariaLabel: 'Cari produk furniture',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasPopupFilterActive,
          onResetAll: () =>
            setFilters({
              searchQuery: '',
              category: ALL_CATEGORIES_VALUE,
              sortBy: 'featured',
            }),
          filterAriaLabel: 'Filter dan urutkan produk',
          filterTitle: 'Urutkan & Filter',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Urutkan
                </p>
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
                          setFilters((prev) => ({
                            ...prev,
                            sortBy: opt.nilai,
                          }))
                        }
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
                    aria-label="Filter kategori produk"
                    className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto"
                  >
                    {categories.map((cat) => {
                      const isActive = filters.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setFilters((prev) => ({ ...prev, category: cat }))}
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

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasPopupFilterActive}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      category: ALL_CATEGORIES_VALUE,
                      sortBy: 'featured',
                    }))
                  }
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
    [filters.searchQuery, filters.sortBy, filters.category, hasPopupFilterActive, categories]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  if (isLegacyCustomQuery) {
    return <Navigate to="/produk/custom" replace />;
  }

  if (requestedProductSlug) {
    return <Navigate to={`/produk/${encodeURIComponent(requestedProductSlug)}`} replace />;
  }

  return (
    <div className={isSearchActive ? undefined : 'space-y-8 sm:space-y-10'}>
      {!isSearchActive && (
        <div className="space-y-5 sm:space-y-6">
          <div data-testid="produk-header-row">
            <SectionHeading
              as="h1"
              align="left"
              eyebrow="Koleksi Studio"
              title="Produk Furniture"
              className="min-w-0"
            />
          </div>

          {/* Kolase 3 Produk Termahal */}
          <SectionTopCatalogCollage
            status={gridStatus}
            catalog={activeCatalog ?? undefined}
          />

          {/* Custom Interior Entry Card Tepat di Bawah Kolase Top 3 */}
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
      )}

      {/* Katalog Produk */}
      <div
        data-testid="produk-normal-catalog"
        className={isSearchActive ? undefined : 'space-y-5 sm:space-y-6'}
      >
        {!isSearchActive && (
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
              Semua Katalog Produk
            </h2>
            {activeCatalog && (
              <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                {`${activeCatalog.daftarProduk.length} Desain`}
              </span>
            )}
          </div>
        )}

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
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Ruler, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Input } from '../../../components/ui/form-controls';
import { SectionHeading } from '../../../components/ui/section-heading';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  getCustomStartingRates,
} from '../../../lib/custom-pricing';
import { formatCurrencyIDR } from '../../../lib/price-format';
import { useSiteContentStore } from '../../../store/site-content-store';
import { SectionProductGrid } from './section-product-grid';
import type { CatalogFilterState } from './types';
import { ALL_CATEGORIES_VALUE, SORT_OPTIONS, extractAvailableCategories } from './utils';

export default function KatalogPage() {
  useDocumentTitle(
    'Produk Furniture | Shansus Dzar Indonesia',
    'Telusuri daftar produk furniture siap pesan atau buka perencana Custom Interior untuk menghitung estimasi biaya desain, build, atau keduanya sesuai ukuran ruangan Anda.'
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isLegacyCustomQuery = searchParams.get('mode') === 'custom';
  const requestedProductSlug = searchParams.get('produk');

  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const customPricing = useSiteContentStore((state) => state.customPricing);
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

  const startingRates = useMemo(() => {
    const pricingConfig = {
      mataUang: 'IDR' as const,
      persentaseDp: customPricing?.persentaseDp ?? INDICATIVE_ESTIMATE_CONFIG.persentaseDp,
      hargaCustomTerkonfigurasi:
        customPricing?.hargaCustomTerkonfigurasi ??
        INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi,
    };
    const rules = customPricing?.rules ?? INDICATIVE_WORKSHOP_ESTIMATE_RULES;
    return getCustomStartingRates(pricingConfig, rules);
  }, [customPricing]);

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

  const designRateLabel = formatCurrencyIDR(startingRates.designPerSqm);
  const buildRateLabel = formatCurrencyIDR(startingRates.minBuildPerSqm);
  const bothRateLabel = formatCurrencyIDR(startingRates.minDesignAndBuildPerSqm);

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

        {/* Custom Interior & Design Entry Strip Directly Below Searchbar */}
        <div className="py-5 border-y border-[var(--border)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="size-10 sm:size-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)] shrink-0">
                <Ruler className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold text-[var(--text)]">
                  Hitung Estimasi Desain &amp; Build Custom (/m²)
                </p>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                  Pilih layanan sesuai kebutuhan: buat desainnya saja dulu, produksi (build) saja, atau paket lengkap keduanya.
                </p>
              </div>
            </div>

            <Link
              to="/produk/custom"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] hover:border-[var(--accent)] text-xs font-medium text-[var(--text)] transition-colors whitespace-nowrap self-start sm:self-center shrink-0"
            >
              Buka Kalkulator Custom
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] pt-3 border-t border-[var(--border)]">
            <Link
              to="/produk/custom?layanan=design-only"
              className="group py-2.5 sm:py-1 sm:pr-4 hover:opacity-80 transition-opacity flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)]">Desain Saja</p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {startingRates.isConfigured && designRateLabel
                    ? `${designRateLabel}/m²`
                    : 'Konsultasi'}
                </p>
              </div>
              <ArrowRight
                className="size-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] shrink-0"
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/produk/custom?layanan=build-only"
              className="group py-2.5 sm:py-1 sm:px-4 hover:opacity-80 transition-opacity flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)]">Build Saja</p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {startingRates.isConfigured && buildRateLabel
                    ? `Mulai ${buildRateLabel}/m²`
                    : 'Konsultasi'}
                </p>
              </div>
              <ArrowRight
                className="size-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] shrink-0"
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/produk/custom?layanan=design-and-build"
              className="group py-2.5 sm:py-1 sm:pl-4 hover:opacity-80 transition-opacity flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)]">Desain + Build</p>
                <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  {startingRates.isConfigured && bothRateLabel
                    ? `Mulai ${bothRateLabel}/m²`
                    : 'Konsultasi'}
                </p>
              </div>
              <ArrowRight
                className="size-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] shrink-0"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
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

import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ProductCard } from '../../../components/ui/product-card';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { ProductCatalogDocument, ProductItem } from '../../../types/product';
import type { CatalogFilterState } from './types';
import { ALL_CATEGORIES_VALUE, filterAndSortProducts } from './utils';

export interface SectionProductGridProps {
  status: 'loading' | 'error' | 'ready';
  errorMessage?: string;
  catalog?: ProductCatalogDocument;
  filters: CatalogFilterState;
  onFiltersChange: (next: CatalogFilterState) => void;
  onSelectProduct?: (product: ProductItem) => void;
  onRetry: () => void;
  onNavigateToCustom: () => void;
}

export function SectionProductGrid({
  status,
  errorMessage,
  catalog,
  filters,
  onFiltersChange,
  onSelectProduct,
  onRetry,
  onNavigateToCustom,
}: SectionProductGridProps) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const products = catalog?.daftarProduk ?? [];

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, filters, customPricing),
    [products, filters, customPricing]
  );

  const hasActiveFilter =
    filters.searchQuery.trim().length > 0 ||
    filters.category !== ALL_CATEGORIES_VALUE ||
    filters.sortBy !== 'featured';

  const resetFilters = () => {
    onFiltersChange({
      searchQuery: '',
      category: ALL_CATEGORIES_VALUE,
      sortBy: 'featured',
    });
  };

  return (
    <div className="space-y-8">
      {status === 'loading' && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6"
          aria-busy="true"
          aria-label="Memuat daftar produk"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="aspect-[4/5] bg-[var(--surface-muted)]" />
              <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-h-[54px] sm:min-h-[60px] flex items-center justify-between gap-2 border-t border-[var(--border)]">
                <div className="h-3 w-8 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-24 rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="p-6 border border-[var(--danger-border)] bg-[var(--danger-surface)] rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--danger)]">
              Data Produk Tidak Dapat Dimuat
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {errorMessage || 'Periksa berkas public/produk/produk.json atau coba muat ulang.'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Coba Lagi
          </Button>
        </div>
      )}

      {status === 'ready' && catalog && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="py-12 border-t border-[var(--border)] text-center space-y-4">
              <div className="space-y-1.5 max-w-md mx-auto">
                <p className="text-base font-medium text-[var(--text)]">
                  Tidak ada produk yang cocok dengan pencarian Anda
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Coba ubah kata kunci atau pilih kategori lain, atau rancang ukuran khusus di
                  halaman Custom Interior.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {hasActiveFilter && (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Reset Filter
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={onNavigateToCustom}>
                  Hitung Estimasi Custom
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelectProduct}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

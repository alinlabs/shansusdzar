import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { ImageFallback } from '../../../components/ui/image-fallback';
import { resolveCatalogStartingPrice } from '../../../lib/catalog-pricing';
import { getProductCoverImage, getProductSlug } from '../../../lib/product-catalog';
import { prefetchRoute } from '../../../lib/route-prefetch';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { ProductCatalogDocument, ProductItem } from '../../../types/product';
import { selectTopCollageProducts } from './utils';

export interface SectionTopCatalogCollageProps {
  status: 'loading' | 'error' | 'ready';
  catalog?: ProductCatalogDocument;
}

function getCollageSpanClass(index: number, totalCount: number): string {
  if (totalCount === 1) {
    return 'col-span-2 md:col-span-12 md:row-span-2 aspect-[16/10] md:aspect-auto';
  }
  if (totalCount === 2) {
    return index === 0
      ? 'col-span-2 md:col-span-7 md:row-span-2 aspect-[16/10] md:aspect-auto'
      : 'col-span-2 md:col-span-5 md:row-span-2 aspect-[16/10] md:aspect-auto';
  }
  if (index === 0) {
    return 'col-span-2 md:col-span-7 md:row-span-2 aspect-[16/10] md:aspect-auto';
  }
  return 'col-span-1 md:col-span-5 md:row-span-1 aspect-[5/4] md:aspect-auto';
}

function CollageShowcaseTile({
  product,
  index,
  totalCount,
}: {
  product: ProductItem;
  index: number;
  totalCount: number;
}) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const priceDisplay = resolveCatalogStartingPrice(product, customPricing);
  const slug = getProductSlug(product);
  const targetUrl = `/produk/${encodeURIComponent(slug)}`;
  const isHeroTile = index === 0;
  const spanClass = getCollageSpanClass(index, totalCount);

  return (
    <Link
      to={targetUrl}
      data-testid={`produk-collage-card-${index}`}
      onMouseEnter={() => prefetchRoute(targetUrl)}
      onFocus={() => prefetchRoute(targetUrl)}
      onPointerDown={() => prefetchRoute(targetUrl)}
      className={[
        'group relative block overflow-hidden image-clip-frame rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] card-hover-surface',
        'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
        spanClass,
      ].join(' ')}
    >
      <ImageFallback
        src={getProductCoverImage(product)}
        alt={`Desain katalog ${product.nama} (${product.kategori})`}
        aspectRatio="auto"
        eager
        fallbackLabel="Gambar"
        className="size-full rounded-none border-0"
        imgClassName="image-hover-zoom"
      />

      {priceDisplay.promoActive && priceDisplay.discountPercentLabel && (
        <span
          className={[
            'pointer-events-none absolute z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border border-red-500 bg-red-600 text-white text-[10px] sm:text-xs font-semibold leading-tight tabular-nums shadow-sm',
            isHeroTile ? 'top-3 left-3' : 'top-2.5 left-2.5 sm:top-3 sm:left-3',
          ].join(' ')}
        >
          <span className="hidden md:inline">Hemat</span>
          <span>{priceDisplay.discountPercentLabel}</span>
        </span>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 via-black/10 to-transparent"
      />

      <ArrowUpRight
        aria-hidden="true"
        className={[
          'pointer-events-none absolute z-10 text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white',
          isHeroTile ? 'top-3.5 right-3.5 size-4 sm:size-[18px]' : 'top-3 right-3 size-4',
        ].join(' ')}
      />

      <div
        aria-hidden="true"
        className={[
          'pointer-events-none absolute -inset-x-px -bottom-px transform-gpu bg-gradient-to-t from-black/90 via-black/55 to-transparent',
          isHeroTile ? 'h-[62%]' : 'h-[78%] sm:h-[70%]',
        ].join(' ')}
      />

      <div
        className={[
          'pointer-events-none absolute inset-x-0 bottom-0',
          isHeroTile
            ? 'flex items-end justify-between gap-3 p-4 sm:p-6'
            : 'flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3 p-2.5 sm:p-4',
        ].join(' ')}
      >
        <div className="min-w-0 space-y-0.5 sm:space-y-1">
          <p className="text-[10px] sm:text-xs font-medium text-white/85 leading-tight truncate">
            {product.kategori}
          </p>
          <h2
            className={[
              'font-semibold text-white leading-snug',
              isHeroTile
                ? 'text-base sm:text-xl lg:text-2xl line-clamp-2'
                : 'text-xs sm:text-base line-clamp-2',
            ].join(' ')}
          >
            {product.nama}
          </h2>
        </div>

        <div
          className={[
            'flex flex-col shrink-0 tabular-nums leading-tight',
            isHeroTile ? 'items-end text-right' : 'items-start text-left sm:items-end sm:text-right',
          ].join(' ')}
        >
          {priceDisplay.promoActive && priceDisplay.compareAtFormattedAmount ? (
            <span
              className={[
                'font-light text-white/80 whitespace-nowrap',
                isHeroTile ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]',
              ].join(' ')}
            >
              Hanya{' '}
              <span className="line-through decoration-white/65">
                {priceDisplay.compareAtFormattedAmount}
              </span>
            </span>
          ) : (
            <span
              className={[
                'font-light text-white/75 whitespace-nowrap',
                isHeroTile ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]',
              ].join(' ')}
            >
              Mulai dari
            </span>
          )}
          <span
            className={[
              'font-semibold text-white whitespace-nowrap',
              isHeroTile ? 'text-sm sm:text-base lg:text-lg' : 'text-xs sm:text-sm',
            ].join(' ')}
          >
            {priceDisplay.formattedAmount}
            <span className="font-normal text-white/80">/{priceDisplay.pricingUnitLabel}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SectionTopCatalogCollage({
  status,
  catalog,
}: SectionTopCatalogCollageProps) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const collageProducts = useMemo(
    () => selectTopCollageProducts(catalog?.daftarProduk ?? [], 3, customPricing),
    [catalog, customPricing]
  );

  if (status === 'loading') {
    return (
      <section aria-label="Memuat sorotan 3 desain katalog" aria-busy="true">
        <div className="grid grid-cols-2 md:grid-cols-12 md:grid-rows-2 md:h-[420px] lg:h-[468px] gap-2.5 sm:gap-4">
          <div className="col-span-2 md:col-span-7 md:row-span-2 aspect-[16/10] md:aspect-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]" />
          <div className="col-span-1 md:col-span-5 md:row-span-1 aspect-[4/3] md:aspect-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]" />
          <div className="col-span-1 md:col-span-5 md:row-span-1 aspect-[4/3] md:aspect-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]" />
        </div>
      </section>
    );
  }

  if (status !== 'ready' || collageProducts.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Sorotan 3 desain katalog utama"
      data-testid="produk-top-collage"
      className="space-y-3"
    >
      <div className="grid grid-cols-2 md:grid-cols-12 md:grid-rows-2 md:h-[420px] lg:h-[468px] gap-2.5 sm:gap-4">
        {collageProducts.map((product, index) => (
          <CollageShowcaseTile
            key={product.id}
            product={product}
            index={index}
            totalCount={collageProducts.length}
          />
        ))}
      </div>
    </section>
  );
}

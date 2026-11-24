import { Link } from 'react-router';
import type { ProductItem } from '../../types/product';
import { ImageFallback } from './image-fallback';
import { resolveCatalogStartingPrice } from '../../lib/catalog-pricing';
import { getProductCoverImage, getProductSlug } from '../../lib/product-catalog';
import { useSiteContentStore } from '../../store/site-content-store';

export interface ProductCardProps {
  product: ProductItem;
  to?: string;
  onSelect?: (product: ProductItem) => void;
  eagerImage?: boolean;
}

export function ProductCard({
  product,
  to,
  onSelect,
  eagerImage = false,
}: ProductCardProps) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const priceDisplay = resolveCatalogStartingPrice(product, customPricing);

  const primaryImage = getProductCoverImage(product);
  const imageAlt = `Ilustrasi referensi ${product.nama} untuk ${product.kategori}`;
  const targetUrl = to ?? `/produk/${encodeURIComponent(getProductSlug(product))}`;

  const cardContent = (
    <div className="relative flex h-full flex-col overflow-hidden image-clip-frame rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] card-hover-surface">
      <div className="relative overflow-hidden bg-[var(--surface-muted)]">
        <ImageFallback
          src={primaryImage}
          alt={imageAlt}
          aspectRatio="4/5"
          eager={eagerImage}
          fallbackLabel="Gambar"
          className="rounded-none border-0"
          imgClassName="image-hover-zoom"
        />

        {priceDisplay.promoActive && priceDisplay.discountPercentLabel && (
          <span className="pointer-events-none absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border border-red-500 bg-red-600 text-white text-[10px] sm:text-[11px] font-semibold leading-tight tabular-nums shadow-sm">
            <span className="hidden md:inline">Hemat</span>
            <span>{priceDisplay.discountPercentLabel}</span>
          </span>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-px -bottom-px h-[calc(50%+2px)] transform-gpu bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4 space-y-0.5">
          <p className="text-[10px] sm:text-xs font-medium text-white/80 leading-tight truncate">
            {product.kategori}
          </p>
          <h3 className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2">
            {product.nama}
          </h3>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-between gap-2 min-h-[54px] sm:min-h-[60px] border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3 tabular-nums">
        {priceDisplay.isStartingFrom ? (
          <span className="text-[11px] sm:text-xs font-medium text-[var(--text-muted)] leading-tight shrink-0">
            Est.
          </span>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="flex flex-col items-end text-right leading-tight min-w-0">
          {priceDisplay.promoActive && priceDisplay.compareAtFormattedAmount && (
            <span className="text-[10px] sm:text-[11px] font-medium text-[var(--text-subtle)] line-through truncate max-w-full">
              {priceDisplay.compareAtFormattedAmount}
            </span>
          )}
          <span className="text-xs sm:text-sm font-bold text-[var(--text)] truncate max-w-full">
            {priceDisplay.formattedAmount}
            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)]">
              /{priceDisplay.pricingUnitLabel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );

  if (onSelect) {
    return (
      <article className="group h-full">
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="block h-full w-full text-left cursor-pointer rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
        >
          {cardContent}
        </button>
      </article>
    );
  }

  return (
    <article className="group h-full">
      <Link
        to={targetUrl}
        className="block h-full rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
      >
        {cardContent}
      </Link>
    </article>
  );
}

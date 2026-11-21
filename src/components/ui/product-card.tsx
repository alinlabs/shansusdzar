import { Link } from 'react-router';
import type { ProductItem } from '../../types/product';
import { ImageFallback } from './image-fallback';
import { resolveCatalogStartingPrice } from '../../lib/catalog-pricing';
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

  const primaryImage = product.daftarGambar[0] ?? null;
  const imageAlt = `Ilustrasi referensi ${product.nama} untuk ${product.kategori}`;
  const targetUrl = to ?? `/produk/${encodeURIComponent(product.slug)}`;

  const hasComparePrice = Boolean(
    priceDisplay.promoActive && priceDisplay.compareAtFormattedAmount
  );

  const cardContent = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--border-strong)] group-hover:shadow-md">
      <div className="relative overflow-hidden bg-[var(--surface-muted)]">
        <ImageFallback
          src={primaryImage}
          alt={imageAlt}
          aspectRatio="4/5"
          eager={eagerImage}
          fallbackLabel="Gambar"
          className="rounded-none border-0 pb-10 sm:pb-12"
          imgClassName="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />

        {priceDisplay.promoActive && priceDisplay.discountPercent !== null && (
          <span
            data-testid="product-card-promo-badge"
            className="pointer-events-none absolute top-0 right-0 z-10 inline-flex items-center justify-center rounded-bl-xl sm:rounded-bl-2xl bg-[#facc15] px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-bold leading-none tracking-tight text-[#18181b] shadow-xs tabular-nums"
          >
            {`Hemat ${priceDisplay.discountPercent}%`}
          </span>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
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

      <div className="flex flex-1 items-center justify-between gap-2 min-h-[54px] sm:min-h-[60px] border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3 tabular-nums">
        {priceDisplay.isStartingFrom ? (
          <span className="text-[11px] sm:text-xs font-medium text-[var(--text-muted)] leading-tight shrink-0">
            Est.
          </span>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className="flex flex-col items-end text-right leading-tight min-w-0">
          {hasComparePrice && priceDisplay.compareAtFormattedAmount && (
            <del className="relative inline-block max-w-full no-underline text-[11px] sm:text-xs text-[var(--text-muted)]">
              <span className="block truncate">{priceDisplay.compareAtFormattedAmount}</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-0.5 top-1/2 h-[1.25px] -translate-y-1/2 -rotate-[3.5deg] rounded-full bg-red-600/65 dark:bg-red-400/65"
              />
            </del>
          )}
          <span className="text-xs sm:text-sm font-bold text-[var(--text)] truncate max-w-full">
            {priceDisplay.formattedAmount}
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

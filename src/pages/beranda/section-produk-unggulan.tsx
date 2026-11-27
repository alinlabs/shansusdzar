import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { resolveCatalogStartingPrice } from '../../lib/catalog-pricing';
import { getProductCoverImage, getProductSlug } from '../../lib/product-catalog';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import type { ProductItem } from '../../types/product';
import { pickRandomProducts } from './utils';

const COLLAGE_TILE_SPANS = [
  'col-span-2 md:col-span-6 md:row-span-2 aspect-[16/9] md:aspect-auto',
  'col-span-1 md:col-span-6 md:row-span-1 aspect-[4/5] md:aspect-auto',
  'col-span-1 md:col-span-3 md:row-span-1 aspect-[4/5] md:aspect-auto',
  'col-span-2 md:col-span-3 md:row-span-1 aspect-[2/1] md:aspect-auto',
  'hidden md:block md:col-span-3 md:row-span-1 md:aspect-auto',
  'hidden md:block md:col-span-3 md:row-span-1 md:aspect-auto',
  'hidden md:block md:col-span-6 md:row-span-1 md:aspect-auto',
] as const;

function CatalogCollageTile({
  product,
  index,
}: {
  product: ProductItem;
  index: number;
}) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const priceDisplay = resolveCatalogStartingPrice(product, customPricing);
  const spanClass =
    COLLAGE_TILE_SPANS[index] ?? 'hidden md:block md:col-span-3 md:row-span-1 md:aspect-auto';
  const isHeroTile = index === 0;
  const targetUrl = `/produk/${encodeURIComponent(getProductSlug(product))}`;

  return (
    <Link
      to={targetUrl}
      onMouseEnter={() => prefetchRoute(targetUrl)}
      onFocus={() => prefetchRoute(targetUrl)}
      aria-label={`Lihat detail ${product.nama}`}
      className={[
        'group relative block w-full text-left overflow-hidden image-clip-frame rounded-[var(--radius-lg)] bg-[var(--surface-muted)] cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
        spanClass,
      ].join(' ')}
    >
      <ImageFallback
        src={getProductCoverImage(product)}
        alt={product.nama}
        aspectRatio="auto"
        fallbackLabel="Gambar"
        className="size-full rounded-none border-0"
        imgClassName="image-hover-zoom"
      />

      {priceDisplay.promoActive && priceDisplay.discountPercentLabel && (
        <span className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border border-red-500 bg-red-600 text-white text-[10px] sm:text-xs font-semibold leading-tight tabular-nums shadow-sm">
          <span className="hidden md:inline">Hemat</span>
          <span>{priceDisplay.discountPercentLabel}</span>
        </span>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-px -bottom-px h-[calc(50%+2px)] transform-gpu bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />

      <div
        className={[
          'pointer-events-none absolute inset-x-0 bottom-0 space-y-0.5',
          isHeroTile ? 'p-4 sm:p-6' : 'p-3 sm:p-4',
        ].join(' ')}
      >
        <p className="text-[10px] sm:text-xs font-medium text-white/80 leading-tight truncate">
          {product.kategori}
        </p>
        <h3
          className={[
            'font-semibold text-white leading-snug',
            isHeroTile ? 'text-base sm:text-xl' : 'text-xs sm:text-sm',
          ].join(' ')}
        >
          {product.nama}
        </h3>
      </div>
    </Link>
  );
}

export function SectionProdukUnggulan() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const showcaseProducts = useMemo(
    () => pickRandomProducts(activeCatalog?.daftarProduk ?? [], 7),
    [activeCatalog]
  );

  const isLoading = !activeCatalog && (catalogLoadStatus === 'idle' || catalogLoadStatus === 'loading');
  const isError = !activeCatalog && catalogLoadStatus === 'error';

  return (
    <section aria-labelledby="produk-unggulan-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="produk-unggulan-heading"
        align="center"
        eyebrow={beranda.labelUnggulan}
        title={beranda.judulUnggulan}
      />

      {isLoading && (
        <div
          className="grid grid-cols-2 md:grid-cols-12 md:auto-rows-[190px] lg:auto-rows-[210px] gap-3 sm:gap-4"
          aria-busy="true"
        >
          {COLLAGE_TILE_SPANS.map((spanClass, idx) => (
            <div
              key={idx}
              className={`rounded-[var(--radius-lg)] bg-[var(--surface-muted)] border border-[var(--border)] ${spanClass}`}
            />
          ))}
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)] text-sm text-[var(--text-muted)]"
        >
          {catalogError || 'Gagal memuat koleksi pilihan.'}
        </div>
      )}

      {activeCatalog && (
        <div className="grid grid-cols-2 md:grid-cols-12 md:auto-rows-[190px] lg:auto-rows-[210px] gap-3 sm:gap-4">
          {showcaseProducts.map((product, index) => (
            <CatalogCollageTile key={product.id} product={product} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

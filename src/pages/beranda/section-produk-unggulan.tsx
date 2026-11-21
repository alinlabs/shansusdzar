import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ImageFallback } from '../../components/ui/image-fallback';
import { Modal } from '../../components/ui/modal';
import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';
import type { ProductItem } from '../../types/product';
import {
  extractBaseMaterialBadges,
  extractDimensionBadges,
  extractFinishingBadges,
} from '../produk/katalog/utils';

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
  onSelect,
}: {
  product: ProductItem;
  index: number;
  onSelect: (product: ProductItem) => void;
}) {
  const spanClass =
    COLLAGE_TILE_SPANS[index] ?? 'hidden md:block md:col-span-3 md:row-span-1 md:aspect-auto';
  const isHeroTile = index === 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={[
        'group relative block w-full text-left overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-muted)] cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
        spanClass,
      ].join(' ')}
    >
      <ImageFallback
        src={product.daftarGambar[0]}
        alt={product.nama}
        aspectRatio="auto"
        fallbackLabel="Gambar"
        className="size-full rounded-none border-0 pb-10 sm:pb-12"
        imgClassName="transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.03]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
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
    </button>
  );
}

export function SectionProdukUnggulan() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const featuredProducts = useMemo(() => {
    const all = activeCatalog?.daftarProduk ?? [];
    const featured = all.filter((p) => p.unggulan);
    const others = all.filter((p) => !p.unggulan);
    return [...featured, ...others].slice(0, 7);
  }, [activeCatalog]);

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
          {catalogError || 'Gagal memuat koleksi unggulan.'}
        </div>
      )}

      {activeCatalog && (
        <div className="grid grid-cols-2 md:grid-cols-12 md:auto-rows-[190px] lg:auto-rows-[210px] gap-3 sm:gap-4">
          {featuredProducts.map((product, index) => (
            <CatalogCollageTile
              key={product.id}
              product={product}
              index={index}
              onSelect={setSelectedProduct}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.nama ?? ''}
        description={selectedProduct?.kategori}
        size="md"
        closeLabel={selectedProduct ? `Tutup informasi ${selectedProduct.nama}` : 'Tutup dialog'}
        customHeader={
          selectedProduct
            ? ({ titleId, onClose, closeLabel }) => (
                <div className="relative shrink-0 border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <ImageFallback
                    src={selectedProduct.daftarGambar[0]}
                    alt={`Ilustrasi referensi ${selectedProduct.nama}`}
                    aspectRatio="16/9"
                    eager
                    fallbackLabel="Gambar"
                    className="rounded-none border-0 pb-12 sm:pb-14"
                  />

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                  />

                  <button
                    type="button"
                    aria-label={closeLabel}
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 inline-flex items-center justify-center size-10 rounded-full bg-black/45 text-white hover:bg-black/65 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 py-4 sm:px-6 sm:py-5 space-y-0.5">
                    <p className="text-xs font-medium text-white/85 leading-tight truncate">
                      {selectedProduct.kategori}
                    </p>
                    <h2
                      id={titleId}
                      className="text-lg sm:text-xl font-semibold text-white leading-snug"
                    >
                      {selectedProduct.nama}
                    </h2>
                  </div>
                </div>
              )
            : undefined
        }
      >
        {selectedProduct && (() => {
          const dimensionBadges = extractDimensionBadges(selectedProduct.dimensi);
          const baseMaterialBadges = extractBaseMaterialBadges(selectedProduct);
          const finishingBadges = extractFinishingBadges(selectedProduct);

          return (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text)] leading-relaxed">
                {selectedProduct.deskripsiSingkat}
              </p>

              <div className="space-y-3.5 text-sm">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Dimensi Referensi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dimensionBadges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] text-xs font-medium leading-tight tabular-nums"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {baseMaterialBadges.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--text-muted)]">Material Utama</p>
                    <div className="flex flex-wrap gap-1.5">
                      {baseMaterialBadges.map((mat) => (
                        <span
                          key={mat}
                          className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] text-xs font-medium leading-tight"
                        >
                          {mat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {finishingBadges.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--text-muted)]">Finishing/Laminasi</p>
                    <div className="flex flex-wrap gap-1.5">
                      {finishingBadges.map((fin) => (
                        <span
                          key={fin}
                          className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] text-xs font-medium leading-tight"
                        >
                          {fin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </section>
  );
}

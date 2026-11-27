import { VisualMediaStage } from '../../../components/ui/visual-media-stage';
import type { ProductColorOption, ProductItem } from '../../../types/product';
import { getProduct3dModelSrc, type ProductVisualSlide } from './detail-logic';

export interface SectionVisualStageProps {
  product: ProductItem;
  slides: ProductVisualSlide[];
  includedItems: string[];
  selectedColor?: ProductColorOption;
  selectedFinishLabel?: string;
}

export function SectionVisualStage({
  product,
  slides,
  includedItems,
  selectedColor,
  selectedFinishLabel,
}: SectionVisualStageProps) {
  const model3dSrc = getProduct3dModelSrc(product);

  return (
    <div className="lg:col-span-7 space-y-3">
      <VisualMediaStage
        itemKey={product.id}
        itemTitle={product.nama}
        slides={slides}
        galleryAriaLabel={`Galeri visual ${product.nama}`}
        miniGalleryAriaLabel="Mini galeri visual produk"
        model3dSrc={model3dSrc}
        selectedColor={selectedColor}
        selectedFinishLabel={selectedFinishLabel}
      />

      {/* Product Category, Title, and Description (Desktop only — mobile displays category & title in header) */}
      <div className="hidden md:block space-y-1">
        <p className="text-xs font-medium text-[var(--text)]">{product.kategori}</p>
        <h1
          id="product-detail-title"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] leading-tight"
        >
          {product.nama}
        </h1>

        <div className="space-y-1">
          <p className="text-xs md:text-sm text-[var(--text-muted)] leading-relaxed text-justify">
            {product.deskripsiSingkat}
          </p>

          {includedItems.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-xs font-medium text-[var(--text)]">Sudah Termasuk (Include)</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:text-sm text-[var(--text-muted)] leading-relaxed">
                {includedItems.map((itemText) => (
                  <li key={itemText} className="flex items-start gap-1.5">
                    <span aria-hidden="true" className="shrink-0">
                      •
                    </span>
                    <span>{itemText}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

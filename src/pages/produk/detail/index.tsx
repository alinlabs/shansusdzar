import { useParams } from 'react-router';
import {
  ProductDetailErrorState,
  ProductDetailLoadingState,
  ProductDetailNotFoundState,
} from './detail-states';
import { SectionRelatedProducts } from './section-related-products';
import { SectionVariantConfigurator } from './section-variant-configurator';
import { SectionVisualStage } from './section-visual-stage';
import { useProductDetail } from './use-product-detail';

export default function KatalogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const {
    isLoading,
    isError,
    catalogError,
    retryLoad,
    product,
    slides,
    detailDerived,
    activeConfig,
    customLengthInputRef,
    setSelectedColorId,
    setSelectedMaterialLabel,
    setSelectedFinishLabel,
    setSelectedCustomisasi,
    setCustomLengthCm,
    setCustomWidthCm,
    handleSelectPresetSize,
    handleRestoreRecommendedSize,
    handleToggleCustomSize,
    handleDecreaseQty,
    handleIncreaseQty,
    handleAddToCart,
  } = useProductDetail(slug);

  if (isLoading) {
    return <ProductDetailLoadingState />;
  }

  if (isError) {
    return <ProductDetailErrorState errorMessage={catalogError} onRetry={retryLoad} />;
  }

  if (!product || !detailDerived) {
    return <ProductDetailNotFoundState />;
  }

  return (
    <div className="space-y-12 sm:space-y-14">
      <section
        aria-label={product.nama}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 lg:gap-12 items-start"
      >
        <SectionVisualStage
          product={product}
          slides={slides}
          includedItems={detailDerived.includedItems}
          selectedColor={detailDerived.selectedColor}
          selectedFinishLabel={detailDerived.activeFinishLabel}
        />

        <SectionVariantConfigurator
          product={product}
          detailDerived={detailDerived}
          customLengthCm={activeConfig.customLengthCm}
          customWidthCm={activeConfig.customWidthCm}
          isCustomSizeMode={activeConfig.isCustomSizeMode}
          quantity={activeConfig.quantity}
          customLengthInputRef={customLengthInputRef}
          onCustomLengthChange={setCustomLengthCm}
          onCustomWidthChange={setCustomWidthCm}
          onSelectPresetSize={handleSelectPresetSize}
          onRestoreRecommendedSize={handleRestoreRecommendedSize}
          onToggleCustomSize={handleToggleCustomSize}
          onSelectColorId={setSelectedColorId}
          onSelectCustomisasi={setSelectedCustomisasi}
          onSelectMaterialLabel={setSelectedMaterialLabel}
          onSelectFinishLabel={setSelectedFinishLabel}
          onDecreaseQuantity={handleDecreaseQty}
          onIncreaseQuantity={handleIncreaseQty}
          onAddToCart={handleAddToCart}
        />
      </section>

      <SectionRelatedProducts relatedProducts={detailDerived.relatedProducts} />
    </div>
  );
}

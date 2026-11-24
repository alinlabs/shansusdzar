import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../../components/layout/adaptive-nav-context';
import { useDocumentTitle, useJsonLdSchema } from '../../../hooks/use-document-title';
import {
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  getDefaultProductDimensionsCm,
} from '../../../lib/catalog-pricing';
import { DEFAULT_UNIVERSAL_COLOR } from '../../../lib/color-palette';
import { getProductCoverImage, getProductSlug } from '../../../lib/product-catalog';
import { buildProductJsonLd } from '../../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../../lib/site-url';
import { useCartStore } from '../../../store/cart-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import { useUserProfileStore } from '../../../store/user-profile-store';
import type { ProductItem } from '../../../types/product';
import { CustomLiveSummary } from '../custom/components/custom-live-summary';
import { buildProductVisualSlides, computeProductDetailDerived } from './detail-logic';

interface ProductDetailConfigState {
  productId: string | null;
  selectedColorId: string;
  selectedMaterialLabel: string;
  selectedFinishLabel: string;
  selectedCustomisasi: string | null;
  customLengthCm: string;
  customWidthCm: string;
  isCustomSizeMode: boolean;
  quantity: number;
}

function createInitialConfigState(product: ProductItem | null): ProductDetailConfigState {
  if (!product) {
    return {
      productId: null,
      selectedColorId: DEFAULT_UNIVERSAL_COLOR.id,
      selectedMaterialLabel: '',
      selectedFinishLabel: '',
      selectedCustomisasi: null,
      customLengthCm: '200',
      customWidthCm: '150',
      isCustomSizeMode: false,
      quantity: 1,
    };
  }

  const mats = getAvailableMaterialLabelsFromTariff(product);
  const fins = getAvailableFinishLabelsFromTariff(product);
  const defaultDims = getDefaultProductDimensionsCm(product);

  return {
    productId: product.id,
    selectedColorId: DEFAULT_UNIVERSAL_COLOR.id,
    selectedMaterialLabel: mats[0] ?? 'Blockboard',
    selectedFinishLabel: fins[0] ?? 'HPL',
    selectedCustomisasi: product.customisasi[0] ?? null,
    customLengthCm: String(defaultDims.lengthCm),
    customWidthCm: String(defaultDims.widthCm),
    isCustomSizeMode: false,
    quantity: 1,
  };
}

export function useProductDetail(slug: string | undefined) {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  const addProductItem = useCartStore((state) => state.addProductItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const profile = useUserProfileStore((state) => state.profile);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const products = activeCatalog?.daftarProduk ?? [];

  const product = useMemo<ProductItem | null>(() => {
    if (!slug || products.length === 0) return null;
    return products.find((item) => getProductSlug(item) === slug) ?? null;
  }, [products, slug]);

  const slides = useMemo(() => (product ? buildProductVisualSlides(product) : []), [product]);

  const [config, setConfig] = useState<ProductDetailConfigState>(() =>
    createInitialConfigState(product)
  );
  const customLengthInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(createInitialConfigState(product));
  }, [product?.id]);

  // Synchronously resolve fresh defaults when switching products so there is no 1-frame stale config
  const activeConfig =
    product && config.productId !== product.id ? createInitialConfigState(product) : config;

  const updateConfig = useCallback(
    (updater: (current: ProductDetailConfigState) => ProductDetailConfigState) => {
      setConfig((prev) => {
        const current =
          product && prev.productId !== product.id ? createInitialConfigState(product) : prev;
        return updater(current);
      });
    },
    [product]
  );

  const originUrl = getRuntimeSiteOrigin();

  useDocumentTitle(
    product
      ? `${product.nama} · Produk | ${businessConfig.namaMerekSingkat}`
      : `Detail Produk | ${businessConfig.namaMerekSingkat}`,
    product
      ? product.deskripsiSingkat
      : 'Detail produk furniture dan penataan interior custom Shansus Dzar Indonesia.',
    product
      ? {
          ogType: 'website',
          ogImage: getProductCoverImage(product) ?? undefined,
          keywords: [
            product.nama,
            product.kategori,
            ...getAvailableMaterialLabelsFromTariff(product),
            ...getAvailableFinishLabelsFromTariff(product),
          ],
        }
      : undefined
  );

  const productSchema = useMemo(
    () => (product ? buildProductJsonLd(product, businessConfig, originUrl) : null),
    [product, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-product-detail-schema', productSchema);

  const detailDerived = useMemo(() => {
    if (!product) return null;
    return computeProductDetailDerived({
      product,
      products,
      businessConfig,
      customPricing,
      selectedColorId: activeConfig.selectedColorId,
      selectedMaterialLabel: activeConfig.selectedMaterialLabel,
      selectedFinishLabel: activeConfig.selectedFinishLabel,
      selectedCustomisasi: activeConfig.selectedCustomisasi,
      customLengthCm: activeConfig.customLengthCm,
      customWidthCm: activeConfig.customWidthCm,
      isCustomSizeMode: activeConfig.isCustomSizeMode,
      quantity: activeConfig.quantity,
      userProfile: profile,
    });
  }, [activeConfig, businessConfig, customPricing, product, products, profile]);

  const setSelectedColorId = useCallback(
    (selectedColorId: string) => updateConfig((prev) => ({ ...prev, selectedColorId })),
    [updateConfig]
  );

  const setSelectedMaterialLabel = useCallback(
    (selectedMaterialLabel: string) =>
      updateConfig((prev) => ({ ...prev, selectedMaterialLabel })),
    [updateConfig]
  );

  const setSelectedFinishLabel = useCallback(
    (selectedFinishLabel: string) => updateConfig((prev) => ({ ...prev, selectedFinishLabel })),
    [updateConfig]
  );

  const setSelectedCustomisasi = useCallback(
    (selectedCustomisasi: string) => updateConfig((prev) => ({ ...prev, selectedCustomisasi })),
    [updateConfig]
  );

  const setCustomLengthCm = useCallback(
    (customLengthCm: string) => updateConfig((prev) => ({ ...prev, customLengthCm })),
    [updateConfig]
  );

  const setCustomWidthCm = useCallback(
    (customWidthCm: string) => updateConfig((prev) => ({ ...prev, customWidthCm })),
    [updateConfig]
  );

  const handleSelectPresetSize = useCallback(
    (lengthCm: number, widthCm: number) => {
      updateConfig((prev) => ({
        ...prev,
        isCustomSizeMode: false,
        customLengthCm: String(lengthCm),
        customWidthCm: String(widthCm),
      }));
    },
    [updateConfig]
  );

  const handleRestoreRecommendedSize = useCallback(() => {
    if (!detailDerived) return;
    const { lengthCm, widthCm } = detailDerived.defaultDimensions;
    updateConfig((prev) => ({
      ...prev,
      isCustomSizeMode: false,
      customLengthCm: String(lengthCm),
      customWidthCm: String(widthCm),
    }));
  }, [detailDerived, updateConfig]);

  const handleToggleCustomSize = useCallback(() => {
    if (activeConfig.isCustomSizeMode) {
      handleRestoreRecommendedSize();
      return;
    }
    updateConfig((prev) => ({ ...prev, isCustomSizeMode: true }));
    window.requestAnimationFrame(() => {
      customLengthInputRef.current?.focus();
    });
  }, [activeConfig.isCustomSizeMode, handleRestoreRecommendedSize, updateConfig]);

  const handleDecreaseQty = useCallback(() => {
    updateConfig((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }));
  }, [updateConfig]);

  const handleIncreaseQty = useCallback(() => {
    updateConfig((prev) => ({ ...prev, quantity: Math.min(99, prev.quantity + 1) }));
  }, [updateConfig]);

  const handleAddToCart = useCallback(() => {
    if (!product || !detailDerived) return;

    const optionsPayload: Record<string, string> = {
      Paket: detailDerived.serviceModeLabel,
      Ukuran: detailDerived.dimensionLabelText,
      ...(detailDerived.activeCustomisasi
        ? { Customisasi: detailDerived.activeCustomisasi }
        : {}),
      'Material Utama': detailDerived.activeMaterialLabel,
      'Finishing/Laminasi': detailDerived.activeFinishLabel,
      ...(detailDerived.includedItems.length > 0
        ? { 'Include (Gratis)': detailDerived.includedItems.join(', ') }
        : {}),
    };

    addProductItem({
      productId: product.id,
      slug: getProductSlug(product),
      name: product.nama,
      category: product.kategori,
      image: getProductCoverImage(product),
      selectedColorName: detailDerived.selectedColor.nama ?? null,
      selectedColorHex: detailDerived.selectedColor.hex ?? null,
      selectedOptions: optionsPayload,
      quantity: activeConfig.quantity,
      unitPrice: detailDerived.variantPrice.unitPrice,
      priceStatus: detailDerived.isCatDucoSelected ? 'mulai' : 'tetap',
    });
    openDrawer();
  }, [activeConfig.quantity, addProductItem, detailDerived, openDrawer, product]);

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(() => {
    const headerConfig = {
      hideDesktopNav: true,
      hideDesktopAccountIcons: true,
      backTo: '/produk',
      backAriaLabel: 'Kembali ke daftar produk',
      ...(product
        ? {
            mobileEyebrow: product.kategori,
            mobileTitle: product.nama,
          }
        : {}),
    };

    if (!detailDerived) {
      return {
        header: headerConfig,
        bottom: null,
      };
    }

    return {
      header: headerConfig,
      bottom: {
        type: 'product-detail',
        priceLabel: detailDerived.formattedDisplayPrice,
        compareAtPriceLabel: detailDerived.variantPrice.promoActive
          ? detailDerived.formattedCompareAtDisplayPrice
          : null,
        promoPercentLabel: detailDerived.variantPrice.promoActive
          ? detailDerived.variantPrice.promoPercentLabel
          : null,
        quantity: activeConfig.quantity,
        onDecreaseQuantity: handleDecreaseQty,
        onIncreaseQuantity: handleIncreaseQty,
        canDecreaseQuantity: activeConfig.quantity > 1,
        canIncreaseQuantity: activeConfig.quantity < 99,
        consultationHref: detailDerived.whatsappInquiry,
        consultationLabel: 'Konsultasi',
        onConsultationAction: () => {
          if (product) {
            syncProfileActivity(`Konsultasi produk: ${product.nama}`, [
              'profil-user',
              'konsultasi-wa',
            ]);
          }
        },
        primaryLabel: 'Tambah Sekarang',
        onPrimaryAction: handleAddToCart,
        dropUpEyebrow: product?.kategori,
        dropUpTitle: product?.nama ?? 'Rincian Estimasi Produk',
        renderDropUp: () =>
          createElement(CustomLiveSummary, {
            embedded: true,
            hasSelectedProduct: Boolean(product),
            itemLabel: product?.nama ?? 'Memuat produk',
            itemCategory: product?.kategori,
            productPromo: product?.promo,
            finishId: detailDerived.variantPrice.finishId ?? undefined,
            quantity: activeConfig.quantity,
            estimate: detailDerived.estimateBreakdown,
          }),
      },
    };
  }, [
    activeConfig.quantity,
    detailDerived,
    handleAddToCart,
    handleDecreaseQty,
    handleIncreaseQty,
    product,
    syncProfileActivity,
  ]);

  useAdaptiveNavConfig(adaptiveNavConfig);

  const isLoading = !activeCatalog && (catalogLoadStatus === 'idle' || catalogLoadStatus === 'loading');
  const isError = !activeCatalog && catalogLoadStatus === 'error';

  return {
    isLoading,
    isError,
    catalogError,
    retryLoad: () => void ensureBaseCatalogLoaded(true),
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
  };
}

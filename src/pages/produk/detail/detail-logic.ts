import {
  calculateCatalogVariantPrice,
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  type CatalogVariantPriceResult,
} from '../../../lib/catalog-pricing';
import { DEFAULT_UNIVERSAL_COLOR, UNIVERSAL_COLOR_PALETTE } from '../../../lib/color-palette';
import {
  UNIFIED_SERVICE_MODE_LABEL,
  type CustomEstimateBreakdown,
} from '../../../lib/custom-pricing';
import { formatCurrencyIDR } from '../../../lib/price-format';
import {
  getProductCoverImage,
  parseReferenceSizeCm,
  resolveProductMediaEntry,
} from '../../../lib/product-catalog';
import {
  resolveVideoSource,
  type ResolvedVideoSource,
  type VisualMediaSlide,
} from '../../../lib/visual-media';
import { buildDynamicWhatsAppUrl } from '../../../store/site-content-store';
import {
  appendProfileToWhatsAppMessage,
  type UserProfileData,
} from '../../../store/user-profile-store';
import type { BusinessConfig } from '../../../types/business';
import type { CustomInteriorPricingConfig } from '../../../types/cms';
import type { ProductColorOption, ProductItem } from '../../../types/product';

export type { ResolvedVideoSource };
export { resolveVideoSource };

export type ParsedReferenceSizeCm = NonNullable<ReturnType<typeof parseReferenceSizeCm>>;

export const DEFAULT_UNIT_DIMENSIONS_CM = {
  lengthCm: 100,
  widthCm: 100,
} as const;

export type Resolved3dSource =
  | { kind: 'glb'; src: string }
  | { kind: 'invalid'; src: '' };

export type ProductVisualSlide = VisualMediaSlide;

export interface ProductDetailDerived {
  selectedColor: ProductColorOption;
  defaultDimensions: { lengthCm: number; widthCm: number };
  activeLengthCm: number;
  activeWidthCm: number;
  activeAreaSqm: number;
  dimensionLabelText: string;
  availableMaterialLabels: string[];
  availableFinishLabels: string[];
  activeMaterialLabel: string;
  activeFinishLabel: string;
  activeCustomisasi: string | null;
  variantPrice: CatalogVariantPriceResult;
  isCatDucoSelected: boolean;
  formattedDisplayPrice: string;
  formattedCompareAtDisplayPrice: string | null;
  serviceModeLabel: string;
  measureUnitDisplay: string;
  relatedProducts: ProductItem[];
  includedItems: string[];
  referenceSizePresets: ParsedReferenceSizeCm[];
  matchedPresetSize: ParsedReferenceSizeCm | null;
  isCustomActive: boolean;
  whatsappInquiry: string;
  estimateBreakdown: CustomEstimateBreakdown;
}



export function resolve3dModelSource(rawUrl: string): Resolved3dSource {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: 'invalid', src: '' };

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { kind: 'glb', src: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { kind: 'invalid', src: '' };
    }
    return { kind: 'glb', src: parsed.toString() };
  } catch {
    return { kind: 'invalid', src: '' };
  }
}

export function getProduct3dModelSrc(product: Pick<ProductItem, '3d'>): string | null {
  const raw = product['3d'];
  if (!raw) return null;
  const resolved = resolve3dModelSource(raw);
  return resolved.kind === 'glb' ? resolved.src : null;
}

export function buildProductVisualSlides(product: ProductItem): ProductVisualSlide[] {
  const coverImage = product.gambarSampul?.trim() || getProductCoverImage(product);
  const orderedMediaSlides: ProductVisualSlide[] = [];
  let imageCount = 0;
  let videoCount = 0;

  product.media.forEach((mediaItem, idx) => {
    const resolvedEntry = resolveProductMediaEntry(mediaItem);
    if (!resolvedEntry) return;

    if (resolvedEntry.type === 'video') {
      if (resolveVideoSource(resolvedEntry.url).kind === 'invalid') return;
      videoCount += 1;
      orderedMediaSlides.push({
        id: `${product.id}-slide-media-${idx}`,
        kind: 'video',
        src: resolvedEntry.url,
        poster: resolvedEntry.poster || coverImage || '/images/atelier-studio-craft.webp',
        title: resolvedEntry.judul || `Video ${videoCount} · ${product.nama}`,
      });
      return;
    }

    imageCount += 1;
    orderedMediaSlides.push({
      id: `${product.id}-slide-media-${idx}`,
      kind: 'image',
      src: resolvedEntry.url,
      title: resolvedEntry.judul || `Foto ${imageCount} · ${product.nama}`,
    });
  });

  if (orderedMediaSlides.length > 0) {
    return orderedMediaSlides;
  }

  if (coverImage) {
    return [
      {
        id: `${product.id}-slide-cover`,
        kind: 'image',
        src: coverImage,
        title: `Foto 1 · ${product.nama}`,
      },
    ];
  }

  return [
    {
      id: `${product.id}-slide-img-placeholder`,
      kind: 'image',
      src: null,
      title: `Referensi ${product.nama}`,
    },
  ];
}

export function getRelatedProducts(
  currentProduct: ProductItem,
  allProducts: readonly ProductItem[],
  limit = 4
): ProductItem[] {
  const sameCategory = allProducts.filter(
    (item) => item.id !== currentProduct.id && item.kategori === currentProduct.kategori
  );
  const others = allProducts.filter(
    (item) => item.id !== currentProduct.id && item.kategori !== currentProduct.kategori
  );
  return [...sameCategory, ...others].slice(0, Math.max(0, limit));
}

export function buildProductDetailWhatsAppMessage(params: {
  brandName: string;
  productName: string;
  category: string;
  serviceModeLabel?: string | null;
  priceLabel: string | null;
  selectedColorName: string | null;
  selectedOptions: Record<string, string>;
  quantity: number;
  selectedDimensionRef?: string | null;
}): string {
  const optionEntries = Object.entries(params.selectedOptions);
  const optionSummary = optionEntries.map(([k, v]) => `${k}: ${v}`).join(', ');

  return [
    `Halo ${params.brandName},`,
    'Saya ingin memesan / menanyakan unit katalog dengan konfigurasi berikut:',
    `- Produk: ${params.productName}`,
    `- Kategori: ${params.category}`,
    params.serviceModeLabel ? `- Layanan: ${params.serviceModeLabel}` : null,
    params.priceLabel ? `- Estimasi Harga: ${params.priceLabel}` : null,
    params.selectedDimensionRef ? `- Ukuran: ${params.selectedDimensionRef}` : null,
    params.selectedColorName ? `- Warna Pilihan: ${params.selectedColorName}` : null,
    optionSummary ? `- Spesifikasi Pilihan: ${optionSummary}` : null,
    `- Jumlah: ${params.quantity} unit`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function computeProductDetailDerived(params: {
  product: ProductItem;
  products: readonly ProductItem[];
  businessConfig: BusinessConfig;
  customPricing: CustomInteriorPricingConfig | null | undefined;
  selectedColorId: string;
  selectedMaterialLabel: string;
  selectedFinishLabel: string;
  selectedCustomisasi: string | null;
  customLengthCm: string;
  customWidthCm: string;
  isCustomSizeMode: boolean;
  selectedPresetNormalized?: string | null;
  quantity: number;
  userProfile?: UserProfileData | null;
}): ProductDetailDerived {
  const {
    product,
    products,
    businessConfig,
    customPricing,
    selectedColorId,
    selectedMaterialLabel,
    selectedFinishLabel,
    selectedCustomisasi,
    customLengthCm,
    customWidthCm,
    isCustomSizeMode,
    selectedPresetNormalized,
    quantity,
    userProfile,
  } = params;

  const selectedColor =
    UNIVERSAL_COLOR_PALETTE.find((c) => c.id === selectedColorId) ?? DEFAULT_UNIVERSAL_COLOR;
  const defaultDimensions = { ...DEFAULT_UNIT_DIMENSIONS_CM };

  const rawCustomLen = Number(customLengthCm.replace(',', '.'));
  const rawCustomWid = Number(customWidthCm.replace(',', '.'));
  const activeLengthCm =
    Number.isFinite(rawCustomLen) && rawCustomLen > 0
      ? Math.round(rawCustomLen)
      : defaultDimensions.lengthCm;
  const activeWidthCm =
    Number.isFinite(rawCustomWid) && rawCustomWid > 0
      ? Math.round(rawCustomWid)
      : defaultDimensions.widthCm;
  const activeAreaSqm = Math.max(
    0.0001,
    Math.round(((activeLengthCm * activeWidthCm) / 10000) * 10000) / 10000
  );

  const availableMaterialLabels = getAvailableMaterialLabelsFromTariff(product);
  const availableFinishLabels = getAvailableFinishLabelsFromTariff(product);
  const activeMaterialLabel =
    selectedMaterialLabel && availableMaterialLabels.includes(selectedMaterialLabel)
      ? selectedMaterialLabel
      : (availableMaterialLabels[0] ?? 'Blockboard');
  const activeFinishLabel =
    selectedFinishLabel && availableFinishLabels.includes(selectedFinishLabel)
      ? selectedFinishLabel
      : (availableFinishLabels[0] ?? 'HPL');
  const activeCustomisasi =
    product.customisasi.length > 0
      ? selectedCustomisasi && product.customisasi.includes(selectedCustomisasi)
        ? selectedCustomisasi
        : product.customisasi[0]
      : null;

  const variantPrice = calculateCatalogVariantPrice({
    product,
    areaSqm: activeAreaSqm,
    lengthCm: activeLengthCm,
    materialLabel: activeMaterialLabel,
    finishLabel: activeFinishLabel,
    siteCustomPricing: customPricing,
  });

  const safeQty = Math.max(1, Math.min(99, quantity));
  const totalPrice = variantPrice.unitPrice * safeQty;
  const compareAtTotalPrice =
    variantPrice.promoActive && variantPrice.compareAtUnitPrice !== null
      ? variantPrice.compareAtUnitPrice * safeQty
      : null;
  const isCatDucoSelected = variantPrice.finishId === 'cat-duco';
  const formattedDisplayPrice = formatCurrencyIDR(totalPrice) ?? `Rp ${totalPrice}`;
  const formattedCompareAtDisplayPrice =
    compareAtTotalPrice !== null
      ? (formatCurrencyIDR(compareAtTotalPrice) ?? `Rp ${compareAtTotalPrice}`)
      : null;
  const formattedUnitPriceForInquiry =
    formatCurrencyIDR(variantPrice.unitPrice) ?? `Rp ${variantPrice.unitPrice}`;
  const serviceModeLabel = UNIFIED_SERVICE_MODE_LABEL;

  const measureUnitDisplay =
    variantPrice.pricingUnit === 'm2'
      ? `${activeAreaSqm} m²`
      : `${variantPrice.measureQuantity} m`;
  const dimensionLabelText = `${activeLengthCm}×${activeWidthCm} cm (${measureUnitDisplay})`;
  const measurePrefix =
    safeQty > 1 ? `${safeQty} unit × ${measureUnitDisplay}` : measureUnitDisplay;
  const priceBreakdownSummary = `${measurePrefix} · ${serviceModeLabel} · ${activeMaterialLabel} + ${activeFinishLabel}`;

  const relatedProducts = getRelatedProducts(product, products, 4);
  const includedItems = product.include ?? [];

  const referenceSizePresets = product.referensiUkuran
    .map((rawSize) => parseReferenceSizeCm(rawSize))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 3);
  const matchedPresetSize = isCustomSizeMode
    ? null
    : selectedPresetNormalized !== undefined
      ? selectedPresetNormalized === null
        ? null
        : (referenceSizePresets.find((preset) => preset.normalized === selectedPresetNormalized) ??
          null)
      : (referenceSizePresets.find(
          (preset) => preset.lengthCm === activeLengthCm && preset.widthCm === activeWidthCm
        ) ?? null);
  const isCustomActive = isCustomSizeMode || !matchedPresetSize;

  const whatsappOptionsPayload: Record<string, string> = {
    ...(activeCustomisasi ? { Customisasi: activeCustomisasi } : {}),
    'Material Utama': activeMaterialLabel,
    'Finishing/Laminasi': activeFinishLabel,
    ...(includedItems.length > 0 ? { 'Include (Gratis)': includedItems.join(', ') } : {}),
  };

  const baseInquiryText = buildProductDetailWhatsAppMessage({
    brandName: businessConfig.namaMerek,
    productName: product.nama,
    category: product.kategori,
    serviceModeLabel,
    priceLabel: `${isCatDucoSelected ? 'Mulai ' : ''}${formattedUnitPriceForInquiry}/unit (${priceBreakdownSummary})`,
    selectedColorName: selectedColor.nama ?? null,
    selectedOptions: whatsappOptionsPayload,
    quantity: safeQty,
    selectedDimensionRef: dimensionLabelText,
  });

  const whatsappInquiry = buildDynamicWhatsAppUrl(
    businessConfig,
    userProfile ? appendProfileToWhatsAppMessage(baseInquiryText, userProfile) : baseInquiryText
  );

  const lengthMeters = Math.max(0.001, Math.round((activeLengthCm / 100) * 10000) / 10000);
  const rawDpPercentage = customPricing?.persentaseDp;
  const dpPercentage =
    typeof rawDpPercentage === 'number' &&
    Number.isFinite(rawDpPercentage) &&
    rawDpPercentage > 0 &&
    rawDpPercentage <= 100
      ? rawDpPercentage
      : 30;
  const estimatedDpUnitAmount = Math.round((variantPrice.unitPrice * dpPercentage) / 100);
  const estimateBreakdown: CustomEstimateBreakdown = {
    status: 'configured',
    serviceMode: variantPrice.serviceMode,
    pricingCategoryId: variantPrice.pricingCategoryId,
    pricingUnit: variantPrice.pricingUnit,
    pricingUnitLabel: variantPrice.pricingUnitLabel,
    measureQuantity: variantPrice.measureQuantity,
    lengthMeters,
    areaSquareMeters: activeAreaSqm,
    unitRate: variantPrice.effectivePerSqmRate,
    compareAtUnitRate: variantPrice.compareAtEffectivePerSqmRate,
    designRatePerSqm: variantPrice.designRatePerSqm,
    materialRatePerSqm: variantPrice.materialRatePerSqm,
    finishingRatePerSqm: variantPrice.finishingRatePerSqm,
    designAmount: variantPrice.designAmount,
    materialAmount: variantPrice.materialAmount,
    finishingAmount: variantPrice.finishingAmount,
    buildAmount: variantPrice.buildAmount,
    baseAmount: variantPrice.buildAmount,
    optionsAmount: 0,
    estimatedUnitTotal: variantPrice.unitPrice,
    estimatedLineTotal: totalPrice,
    dpPercentage,
    estimatedDpUnitAmount,
    estimatedDpLineTotal: estimatedDpUnitAmount * safeQty,
    disclaimer: '',
  };

  return {
    selectedColor,
    defaultDimensions,
    activeLengthCm,
    activeWidthCm,
    activeAreaSqm,
    dimensionLabelText,
    availableMaterialLabels,
    availableFinishLabels,
    activeMaterialLabel,
    activeFinishLabel,
    activeCustomisasi,
    variantPrice,
    isCatDucoSelected,
    formattedDisplayPrice,
    formattedCompareAtDisplayPrice,
    serviceModeLabel,
    measureUnitDisplay,
    relatedProducts,
    includedItems,
    referenceSizePresets,
    matchedPresetSize,
    isCustomActive,
    whatsappInquiry,
    estimateBreakdown,
  };
}

import type { CustomServiceMode } from '../types/cart';
import type { CustomInteriorPricingConfig } from '../types/cms';
import type { ProductItem } from '../types/product';
import {
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  resolveCategoryMatrixRate,
  resolveProductPricingCategory,
  type CustomPricingRules,
  type CustomPricingUnit,
  type ProductPricingCategoryKey,
} from './custom-pricing';
import { formatCurrencyIDR } from './price-format';
import { getProductSlug, parseReferenceSizeCm } from './product-catalog';

export type ParsedProductPromo =
  | { kind: 'percent'; value: number }
  | { kind: 'nominal'; value: number };

export interface ProductPromoCalculation {
  promoActive: boolean;
  promoMode: 'percent' | 'nominal' | null;
  promoPercent: number | null;
  promoPercentLabel: string | null;
  markupAmount: number;
  compareAtPrice: number | null;
}

export interface CatalogVariantPriceResult {
  unitPrice: number;
  promoActive: boolean;
  compareAtUnitPrice: number | null;
  promoPercent: number | null;
  promoPercentLabel: string | null;
  promoNominal: number | null;
  pricingCategoryId: ProductPricingCategoryKey;
  pricingUnit: CustomPricingUnit;
  pricingUnitLabel: string;
  measureQuantity: number;
  areaSqm: number;
  serviceMode: CustomServiceMode;
  designRatePerSqm: number;
  materialRatePerSqm: number;
  finishingRatePerSqm: number;
  effectivePerSqmRate: number;
  compareAtDesignRatePerSqm: number | null;
  compareAtMaterialRatePerSqm: number | null;
  compareAtFinishingRatePerSqm: number | null;
  compareAtEffectivePerSqmRate: number | null;
  designAmount: number;
  materialAmount: number;
  finishingAmount: number;
  buildAmount: number;
  isLinkedToCustomPricing: boolean;
  materialId: string | null;
  finishId: string | null;
}

export interface CatalogStartingPriceResult {
  numericPrice: number;
  formattedAmount: string;
  label: string;
  isStartingFrom: boolean;
  promoActive: boolean;
  compareAtNumericPrice: number | null;
  compareAtFormattedAmount: string | null;
  compareAtLabel: string | null;
  discountPercent: number | null;
  discountPercentLabel: string | null;
}

const CANONICAL_MATERIAL_LABELS: Record<string, string> = {
  blockboard: 'Blockboard',
  multipleks: 'Multipleks',
  pvc: 'PVC Board',
};

const CANONICAL_MATERIAL_ORDER = ['blockboard', 'multipleks', 'pvc'] as const;

export function parseProductPromo(
  raw: string | number | null | undefined
): ParsedProductPromo | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return { kind: 'nominal', value: Math.round(raw) };
  }

  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const pctMatch = trimmed.match(/^([+-]?\d+(?:[.,]\d+)?)\s*%$/);
  if (pctMatch) {
    const pctValue = Number(pctMatch[1].replace(',', '.'));
    if (!Number.isFinite(pctValue) || pctValue <= 0) return null;
    return { kind: 'percent', value: pctValue };
  }

  const withoutPrefix = trimmed.replace(/^rp\.?\s*/i, '').trim();
  if (/^-/.test(withoutPrefix)) return null;

  let nominalValue: number;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(withoutPrefix)) {
    nominalValue = Number(withoutPrefix.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(withoutPrefix)) {
    nominalValue = Number(withoutPrefix.replace(/,/g, ''));
  } else if (/^\d+([.,]\d+)?$/.test(withoutPrefix)) {
    nominalValue = Number(withoutPrefix.replace(',', '.'));
  } else {
    return null;
  }

  if (!Number.isFinite(nominalValue) || nominalValue <= 0) return null;
  return { kind: 'nominal', value: Math.round(nominalValue) };
}

function formatPromoPercentLabel(percentValue: number): string {
  const clean = Number.isInteger(percentValue)
    ? String(percentValue)
    : String(Math.round(percentValue * 10) / 10).replace('.', ',');
  return `${clean}%`;
}

export function resolveProductPromoMarkup(
  currentPrice: number | null | undefined,
  promo: string | number | null | undefined
): ProductPromoCalculation {
  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      promoActive: false,
      promoMode: null,
      promoPercent: null,
      promoPercentLabel: null,
      markupAmount: 0,
      compareAtPrice: null,
    };
  }

  const parsed = parseProductPromo(promo);
  if (!parsed) {
    return {
      promoActive: false,
      promoMode: null,
      promoPercent: null,
      promoPercentLabel: null,
      markupAmount: 0,
      compareAtPrice: null,
    };
  }

  if (parsed.kind === 'percent') {
    const markupAmount = Math.round(currentPrice * (parsed.value / 100));
    if (markupAmount <= 0) {
      return {
        promoActive: false,
        promoMode: null,
        promoPercent: null,
        promoPercentLabel: null,
        markupAmount: 0,
        compareAtPrice: null,
      };
    }
    const promoPercent = Number.isInteger(parsed.value)
      ? parsed.value
      : Math.round(parsed.value * 10) / 10;
    return {
      promoActive: true,
      promoMode: 'percent',
      promoPercent,
      promoPercentLabel: formatPromoPercentLabel(promoPercent),
      markupAmount,
      compareAtPrice: currentPrice + markupAmount,
    };
  }

  const markupAmount = Math.round(parsed.value);
  if (markupAmount <= 0) {
    return {
      promoActive: false,
      promoMode: null,
      promoPercent: null,
      promoPercentLabel: null,
      markupAmount: 0,
      compareAtPrice: null,
    };
  }

  const rawPercent = (markupAmount / currentPrice) * 100;
  const promoPercent =
    rawPercent < 1
      ? Math.max(0.1, Math.round(rawPercent * 10) / 10)
      : Math.round(rawPercent);

  return {
    promoActive: true,
    promoMode: 'nominal',
    promoPercent,
    promoPercentLabel: formatPromoPercentLabel(promoPercent),
    markupAmount,
    compareAtPrice: currentPrice + markupAmount,
  };
}

export function calculateDiscountPercent(
  currentPrice: number | null | undefined,
  compareAtPrice: number | null | undefined
): number | null {
  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    typeof compareAtPrice !== 'number' ||
    !Number.isFinite(compareAtPrice) ||
    compareAtPrice <= currentPrice
  ) {
    return null;
  }

  return Math.max(1, Math.round(((compareAtPrice - currentPrice) / compareAtPrice) * 100));
}

function roundLengthMeters(value: number): number {
  return Math.max(0.001, Math.round(value * 10000) / 10000);
}

function roundAreaSqm(value: number): number {
  return Math.max(0.0001, Math.round(value * 10000) / 10000);
}

export function getDefaultProductDimensionsCm(product: ProductItem): {
  lengthCm: number;
  widthCm: number;
  lengthMeters: number;
  areaSqm: number;
} {
  const primarySize = Array.isArray(product.referensiUkuran)
    ? product.referensiUkuran[0]
    : product.referensiUkuran;
  const parsed = parseReferenceSizeCm(primarySize);
  if (parsed) {
    return {
      lengthCm: parsed.lengthCm,
      widthCm: parsed.widthCm,
      lengthMeters: roundLengthMeters(parsed.lengthCm / 100),
      areaSqm: roundAreaSqm((parsed.lengthCm * parsed.widthCm) / 10000),
    };
  }

  return { lengthCm: 200, widthCm: 220, lengthMeters: 2, areaSqm: 4.4 };
}

export function mapOptionLabelToMaterialId(label: string | null | undefined): string | null {
  if (!label) return null;
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  if (norm.includes('blockboard') || norm.includes('block board')) return 'blockboard';
  if (norm.includes('multiplek') || norm.includes('plywood')) return 'multipleks';
  if (norm.includes('pvc')) return 'pvc';
  return null;
}

export function mapOptionLabelToFinishId(label: string | null | undefined): string | null {
  if (!label) return null;
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  if (norm.includes('duco') || norm.includes('cat')) return 'cat-duco';
  if (norm.includes('hpl') || norm.includes('high pressure') || norm.includes('laminat')) {
    return 'hpl';
  }
  return null;
}

function isPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

export function getAvailableMaterialIdsFromTariff(product: ProductItem): string[] {
  const harga = product.harga;
  if (!harga) {
    return [...CANONICAL_MATERIAL_ORDER];
  }

  const positiveIds: string[] = [];
  for (const id of CANONICAL_MATERIAL_ORDER) {
    if (isPositiveNumber(harga.hpl?.[id]) || isPositiveNumber(harga.duco?.[id])) {
      positiveIds.push(id);
    }
  }
  for (const [key, val] of Object.entries(harga.hpl ?? {})) {
    if (!positiveIds.includes(key) && isPositiveNumber(val)) {
      positiveIds.push(key);
    }
  }
  for (const [key, val] of Object.entries(harga.duco ?? {})) {
    if (!positiveIds.includes(key) && isPositiveNumber(val)) {
      positiveIds.push(key);
    }
  }

  return positiveIds;
}

export function getAvailableMaterialLabelsFromTariff(product: ProductItem): string[] {
  return getAvailableMaterialIdsFromTariff(product).map(
    (id) => CANONICAL_MATERIAL_LABELS[id] ?? id
  );
}

export function getAvailableFinishIdsFromTariff(product: ProductItem): string[] {
  const harga = product.harga;
  if (!harga) {
    return ['hpl', 'cat-duco'];
  }

  const finishes: string[] = [];
  const hasAnyHpl = Object.values(harga.hpl ?? {}).some((v) => isPositiveNumber(v));
  if (hasAnyHpl) {
    finishes.push('hpl');
  }
  const hasAnyDuco = Object.values(harga.duco ?? {}).some((v) => isPositiveNumber(v));
  if (hasAnyDuco) {
    finishes.push('cat-duco');
  }
  return finishes;
}

export function getAvailableFinishLabelsFromTariff(product: ProductItem): string[] {
  return getAvailableFinishIdsFromTariff(product).map((id) =>
    id === 'cat-duco' ? 'Cat Duco' : 'HPL'
  );
}

function getEffectiveRules(
  siteCustomPricing?: CustomInteriorPricingConfig | null
): CustomPricingRules {
  const base = INDICATIVE_WORKSHOP_ESTIMATE_RULES;
  const siteRules = siteCustomPricing?.rules;
  if (!siteRules) return base;

  return {
    ...base,
    ...siteRules,
    hargaBahanPerMeterPersegi: {
      ...base.hargaBahanPerMeterPersegi,
      ...siteRules.hargaBahanPerMeterPersegi,
    },
    hargaFinishingPerMeterPersegi: {
      ...base.hargaFinishingPerMeterPersegi,
      ...siteRules.hargaFinishingPerMeterPersegi,
    },
    tarifPerKategori: siteRules.tarifPerKategori
      ? {
          ...(base.tarifPerKategori ?? {}),
          ...siteRules.tarifPerKategori,
        }
      : base.tarifPerKategori,
  };
}

function resolveProductPairRate(params: {
  product: ProductItem;
  materialId: string;
  finishId: string;
  rules: CustomPricingRules;
}): {
  categoryId: ProductPricingCategoryKey;
  unit: CustomPricingUnit;
  unitLabel: string;
  unitRate: number;
} {
  const categoryId = resolveProductPricingCategory(
    `${params.product.id} ${getProductSlug(params.product)} ${params.product.nama}`
  );
  const matrix = resolveCategoryMatrixRate({
    categoryId,
    materialId: params.materialId,
    finishId: params.finishId,
    rules: params.rules,
  });

  const resolvedUnit: CustomPricingUnit =
    params.product.meterLari === true ? 'm' : 'm2';
  const resolvedUnitLabel = resolvedUnit === 'm2' ? 'm²' : 'm';

  const productUnitTariffRate =
    params.finishId === 'cat-duco' || params.finishId === 'duco'
      ? params.product.harga?.duco?.[params.materialId]
      : params.product.harga?.hpl?.[params.materialId];

  const baseRate = isPositiveNumber(productUnitTariffRate)
    ? productUnitTariffRate
    : (matrix.ratePerUnit ?? 1800000);

  return {
    categoryId,
    unit: resolvedUnit,
    unitLabel: resolvedUnitLabel,
    unitRate: baseRate,
  };
}

export function calculateCatalogVariantPrice(params: {
  product: ProductItem;
  serviceMode?: CustomServiceMode;
  areaSqm: number;
  lengthCm?: number;
  materialLabel?: string | null;
  finishLabel?: string | null;
  siteCustomPricing?: CustomInteriorPricingConfig | null;
}): CatalogVariantPriceResult {
  const { product } = params;
  const serviceMode: CustomServiceMode = 'design-and-build';
  const safeArea = roundAreaSqm(params.areaSqm || 1);
  const safeLengthMeters =
    typeof params.lengthCm === 'number' && Number.isFinite(params.lengthCm) && params.lengthCm > 0
      ? roundLengthMeters(params.lengthCm / 100)
      : roundLengthMeters(getDefaultProductDimensionsCm(product).lengthMeters);

  const rules = getEffectiveRules(params.siteCustomPricing);

  const availableMaterialIds = getAvailableMaterialIdsFromTariff(product);
  const availableFinishIds = getAvailableFinishIdsFromTariff(product);

  const resolvedMaterialId =
    mapOptionLabelToMaterialId(params.materialLabel) ??
    availableMaterialIds[0] ??
    'blockboard';
  const resolvedFinishId =
    mapOptionLabelToFinishId(params.finishLabel) ??
    availableFinishIds[0] ??
    'hpl';

  const pairRate = resolveProductPairRate({
    product,
    materialId: resolvedMaterialId,
    finishId: resolvedFinishId,
    rules,
  });

  const measureQuantity = pairRate.unit === 'm2' ? safeArea : safeLengthMeters;
  const unitRate = pairRate.unitRate;
  const buildAmount = Math.round(measureQuantity * unitRate);

  const materialRatePerSqm = resolvedFinishId === 'cat-duco' ? 0 : unitRate;
  const finishingRatePerSqm = resolvedFinishId === 'cat-duco' ? unitRate : 0;
  const materialAmount = resolvedFinishId === 'cat-duco' ? 0 : buildAmount;
  const finishingAmount = resolvedFinishId === 'cat-duco' ? buildAmount : 0;

  const promoInfo = resolveProductPromoMarkup(buildAmount, product.promo);
  const compareAtEffectivePerSqmRate =
    promoInfo.promoActive && promoInfo.compareAtPrice !== null && measureQuantity > 0
      ? Math.round(promoInfo.compareAtPrice / measureQuantity)
      : null;

  return {
    unitPrice: buildAmount,
    promoActive: promoInfo.promoActive,
    compareAtUnitPrice: promoInfo.compareAtPrice,
    promoPercent: promoInfo.promoPercent,
    promoPercentLabel: promoInfo.promoPercentLabel,
    promoNominal: promoInfo.promoActive ? promoInfo.markupAmount : null,
    pricingCategoryId: pairRate.categoryId,
    pricingUnit: pairRate.unit,
    pricingUnitLabel: pairRate.unitLabel,
    measureQuantity,
    areaSqm: safeArea,
    serviceMode,
    designRatePerSqm: 0,
    materialRatePerSqm,
    finishingRatePerSqm,
    effectivePerSqmRate: unitRate,
    compareAtDesignRatePerSqm: null,
    compareAtMaterialRatePerSqm: null,
    compareAtFinishingRatePerSqm: null,
    compareAtEffectivePerSqmRate,
    designAmount: 0,
    materialAmount,
    finishingAmount,
    buildAmount,
    isLinkedToCustomPricing: true,
    materialId: resolvedMaterialId,
    finishId: resolvedFinishId,
  };
}

export function resolveCatalogStartingPrice(
  product: ProductItem,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): CatalogStartingPriceResult {
  const rules = getEffectiveRules(siteCustomPricing);

  const candidateMaterials = getAvailableMaterialIdsFromTariff(product);
  const candidateFinishes = getAvailableFinishIdsFromTariff(product);

  const mats = candidateMaterials.length > 0 ? candidateMaterials : ['blockboard', 'multipleks', 'pvc'];
  const fins = candidateFinishes.length > 0 ? candidateFinishes : ['hpl', 'cat-duco'];

  let cheapestPair: ReturnType<typeof resolveProductPairRate> | null = null;
  for (const matId of mats) {
    for (const finId of fins) {
      const pair = resolveProductPairRate({
        product,
        materialId: matId,
        finishId: finId,
        rules,
      });
      if (!cheapestPair || pair.unitRate < cheapestPair.unitRate) {
        cheapestPair = pair;
      }
    }
  }

  const finalPair =
    cheapestPair ??
    resolveProductPairRate({
      product,
      materialId: 'blockboard',
      finishId: 'hpl',
      rules,
    });

  const defaultDims = getDefaultProductDimensionsCm(product);
  const minMeasure =
    finalPair.unit === 'm2' ? defaultDims.areaSqm : defaultDims.lengthMeters;

  const computedStarting = Math.round(minMeasure * finalPair.unitRate);
  const numericPrice = Math.max(1000, computedStarting);
  const formatted = formatCurrencyIDR(numericPrice) ?? `Rp ${numericPrice}`;
  const promoInfo = resolveProductPromoMarkup(numericPrice, product.promo);
  const compareAtFormatted =
    promoInfo.compareAtPrice !== null
      ? (formatCurrencyIDR(promoInfo.compareAtPrice) ?? `Rp ${promoInfo.compareAtPrice}`)
      : null;

  return {
    numericPrice,
    formattedAmount: formatted,
    label: `Mulai dari ${formatted}`,
    isStartingFrom: true,
    promoActive: promoInfo.promoActive,
    compareAtNumericPrice: promoInfo.compareAtPrice,
    compareAtFormattedAmount: compareAtFormatted,
    compareAtLabel: compareAtFormatted ? `Mulai dari ${compareAtFormatted}` : null,
    discountPercent: promoInfo.promoPercent,
    discountPercentLabel: promoInfo.promoPercentLabel,
  };
}

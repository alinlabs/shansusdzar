import type { CustomServiceMode } from '../types/cart';
import type { CustomInteriorPricingConfig } from '../types/cms';
import type { ProductCustomOption, ProductItem } from '../types/product';
import {
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  isBuildIncluded,
  isDesignIncluded,
  type CustomPricingRules,
} from './custom-pricing';
import { formatCurrencyIDR } from './price-format';

export interface ParsedPresetDimension {
  lengthCm: number;
  widthCm: number;
  areaSqm: number;
  label: string;
}

export interface CatalogVariantPriceResult {
  unitPrice: number;
  promoActive: boolean;
  compareAtUnitPrice: number | null;
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

const FALLBACK_DESIGN_RATE = INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaDesainPerMeterPersegi ?? 150000;
const FALLBACK_MATERIAL_RATES = INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaBahanPerMeterPersegi;
const FALLBACK_FINISHING_RATES = INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaFinishingPerMeterPersegi;

const FALLBACK_PROMO_ACTIVE = INDICATIVE_WORKSHOP_ESTIMATE_RULES.promoAktif ?? false;
const FALLBACK_DESIGN_BEFORE_PROMO_RATE =
  INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaDesainSebelumPromoPerMeterPersegi ?? null;
const FALLBACK_MATERIAL_BEFORE_PROMO_RATES =
  INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaBahanSebelumPromoPerMeterPersegi ?? {};
const FALLBACK_FINISHING_BEFORE_PROMO_RATES =
  INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaFinishingSebelumPromoPerMeterPersegi ?? {};

function roundAreaSqm(lengthCm: number, widthCm: number): number {
  const raw = (lengthCm / 100) * (widthCm / 100);
  return Math.max(0.05, Math.round(raw * 100) / 100);
}

export function parseDimensionPresetDimensions(
  preset: string | null | undefined
): ParsedPresetDimension | null {
  if (!preset) return null;
  const trimmed = preset.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(\d+(?:[.,]\d+)?)\s*[×xX]\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?/i);
  if (!match) return null;

  const rawA = Number(match[1].replace(',', '.'));
  const rawB = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(rawA) || !Number.isFinite(rawB) || rawA <= 0 || rawB <= 0) {
    return null;
  }

  const unit = (match[3] || '').toLowerCase();
  const isMeters = unit === 'm' || (!unit && rawA <= 15 && rawB <= 15);
  const lengthCm = Math.round(isMeters ? rawA * 100 : rawA);
  const widthCm = Math.round(isMeters ? rawB * 100 : rawB);

  return {
    lengthCm,
    widthCm,
    areaSqm: roundAreaSqm(lengthCm, widthCm),
    label: trimmed,
  };
}

export function getDefaultProductDimensionsCm(product: ProductItem): {
  lengthCm: number;
  widthCm: number;
  areaSqm: number;
} {
  for (const preset of product.dimensi.referensiUkuran ?? []) {
    const parsed = parseDimensionPresetDimensions(preset);
    if (parsed) {
      return {
        lengthCm: parsed.lengthCm,
        widthCm: parsed.widthCm,
        areaSqm: parsed.areaSqm,
      };
    }
  }

  if (
    typeof product.dimensi.lebarCm === 'number' &&
    product.dimensi.lebarCm > 0 &&
    typeof product.dimensi.kedalamanCm === 'number' &&
    product.dimensi.kedalamanCm > 0
  ) {
    return {
      lengthCm: Math.round(product.dimensi.lebarCm),
      widthCm: Math.round(product.dimensi.kedalamanCm),
      areaSqm: roundAreaSqm(product.dimensi.lebarCm, product.dimensi.kedalamanCm),
    };
  }

  if (
    typeof product.dimensi.lebarCm === 'number' &&
    product.dimensi.lebarCm > 0 &&
    typeof product.dimensi.tinggiCm === 'number' &&
    product.dimensi.tinggiCm > 0
  ) {
    return {
      lengthCm: Math.round(product.dimensi.lebarCm),
      widthCm: Math.round(product.dimensi.tinggiCm),
      areaSqm: roundAreaSqm(product.dimensi.lebarCm, product.dimensi.tinggiCm),
    };
  }

  return { lengthCm: 200, widthCm: 100, areaSqm: 2 };
}

export function mapOptionLabelToMaterialId(label: string | null | undefined): string | null {
  if (!label) return null;
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  if (norm.includes('particle')) return 'particle-board';
  if (norm.includes('blockboard') || norm.includes('block board')) return 'blockboard';
  if (norm.includes('multiplek') || norm.includes('plywood')) return 'multipleks';
  if (norm.includes('mdf')) return 'mdf';
  if (norm.includes('pvc')) return 'pvc';
  return null;
}

export function mapOptionLabelToFinishId(label: string | null | undefined): string | null {
  if (!label) return null;
  const norm = label.toLowerCase().trim();
  if (!norm) return null;
  if (norm.includes('duco') || norm.includes('cat')) return 'cat-duco';
  if (norm.includes('hpl')) return 'hpl';
  if (norm.includes('sheet') || norm.includes('decorsheet') || norm.includes('pvc sheet')) {
    return 'sheet';
  }
  return null;
}

export function isMaterialOptionGroup(opt: Pick<ProductCustomOption, 'id' | 'label'>): boolean {
  return /\bbahan\b|\bmaterial\b/i.test(opt.id) || /\bbahan\b|\bmaterial\b/i.test(opt.label);
}

export function isFinishOptionGroup(opt: Pick<ProductCustomOption, 'id' | 'label'>): boolean {
  return (
    /\bfinishing\b|\blaminasi\b/i.test(opt.id) ||
    /\bfinishing\b|\blaminasi\b/i.test(opt.label)
  );
}

export function findMaterialOptionGroup(product: ProductItem): ProductCustomOption | undefined {
  return product.opsiKustom.find(isMaterialOptionGroup);
}

export function findFinishOptionGroup(product: ProductItem): ProductCustomOption | undefined {
  return product.opsiKustom.find(isFinishOptionGroup);
}

function isPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

function isPromoSchemeActive(
  product: ProductItem,
  siteCustomPricing?: CustomInteriorPricingConfig | null,
  isLinked = true
): boolean {
  if (product.promoAktif === false) {
    return false;
  }
  const siteRules = siteCustomPricing?.rules;
  if (isLinked && siteRules && typeof siteRules.promoAktif === 'boolean') {
    return siteRules.promoAktif;
  }
  if (typeof product.promoAktif === 'boolean') {
    return product.promoAktif;
  }
  if (siteRules && typeof siteRules.promoAktif === 'boolean') {
    return siteRules.promoAktif;
  }
  return FALLBACK_PROMO_ACTIVE;
}

function resolveEffectiveRates(
  product: ProductItem,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): {
  designPerSqm: number;
  materialPerSqm: Record<string, number>;
  finishingPerSqm: Record<string, number>;
  designBeforePromoPerSqm: number;
  materialBeforePromoPerSqm: Record<string, number>;
  finishingBeforePromoPerSqm: Record<string, number>;
} {
  const siteRules: CustomPricingRules | undefined = siteCustomPricing?.rules;

  const baseDesignRate = isPositiveNumber(siteRules?.hargaDesainPerMeterPersegi)
    ? siteRules.hargaDesainPerMeterPersegi
    : FALLBACK_DESIGN_RATE;

  const designPerSqm = isPositiveNumber(product.tarifKustom?.desainPerM2)
    ? product.tarifKustom.desainPerM2
    : baseDesignRate;

  const siteDesignBeforeRaw = siteRules
    ? siteRules.hargaDesainSebelumPromoPerMeterPersegi
    : FALLBACK_DESIGN_BEFORE_PROMO_RATE;
  const designBeforeCandidate = isPositiveNumber(product.tarifKustomSebelumPromo?.desainPerM2)
    ? product.tarifKustomSebelumPromo.desainPerM2
    : isPositiveNumber(siteDesignBeforeRaw)
      ? siteDesignBeforeRaw
      : designPerSqm;
  const designBeforePromoPerSqm = Math.max(designPerSqm, designBeforeCandidate);

  const materialPerSqm: Record<string, number> = {};
  const materialBeforePromoPerSqm: Record<string, number> = {};
  for (const [key, fallbackVal] of Object.entries(FALLBACK_MATERIAL_RATES)) {
    const siteVal = siteRules?.hargaBahanPerMeterPersegi?.[key];
    const resolvedSite = isPositiveNumber(siteVal) ? siteVal : (fallbackVal ?? 950000);
    const overrideVal = product.tarifKustom?.bahanPerM2?.[key];
    const currentRate = isPositiveNumber(overrideVal) ? overrideVal : resolvedSite;
    materialPerSqm[key] = currentRate;

    const siteBeforeVal = siteRules
      ? siteRules.hargaBahanSebelumPromoPerMeterPersegi?.[key]
      : FALLBACK_MATERIAL_BEFORE_PROMO_RATES[key];
    const overrideBeforeVal = product.tarifKustomSebelumPromo?.bahanPerM2?.[key];
    const beforeCandidate = isPositiveNumber(overrideBeforeVal)
      ? overrideBeforeVal
      : isPositiveNumber(siteBeforeVal)
        ? siteBeforeVal
        : currentRate;
    materialBeforePromoPerSqm[key] = Math.max(currentRate, beforeCandidate);
  }

  const finishingPerSqm: Record<string, number> = {};
  const finishingBeforePromoPerSqm: Record<string, number> = {};
  for (const [key, fallbackVal] of Object.entries(FALLBACK_FINISHING_RATES)) {
    const siteVal = siteRules?.hargaFinishingPerMeterPersegi?.[key];
    const resolvedSite = isPositiveNumber(siteVal) ? siteVal : (fallbackVal ?? 400000);
    const overrideVal = product.tarifKustom?.finishingPerM2?.[key];
    const currentRate = isPositiveNumber(overrideVal) ? overrideVal : resolvedSite;
    finishingPerSqm[key] = currentRate;

    const siteBeforeVal = siteRules
      ? siteRules.hargaFinishingSebelumPromoPerMeterPersegi?.[key]
      : FALLBACK_FINISHING_BEFORE_PROMO_RATES[key];
    const overrideBeforeVal = product.tarifKustomSebelumPromo?.finishingPerM2?.[key];
    const beforeCandidate = isPositiveNumber(overrideBeforeVal)
      ? overrideBeforeVal
      : isPositiveNumber(siteBeforeVal)
        ? siteBeforeVal
        : currentRate;
    finishingBeforePromoPerSqm[key] = Math.max(currentRate, beforeCandidate);
  }

  return {
    designPerSqm,
    materialPerSqm,
    finishingPerSqm,
    designBeforePromoPerSqm,
    materialBeforePromoPerSqm,
    finishingBeforePromoPerSqm,
  };
}

function resolveMaterialRate(
  materialLabel: string | null | undefined,
  rates: Record<string, number>
): { id: string | null; rate: number } {
  const matchedId = mapOptionLabelToMaterialId(materialLabel);
  if (matchedId && typeof rates[matchedId] === 'number' && rates[matchedId] > 0) {
    return { id: matchedId, rate: rates[matchedId] };
  }
  const entries = Object.entries(rates);
  const cheapest = entries.reduce((min, curr) => (curr[1] < min[1] ? curr : min), entries[0]);
  return { id: cheapest?.[0] ?? null, rate: cheapest?.[1] ?? 950000 };
}

function resolveFinishRate(
  finishLabel: string | null | undefined,
  rates: Record<string, number>
): { id: string | null; rate: number } {
  const matchedId = mapOptionLabelToFinishId(finishLabel);
  if (matchedId && typeof rates[matchedId] === 'number' && rates[matchedId] > 0) {
    return { id: matchedId, rate: rates[matchedId] };
  }
  const entries = Object.entries(rates);
  const cheapest = entries.reduce((min, curr) => (curr[1] < min[1] ? curr : min), entries[0]);
  return { id: cheapest?.[0] ?? null, rate: cheapest?.[1] ?? 400000 };
}

export function getRatePerSqmForOptionValue(params: {
  product: ProductItem;
  option: ProductCustomOption;
  value: string;
  siteCustomPricing?: CustomInteriorPricingConfig | null;
}): number | null {
  const rates = resolveEffectiveRates(params.product, params.siteCustomPricing);
  if (isMaterialOptionGroup(params.option)) {
    const id = mapOptionLabelToMaterialId(params.value);
    return id ? rates.materialPerSqm[id] ?? null : null;
  }
  if (isFinishOptionGroup(params.option)) {
    const id = mapOptionLabelToFinishId(params.value);
    return id ? rates.finishingPerSqm[id] ?? null : null;
  }
  return null;
}

export function calculateCatalogVariantPrice(params: {
  product: ProductItem;
  serviceMode: CustomServiceMode;
  areaSqm: number;
  materialLabel?: string | null;
  finishLabel?: string | null;
  siteCustomPricing?: CustomInteriorPricingConfig | null;
}): CatalogVariantPriceResult {
  const { product, serviceMode } = params;
  const safeArea = Math.max(0.05, Math.round((params.areaSqm || 1) * 100) / 100);
  const rates = resolveEffectiveRates(product, params.siteCustomPricing);

  const includeDesign = isDesignIncluded(serviceMode);
  const includeBuild = isBuildIncluded(serviceMode);

  const materialGroup = findMaterialOptionGroup(product);
  const finishGroup = findFinishOptionGroup(product);
  const resolvedMaterial = resolveMaterialRate(
    params.materialLabel ?? materialGroup?.daftarNilai[0],
    rates.materialPerSqm
  );
  const resolvedFinish = resolveFinishRate(
    params.finishLabel ?? finishGroup?.daftarNilai[0],
    rates.finishingPerSqm
  );

  const isLinkedToCustomPricing =
    product.kaitkanHargaCustom === true ||
    (product.kaitkanHargaCustom !== false && product.statusHarga !== 'tetap');

  const promoEligible = isPromoSchemeActive(product, params.siteCustomPricing, isLinkedToCustomPricing);

  // Fixed-price unit not linked to custom /m2 calculation:
  if (!isLinkedToCustomPricing && product.statusHarga === 'tetap' && product.harga && product.harga > 0) {
    const designRatePerSqm = includeDesign ? rates.designPerSqm : 0;
    const designAmount = includeDesign ? Math.round(safeArea * designRatePerSqm) : 0;
    const buildAmount = includeBuild ? Math.round(product.harga) : 0;
    const unitPrice = designAmount + buildAmount;

    const compareAtDesignRatePerSqm =
      promoEligible && includeDesign ? rates.designBeforePromoPerSqm : null;
    const compareAtDesignAmount =
      promoEligible && includeDesign
        ? Math.round(safeArea * rates.designBeforePromoPerSqm)
        : 0;
    const compareAtBuildAmount = includeBuild
      ? Math.round(
          isPositiveNumber(product.hargaSebelumPromo) && product.hargaSebelumPromo > product.harga
            ? product.hargaSebelumPromo
            : product.harga
        )
      : 0;
    const rawCompareAtUnit = compareAtDesignAmount + compareAtBuildAmount;
    const promoActive = promoEligible && rawCompareAtUnit > unitPrice;

    return {
      unitPrice,
      promoActive,
      compareAtUnitPrice: promoActive ? rawCompareAtUnit : null,
      areaSqm: safeArea,
      serviceMode,
      designRatePerSqm,
      materialRatePerSqm: 0,
      finishingRatePerSqm: 0,
      effectivePerSqmRate: Math.round(unitPrice / safeArea),
      compareAtDesignRatePerSqm: promoActive ? compareAtDesignRatePerSqm : null,
      compareAtMaterialRatePerSqm: null,
      compareAtFinishingRatePerSqm: null,
      compareAtEffectivePerSqmRate: promoActive ? Math.round(rawCompareAtUnit / safeArea) : null,
      designAmount,
      materialAmount: buildAmount,
      finishingAmount: 0,
      buildAmount,
      isLinkedToCustomPricing: false,
      materialId: resolvedMaterial.id,
      finishId: resolvedFinish.id,
    };
  }

  const designRatePerSqm = includeDesign ? rates.designPerSqm : 0;
  const materialRatePerSqm = includeBuild ? resolvedMaterial.rate : 0;
  const finishingRatePerSqm = includeBuild ? resolvedFinish.rate : 0;

  const designAmount = includeDesign ? Math.round(safeArea * designRatePerSqm) : 0;
  const materialAmount = includeBuild ? Math.round(safeArea * materialRatePerSqm) : 0;
  const finishingAmount = includeBuild ? Math.round(safeArea * finishingRatePerSqm) : 0;
  const buildAmount = materialAmount + finishingAmount;
  const unitPrice = designAmount + buildAmount;
  const effectivePerSqmRate = designRatePerSqm + materialRatePerSqm + finishingRatePerSqm;

  const compareAtDesignRatePerSqm = includeDesign ? rates.designBeforePromoPerSqm : 0;
  const compareAtMaterialRatePerSqm =
    includeBuild && resolvedMaterial.id
      ? (rates.materialBeforePromoPerSqm[resolvedMaterial.id] ?? materialRatePerSqm)
      : 0;
  const compareAtFinishingRatePerSqm =
    includeBuild && resolvedFinish.id
      ? (rates.finishingBeforePromoPerSqm[resolvedFinish.id] ?? finishingRatePerSqm)
      : 0;

  const rawCompareAtDesignAmount = includeDesign
    ? Math.round(safeArea * compareAtDesignRatePerSqm)
    : 0;
  const rawCompareAtMaterialAmount = includeBuild
    ? Math.round(safeArea * compareAtMaterialRatePerSqm)
    : 0;
  const rawCompareAtFinishingAmount = includeBuild
    ? Math.round(safeArea * compareAtFinishingRatePerSqm)
    : 0;
  const rawCompareAtUnitPrice =
    rawCompareAtDesignAmount + rawCompareAtMaterialAmount + rawCompareAtFinishingAmount;
  const rawCompareAtEffectivePerSqmRate =
    compareAtDesignRatePerSqm + compareAtMaterialRatePerSqm + compareAtFinishingRatePerSqm;

  const promoActive = promoEligible && rawCompareAtUnitPrice > unitPrice;

  return {
    unitPrice,
    promoActive,
    compareAtUnitPrice: promoActive ? rawCompareAtUnitPrice : null,
    areaSqm: safeArea,
    serviceMode,
    designRatePerSqm,
    materialRatePerSqm,
    finishingRatePerSqm,
    effectivePerSqmRate,
    compareAtDesignRatePerSqm: promoActive && includeDesign ? compareAtDesignRatePerSqm : null,
    compareAtMaterialRatePerSqm: promoActive && includeBuild ? compareAtMaterialRatePerSqm : null,
    compareAtFinishingRatePerSqm: promoActive && includeBuild ? compareAtFinishingRatePerSqm : null,
    compareAtEffectivePerSqmRate: promoActive ? rawCompareAtEffectivePerSqmRate : null,
    designAmount,
    materialAmount,
    finishingAmount,
    buildAmount,
    isLinkedToCustomPricing: true,
    materialId: resolvedMaterial.id,
    finishId: resolvedFinish.id,
  };
}

export function resolveCatalogStartingPrice(
  product: ProductItem,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): CatalogStartingPriceResult {
  const isLinkedToCustomPricing =
    product.kaitkanHargaCustom === true ||
    (product.kaitkanHargaCustom !== false && product.statusHarga !== 'tetap');

  const promoEligible = isPromoSchemeActive(product, siteCustomPricing, isLinkedToCustomPricing);

  if (!isLinkedToCustomPricing && product.statusHarga === 'tetap' && product.harga && product.harga > 0) {
    const numericPrice = Math.round(product.harga);
    const formatted = formatCurrencyIDR(numericPrice) ?? `Rp ${numericPrice}`;
    const rawBefore = isPositiveNumber(product.hargaSebelumPromo)
      ? Math.round(product.hargaSebelumPromo)
      : null;
    const promoActive = promoEligible && rawBefore !== null && rawBefore > numericPrice;
    const compareAtFormatted = promoActive
      ? (formatCurrencyIDR(rawBefore) ?? `Rp ${rawBefore}`)
      : null;

    return {
      numericPrice,
      formattedAmount: formatted,
      label: formatted,
      isStartingFrom: false,
      promoActive,
      compareAtNumericPrice: promoActive ? rawBefore : null,
      compareAtFormattedAmount: compareAtFormatted,
      compareAtLabel: compareAtFormatted,
      discountPercent: promoActive ? calculateDiscountPercent(numericPrice, rawBefore) : null,
    };
  }

  if (!isLinkedToCustomPricing && product.hargaMulai && product.hargaMulai > 0) {
    const numericPrice = Math.round(product.hargaMulai);
    const formatted = formatCurrencyIDR(numericPrice) ?? `Rp ${numericPrice}`;
    const rawBefore = isPositiveNumber(product.hargaMulaiSebelumPromo)
      ? Math.round(product.hargaMulaiSebelumPromo)
      : null;
    const promoActive = promoEligible && rawBefore !== null && rawBefore > numericPrice;
    const compareAtFormatted = promoActive
      ? (formatCurrencyIDR(rawBefore) ?? `Rp ${rawBefore}`)
      : null;

    return {
      numericPrice,
      formattedAmount: formatted,
      label: `Mulai dari ${formatted}`,
      isStartingFrom: true,
      promoActive,
      compareAtNumericPrice: promoActive ? rawBefore : null,
      compareAtFormattedAmount: compareAtFormatted,
      compareAtLabel: compareAtFormatted,
      discountPercent: promoActive ? calculateDiscountPercent(numericPrice, rawBefore) : null,
    };
  }

  const rates = resolveEffectiveRates(product, siteCustomPricing);

  // Smallest available area from presets, or fixed dimension area, or 1 m²
  const presetAreas = (product.dimensi.referensiUkuran ?? [])
    .map((p) => parseDimensionPresetDimensions(p)?.areaSqm ?? null)
    .filter((v): v is number => v !== null && v > 0);

  const minAreaSqm =
    presetAreas.length > 0
      ? Math.min(...presetAreas)
      : getDefaultProductDimensionsCm(product).areaSqm;

  // Minimum base material rate among this product's material options (or overall cheapest)
  const materialGroup = findMaterialOptionGroup(product);
  const candidateMaterialPairs = (materialGroup?.daftarNilai ?? [])
    .map((val) => {
      const id = mapOptionLabelToMaterialId(val);
      return id && typeof rates.materialPerSqm[id] === 'number'
        ? {
            current: rates.materialPerSqm[id],
            before: rates.materialBeforePromoPerSqm[id] ?? rates.materialPerSqm[id],
          }
        : null;
    })
    .filter((v): v is { current: number; before: number } => v !== null && v.current > 0);

  const cheapestMaterialPair =
    candidateMaterialPairs.length > 0
      ? candidateMaterialPairs.reduce((min, cur) => (cur.current < min.current ? cur : min))
      : Object.keys(rates.materialPerSqm)
          .map((id) => ({
            current: rates.materialPerSqm[id],
            before: rates.materialBeforePromoPerSqm[id] ?? rates.materialPerSqm[id],
          }))
          .reduce((min, cur) => (cur.current < min.current ? cur : min));

  // Minimum finishing rate among this product's finishing options (or overall cheapest)
  const finishGroup = findFinishOptionGroup(product);
  const candidateFinishPairs = (finishGroup?.daftarNilai ?? [])
    .map((val) => {
      const id = mapOptionLabelToFinishId(val);
      return id && typeof rates.finishingPerSqm[id] === 'number'
        ? {
            current: rates.finishingPerSqm[id],
            before: rates.finishingBeforePromoPerSqm[id] ?? rates.finishingPerSqm[id],
          }
        : null;
    })
    .filter((v): v is { current: number; before: number } => v !== null && v.current > 0);

  const cheapestFinishPair =
    candidateFinishPairs.length > 0
      ? candidateFinishPairs.reduce((min, cur) => (cur.current < min.current ? cur : min))
      : Object.keys(rates.finishingPerSqm)
          .map((id) => ({
            current: rates.finishingPerSqm[id],
            before: rates.finishingBeforePromoPerSqm[id] ?? rates.finishingPerSqm[id],
          }))
          .reduce((min, cur) => (cur.current < min.current ? cur : min));

  const computedStarting = Math.round(
    minAreaSqm * (cheapestMaterialPair.current + cheapestFinishPair.current)
  );
  const numericPrice = Math.max(1000, computedStarting);
  const formatted = formatCurrencyIDR(numericPrice) ?? `Rp ${numericPrice}`;

  const rawCompareAtStarting = Math.round(
    minAreaSqm * (cheapestMaterialPair.before + cheapestFinishPair.before)
  );
  const promoActive = promoEligible && rawCompareAtStarting > numericPrice;
  const compareAtFormatted = promoActive
    ? (formatCurrencyIDR(rawCompareAtStarting) ?? `Rp ${rawCompareAtStarting}`)
    : null;

  return {
    numericPrice,
    formattedAmount: formatted,
    label: `Mulai dari ${formatted}`,
    isStartingFrom: true,
    promoActive,
    compareAtNumericPrice: promoActive ? rawCompareAtStarting : null,
    compareAtFormattedAmount: compareAtFormatted,
    compareAtLabel: compareAtFormatted,
    discountPercent: promoActive ? calculateDiscountPercent(numericPrice, rawCompareAtStarting) : null,
  };
}

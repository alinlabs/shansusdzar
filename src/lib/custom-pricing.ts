import defaultProductCatalogJson from '../data/produk.json';
import type { PricingConfiguration } from '../types/business';
import type { CustomServiceMode, RoomDimensionsInput } from '../types/cart';
import type { ProductCatalogDocument, ProductItem } from '../types/product';
import { getProductSlug } from './product-catalog';

export type { CustomServiceMode };

export type CustomPricingUnit = 'm' | 'm2';

export type ProductPricingCategoryKey =
  | 'lemari'
  | 'kitchen-set'
  | 'backdrop-tv'
  | 'meja'
  | 'sekat-partisi';

export interface ProductGroupPricingRule {
  id: ProductPricingCategoryKey;
  label: string;
  satuan: CustomPricingUnit;
  hplPerSatuan: Record<string, number | null>;
  ducoPerSatuan: Record<string, number | null>;
}

export const UNIFIED_SERVICE_MODE_LABEL = 'Desain & Build (Gratis Desain)';

export function getCustomServiceModeLabel(mode?: CustomServiceMode): string {
  if (mode === 'design-only') {
    return 'Konsultasi Desain Saja';
  }
  return UNIFIED_SERVICE_MODE_LABEL;
}

export function isDesignIncluded(_mode?: CustomServiceMode): boolean {
  return true;
}

export function isBuildIncluded(mode?: CustomServiceMode): boolean {
  return mode !== 'design-only';
}

export interface CustomPricingRules {
  /**
   * Mengaktifkan atau menonaktifkan skema harga promo (harga coret vs harga saat ini).
   */
  promoAktif?: boolean;
  /**
   * Harga jasa desain per meter persegi (m²) — bernilai 0 saat pesan Build (Gratis Desain).
   */
  hargaDesainPerMeterPersegi?: number | null;
  /**
   * Harga jasa desain sebelum promo (opsional).
   */
  hargaDesainSebelumPromoPerMeterPersegi?: number | null;
  /**
   * Harga bahan dasar standar (HPL) per satuan saat ini dalam IDR.
   * Berlaku untuk: blockboard, multipleks, pvc.
   */
  hargaBahanPerMeterPersegi: Record<string, number | null>;
  /**
   * Harga bahan dasar sebelum promo (harga coret) dalam IDR.
   */
  hargaBahanSebelumPromoPerMeterPersegi?: Record<string, number | null>;
  /**
   * Tarif tambahan atau paket finishing saat ini dalam IDR.
   * Berlaku untuk: hpl, cat-duco.
   */
  hargaFinishingPerMeterPersegi: Record<string, number | null>;
  /**
   * Tarif finishing sebelum promo (harga coret) dalam IDR.
   */
  hargaFinishingSebelumPromoPerMeterPersegi?: Record<string, number | null>;
  /**
   * Matriks tarif Design & Build per kategori produk (diturunkan dari harga tiap produk di produk.json).
   */
  tarifPerKategori?: Partial<Record<ProductPricingCategoryKey, ProductGroupPricingRule>>;
  /**
   * Biaya tetap opsional per kelengkapan tambahan dalam IDR.
   */
  biayaTambahanOpsi: Record<string, number | null>;
}

export const PRODUCT_PRICING_CATEGORIES: ReadonlyArray<{
  id: ProductPricingCategoryKey;
  label: string;
  satuan: CustomPricingUnit;
}> = [
  { id: 'lemari', label: 'Lemari', satuan: 'm2' },
  { id: 'kitchen-set', label: 'Kitchen Set', satuan: 'm2' },
  { id: 'backdrop-tv', label: 'Backdrop TV', satuan: 'm2' },
  { id: 'meja', label: 'Meja', satuan: 'm2' },
  { id: 'sekat-partisi', label: 'Sekat Ruangan / Partisi', satuan: 'm2' },
];

export function resolveProductPricingCategory(
  identifier?: string | null
): ProductPricingCategoryKey {
  const norm = (identifier ?? '').toLowerCase().trim();
  if (!norm) return 'lemari';

  if (
    norm.includes('backdrop') ||
    norm.includes('headboard') ||
    norm.includes('wall-panel') ||
    norm.includes('wall panel') ||
    norm.includes('kisi-kisi dinding')
  ) {
    return 'backdrop-tv';
  }

  if (
    norm.includes('sekat') ||
    norm.includes('partisi') ||
    norm.includes('penyekat')
  ) {
    return 'sekat-partisi';
  }

  if (norm.includes('kitchen') || norm.includes('dapur')) {
    return 'kitchen-set';
  }

  if (
    norm.includes('meja') ||
    norm.includes('island') ||
    norm.includes('credenza') ||
    norm.includes('bufet') ||
    norm.includes('nakas') ||
    norm.includes('resepsionis') ||
    norm.includes('kasir')
  ) {
    return 'meja';
  }

  return 'lemari';
}

function deriveCategoryPricingMapFromProducts(
  products: readonly ProductItem[]
): Partial<Record<ProductPricingCategoryKey, ProductGroupPricingRule>> {
  const fallbackRates: Record<ProductPricingCategoryKey, ProductGroupPricingRule> = {
    lemari: {
      id: 'lemari',
      label: 'Lemari',
      satuan: 'm2',
      hplPerSatuan: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
    'kitchen-set': {
      id: 'kitchen-set',
      label: 'Kitchen Set',
      satuan: 'm2',
      hplPerSatuan: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
    'backdrop-tv': {
      id: 'backdrop-tv',
      label: 'Backdrop TV',
      satuan: 'm2',
      hplPerSatuan: { blockboard: 1000000, multipleks: 1500000, pvc: 2000000 },
      ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
    meja: {
      id: 'meja',
      label: 'Meja',
      satuan: 'm2',
      hplPerSatuan: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
    'sekat-partisi': {
      id: 'sekat-partisi',
      label: 'Sekat Ruangan / Partisi',
      satuan: 'm2',
      hplPerSatuan: { blockboard: 2500000, multipleks: 2500000, pvc: 3500000 },
      ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
  };

  const result: Partial<Record<ProductPricingCategoryKey, ProductGroupPricingRule>> = {};
  for (const meta of PRODUCT_PRICING_CATEGORIES) {
    const matched = products.find(
      (p) =>
        p.harga &&
        resolveProductPricingCategory(`${p.id} ${getProductSlug(p)} ${p.nama}`) === meta.id
    );
    if (matched?.harga) {
      result[meta.id] = {
        id: meta.id,
        label: meta.label,
        satuan: meta.satuan,
        hplPerSatuan: { ...matched.harga.hpl },
        ducoPerSatuan: {
          ...fallbackRates[meta.id].ducoPerSatuan,
          ...matched.harga.duco,
        },
      };
    } else {
      result[meta.id] = structuredClone(fallbackRates[meta.id]);
    }
  }
  return result;
}

const rawProductsList: ProductItem[] = Array.isArray(defaultProductCatalogJson)
  ? (defaultProductCatalogJson as unknown as ProductItem[])
  : Array.isArray((defaultProductCatalogJson as unknown as ProductCatalogDocument)?.daftarProduk)
    ? (defaultProductCatalogJson as unknown as ProductCatalogDocument).daftarProduk
    : [];

export const DEFAULT_CUSTOM_PRICING_RULES: CustomPricingRules = {
  promoAktif: false,
  hargaDesainPerMeterPersegi: 0,
  hargaBahanPerMeterPersegi: {
    blockboard: null,
    multipleks: null,
    pvc: null,
  },
  hargaFinishingPerMeterPersegi: {
    hpl: null,
    'cat-duco': null,
  },
  biayaTambahanOpsi: {},
};

export const INDICATIVE_ESTIMATE_CONFIG: PricingConfiguration = {
  mataUang: 'IDR',
  persentaseDp: 30,
  hargaCustomTerkonfigurasi: true,
};

export const INDICATIVE_WORKSHOP_ESTIMATE_RULES: CustomPricingRules = {
  promoAktif: false,
  hargaDesainPerMeterPersegi: 0,
  hargaBahanPerMeterPersegi: {
    blockboard: 1800000,
    multipleks: 2500000,
    pvc: 3500000,
  },
  hargaFinishingPerMeterPersegi: {
    hpl: 0,
    'cat-duco': 4500000,
  },
  tarifPerKategori: deriveCategoryPricingMapFromProducts(rawProductsList),
  biayaTambahanOpsi: {},
};

export function formatPricingUnitLabel(unit: CustomPricingUnit): string {
  return unit === 'm2' ? 'm²' : 'm';
}

export function resolveProductTariffRate(params: {
  product: ProductItem;
  materialId: string;
  finishId: string;
  rules?: CustomPricingRules;
}): {
  categoryId: ProductPricingCategoryKey;
  unit: CustomPricingUnit;
  unitLabel: string;
  ratePerUnit: number | null;
  compareAtRatePerUnit: number | null;
  source: 'product' | 'matrix';
} {
  const categoryId = resolveProductPricingCategory(
    `${params.product.id} ${getProductSlug(params.product)} ${params.product.nama}`
  );
  const unit: CustomPricingUnit =
    params.product.meterLari === true ? 'm' : 'm2';
  const unitLabel = formatPricingUnitLabel(unit);

  const directRates = params.product.harga;

  if (directRates) {
    const finishBucket =
      params.finishId === 'cat-duco' || params.finishId === 'duco'
        ? directRates.duco
        : directRates.hpl;
    const rate = finishBucket?.[params.materialId] ?? null;
    return {
      categoryId,
      unit,
      unitLabel,
      ratePerUnit: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null,
      compareAtRatePerUnit: null,
      source: 'product',
    };
  }

  const fallbackMatrix = resolveCategoryMatrixRate({
    categoryId,
    materialId: params.materialId,
    finishId: params.finishId,
    rules: params.rules ?? INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });

  return {
    categoryId,
    unit,
    unitLabel,
    ratePerUnit: fallbackMatrix.ratePerUnit,
    compareAtRatePerUnit: null,
    source: 'matrix',
  };
}

export function resolveCategoryMatrixRate(params: {
  categoryId: ProductPricingCategoryKey;
  materialId: string;
  finishId: string;
  rules: CustomPricingRules;
}): {
  unit: CustomPricingUnit;
  unitLabel: string;
  ratePerUnit: number | null;
  compareAtRatePerUnit: number | null;
  isMatrixRule: boolean;
} {
  const categoryRule = params.rules.tarifPerKategori?.[params.categoryId];

  if (categoryRule) {
    const unit = categoryRule.satuan ?? 'm2';
    const unitLabel = formatPricingUnitLabel(unit);

    const rate =
      params.finishId === 'cat-duco' || params.finishId === 'duco'
        ? (categoryRule.ducoPerSatuan?.[params.materialId] ?? null)
        : (categoryRule.hplPerSatuan?.[params.materialId] ?? null);

    return {
      unit,
      unitLabel,
      ratePerUnit: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null,
      compareAtRatePerUnit: null,
      isMatrixRule: true,
    };
  }

  // Fallback for standalone custom rules without tarifPerKategori
  const rawMaterialRate = params.rules.hargaBahanPerMeterPersegi?.[params.materialId] ?? null;
  const rawFinishingRate = params.rules.hargaFinishingPerMeterPersegi?.[params.finishId] ?? null;
  const fallbackUnit: CustomPricingUnit = 'm2';

  if (params.finishId === 'cat-duco' && typeof rawFinishingRate === 'number' && rawFinishingRate >= 3000000) {
    return {
      unit: fallbackUnit,
      unitLabel: formatPricingUnitLabel(fallbackUnit),
      ratePerUnit: rawFinishingRate,
      compareAtRatePerUnit: null,
      isMatrixRule: false,
    };
  }

  if (
    typeof rawMaterialRate === 'number' &&
    Number.isFinite(rawMaterialRate) &&
    rawMaterialRate > 0
  ) {
    const additiveFinish =
      typeof rawFinishingRate === 'number' && Number.isFinite(rawFinishingRate) && rawFinishingRate > 0
        ? rawFinishingRate
        : 0;

    return {
      unit: fallbackUnit,
      unitLabel: formatPricingUnitLabel(fallbackUnit),
      ratePerUnit: rawMaterialRate + additiveFinish,
      compareAtRatePerUnit: null,
      isMatrixRule: false,
    };
  }

  return {
    unit: fallbackUnit,
    unitLabel: formatPricingUnitLabel(fallbackUnit),
    ratePerUnit: null,
    compareAtRatePerUnit: null,
    isMatrixRule: false,
  };
}

export interface CustomEstimateBreakdown {
  status: 'configured' | 'contact';
  serviceMode: CustomServiceMode;
  pricingCategoryId: ProductPricingCategoryKey;
  pricingUnit: CustomPricingUnit;
  pricingUnitLabel: string;
  measureQuantity: number;
  lengthMeters: number;
  areaSquareMeters: number;
  unitRate: number | null;
  compareAtUnitRate: number | null;
  designRatePerSqm: number | null;
  materialRatePerSqm: number | null;
  finishingRatePerSqm: number | null;
  designAmount: number | null;
  materialAmount: number | null;
  finishingAmount: number | null;
  buildAmount: number | null;
  baseAmount: number | null;
  optionsAmount: number | null;
  estimatedUnitTotal: number | null;
  estimatedLineTotal: number | null;
  dpPercentage: number | null;
  estimatedDpUnitAmount: number | null;
  estimatedDpLineTotal: number | null;
  disclaimer: string;
}

export function calculateLengthMeters(dimensions: RoomDimensionsInput): number {
  const lengthM = dimensions.normalizedLengthCm / 100;
  return Math.max(0.001, Math.round(lengthM * 10000) / 10000);
}

export function calculateAreaSquareMeters(dimensions: RoomDimensionsInput): number {
  const rawArea =
    (dimensions.normalizedLengthCm * dimensions.normalizedWidthCm) / 10000;
  return Math.max(0.0001, Math.round(rawArea * 10000) / 10000);
}

function formatIndicativeRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
}

function getUnifiedDisclaimer(
  unit: CustomPricingUnit,
  finishId: string,
  unitRate?: number | null
): string {
  const unitLabel = formatPricingUnitLabel(unit);
  const isDuco = finishId === 'cat-duco' || finishId === 'duco';
  const finishNote =
    isDuco && typeof unitRate === 'number' && Number.isFinite(unitRate) && unitRate > 0
      ? `Tarif Cat Duco bersifat indikatif mulai ${formatIndicativeRupiah(unitRate)}/${unitLabel} sesuai detail profil & bidang. `
      : '';
  if (unit === 'm2') {
    return `${finishNote}Estimasi Design & Build dihitung dari luas panjang × tinggi (m²) dan sudah termasuk Gratis Desain 3D; ukuran final dikonfirmasi saat survei lokasi.`;
  }
  return `${finishNote}Estimasi Design & Build dihitung per meter lari (/m) berdasarkan panjang unit dan sudah termasuk Gratis Desain 3D; ukuran final dikonfirmasi saat survei lokasi.`;
}

export function calculateCustomEstimate(params: {
  serviceMode?: CustomServiceMode;
  product?: ProductItem | null;
  itemTypeId?: string;
  itemLabel?: string;
  materialId: string;
  finishId: string;
  dimensions: RoomDimensionsInput;
  additionalOptionIds: string[];
  quantity: number;
  pricingConfig?: PricingConfiguration;
  rules?: CustomPricingRules;
}): CustomEstimateBreakdown {
  const serviceMode: CustomServiceMode = 'design-and-build';
  const product = params.product ?? null;
  const pricingConfig: PricingConfiguration = params.pricingConfig ?? {
    mataUang: 'IDR',
    persentaseDp: null,
    hargaCustomTerkonfigurasi: false,
  };
  const rules = params.rules ?? DEFAULT_CUSTOM_PRICING_RULES;

  const lengthMeters = calculateLengthMeters(params.dimensions);
  const areaSquareMeters = calculateAreaSquareMeters(params.dimensions);

  const resolvedRate = product
    ? resolveProductTariffRate({
        product,
        materialId: params.materialId,
        finishId: params.finishId,
        rules,
      })
    : (() => {
        const categoryId = resolveProductPricingCategory(
          [params.itemTypeId, params.itemLabel].filter(Boolean).join(' ')
        );
        const matrix = resolveCategoryMatrixRate({
          categoryId,
          materialId: params.materialId,
          finishId: params.finishId,
          rules,
        });
        return {
          categoryId,
          unit: matrix.unit,
          unitLabel: matrix.unitLabel,
          ratePerUnit: matrix.ratePerUnit,
          compareAtRatePerUnit: matrix.compareAtRatePerUnit,
          source: 'matrix' as const,
        };
      })();

  const categoryId = resolvedRate.categoryId;
  const pricingUnit = resolvedRate.unit;
  const pricingUnitLabel = resolvedRate.unitLabel;
  const measureQuantity = pricingUnit === 'm2' ? areaSquareMeters : lengthMeters;
  const quantity = Math.max(1, Math.floor(params.quantity || 1));
  const unitRate = resolvedRate.ratePerUnit;
  const disclaimer = getUnifiedDisclaimer(pricingUnit, params.finishId, unitRate);

  const buildContactFallback = (): CustomEstimateBreakdown => ({
    status: 'contact',
    serviceMode,
    pricingCategoryId: categoryId,
    pricingUnit,
    pricingUnitLabel,
    measureQuantity,
    lengthMeters,
    areaSquareMeters,
    unitRate: null,
    compareAtUnitRate: null,
    designRatePerSqm: 0,
    materialRatePerSqm: null,
    finishingRatePerSqm: null,
    designAmount: 0,
    materialAmount: null,
    finishingAmount: null,
    buildAmount: null,
    baseAmount: null,
    optionsAmount: null,
    estimatedUnitTotal: null,
    estimatedLineTotal: null,
    dpPercentage: null,
    estimatedDpUnitAmount: null,
    estimatedDpLineTotal: null,
    disclaimer,
  });

  if (!pricingConfig.hargaCustomTerkonfigurasi) {
    return buildContactFallback();
  }

  let optionsAmount = 0;
  for (const optionId of params.additionalOptionIds) {
    const fee = rules.biayaTambahanOpsi?.[optionId];
    if (typeof fee === 'number' && Number.isFinite(fee) && fee > 0) {
      optionsAmount += fee;
    }
  }

  const validDpPercentage =
    typeof pricingConfig.persentaseDp === 'number' &&
    Number.isFinite(pricingConfig.persentaseDp) &&
    pricingConfig.persentaseDp > 0 &&
    pricingConfig.persentaseDp <= 100
      ? pricingConfig.persentaseDp
      : null;

  if (typeof unitRate !== 'number' || !Number.isFinite(unitRate) || unitRate <= 0) {
    return buildContactFallback();
  }

  const isDuco = params.finishId === 'cat-duco' || params.finishId === 'duco';
  const buildAmount = Math.round(measureQuantity * unitRate);
  const materialAmount = isDuco ? 0 : buildAmount;
  const finishingAmount = isDuco ? buildAmount : 0;
  const materialRatePerSqm = isDuco ? 0 : unitRate;
  const finishingRatePerSqm = isDuco ? unitRate : 0;

  const baseAmount = buildAmount;
  const estimatedUnitTotal = baseAmount + optionsAmount;
  const estimatedLineTotal = estimatedUnitTotal * quantity;

  const estimatedDpUnitAmount =
    validDpPercentage !== null
      ? Math.round((estimatedUnitTotal * validDpPercentage) / 100)
      : null;

  const estimatedDpLineTotal =
    estimatedDpUnitAmount !== null ? estimatedDpUnitAmount * quantity : null;

  return {
    status: 'configured',
    serviceMode,
    pricingCategoryId: categoryId,
    pricingUnit,
    pricingUnitLabel,
    measureQuantity,
    lengthMeters,
    areaSquareMeters,
    unitRate,
    compareAtUnitRate: null,
    designRatePerSqm: 0,
    materialRatePerSqm,
    finishingRatePerSqm,
    designAmount: 0,
    materialAmount,
    finishingAmount,
    buildAmount,
    baseAmount,
    optionsAmount,
    estimatedUnitTotal,
    estimatedLineTotal,
    dpPercentage: validDpPercentage,
    estimatedDpUnitAmount,
    estimatedDpLineTotal,
    disclaimer,
  };
}

export interface CustomStartingRatesSummary {
  isConfigured: boolean;
  designPerSqm: number | null;
  minBuildPerSqm: number | null;
  minDesignAndBuildPerSqm: number | null;
  minLinearRate: number | null;
  minPartitionRatePerSqm: number | null;
}

export function getCustomStartingRates(
  pricingConfig: PricingConfiguration,
  rules: CustomPricingRules,
  products?: readonly ProductItem[]
): CustomStartingRatesSummary {
  if (!pricingConfig.hargaCustomTerkonfigurasi) {
    return {
      isConfigured: false,
      designPerSqm: null,
      minBuildPerSqm: null,
      minDesignAndBuildPerSqm: null,
      minLinearRate: null,
      minPartitionRatePerSqm: null,
    };
  }

  if (products && products.length > 0) {
    const linearRates: number[] = [];
    const areaRates: number[] = [];

    for (const product of products) {
      if (!product.harga) continue;
      const allVals = [
        ...Object.values(product.harga.hpl ?? {}),
        ...Object.values(product.harga.duco ?? {}),
      ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      if (product.meterLari === true) {
        linearRates.push(...allVals);
      } else {
        areaRates.push(...allVals);
      }
    }

    if (linearRates.length > 0 || areaRates.length > 0) {
      const overallMin = Math.min(...linearRates, ...areaRates);
      const minLinear = linearRates.length > 0 ? Math.min(...linearRates) : overallMin;
      const minArea = areaRates.length > 0 ? Math.min(...areaRates) : overallMin;

      return {
        isConfigured: true,
        designPerSqm: 0,
        minBuildPerSqm: overallMin,
        minDesignAndBuildPerSqm: overallMin,
        minLinearRate: minLinear,
        minPartitionRatePerSqm: minArea,
      };
    }
  }

  const categoryEntries = Object.values(rules.tarifPerKategori ?? {});
  if (categoryEntries.length > 0) {
    const allRates: number[] = [];
    const partitionRates: number[] = [];

    for (const entry of categoryEntries) {
      if (!entry) continue;
      const allVals = [
        ...Object.values(entry.hplPerSatuan ?? {}),
        ...Object.values(entry.ducoPerSatuan ?? {}),
      ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      allRates.push(...allVals);
      if (entry.id === 'sekat-partisi') {
        partitionRates.push(...allVals);
      }
    }

    const overallMin = allRates.length > 0 ? Math.min(...allRates) : null;
    const minPartition =
      partitionRates.length > 0 ? Math.min(...partitionRates) : overallMin;

    return {
      isConfigured: overallMin !== null,
      designPerSqm: 0,
      minBuildPerSqm: overallMin,
      minDesignAndBuildPerSqm: overallMin,
      minLinearRate: overallMin,
      minPartitionRatePerSqm: minPartition,
    };
  }

  const materialRates = Object.values(rules.hargaBahanPerMeterPersegi ?? {}).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  );
  const minBuildPerSqm = materialRates.length > 0 ? Math.min(...materialRates) : null;

  return {
    isConfigured: minBuildPerSqm !== null,
    designPerSqm: 0,
    minBuildPerSqm,
    minDesignAndBuildPerSqm: minBuildPerSqm,
    minLinearRate: minBuildPerSqm,
    minPartitionRatePerSqm: minBuildPerSqm,
  };
}

export interface IndicativeSurveyFeeResult {
  amount: number;
  ratePercent: number;
}

/**
 * Menghitung estimasi biaya survei & pengukuran lokasi kompetitor secara bertingkat
 * di kisaran 5%–15% berdasarkan total nominal produk (untuk ditampilkan coret -> Rp 0).
 */
export function calculateIndicativeSurveyFee(
  productTotal: number
): IndicativeSurveyFeeResult {
  if (!Number.isFinite(productTotal) || productTotal <= 0) {
    return { amount: 0, ratePercent: 0 };
  }

  let ratePercent = 5;
  if (productTotal < 5_000_000) {
    ratePercent = 15;
  } else if (productTotal < 12_000_000) {
    ratePercent = 12;
  } else if (productTotal < 25_000_000) {
    ratePercent = 9;
  } else if (productTotal < 45_000_000) {
    ratePercent = 7;
  }

  const raw = (productTotal * ratePercent) / 100;
  const rounded = Math.round(raw / 10_000) * 10_000;
  const minBound = Math.ceil(productTotal * 0.05);
  const maxBound = Math.floor(productTotal * 0.15);

  const amount =
    maxBound >= minBound
      ? Math.min(maxBound, Math.max(minBound, rounded > 0 ? rounded : minBound))
      : Math.round(raw);

  return { amount, ratePercent };
}

/**
 * Menghitung estimasi biaya jasa desain 3D berdasarkan skala ukuran (m² atau m')
 * dan jumlah unit menggunakan tarif progresif standar pasar interior (coret -> Rp 0).
 */
export function calculateIndicativeDesign3dFee(params: {
  measureQuantity: number;
  quantity: number;
}): number {
  const safeMeasure = Number.isFinite(params.measureQuantity)
    ? Math.max(0.1, params.measureQuantity)
    : 1;
  const safeQty = Math.max(1, Math.floor(params.quantity || 1));
  const totalMeasure = safeMeasure * safeQty;

  let raw = 0;
  const tier1 = Math.min(totalMeasure, 3);
  raw += tier1 * 175_000;

  if (totalMeasure > 3) {
    const tier2 = Math.min(totalMeasure - 3, 5);
    raw += tier2 * 145_000;
  }

  if (totalMeasure > 8) {
    const tier3 = Math.min(totalMeasure - 8, 7);
    raw += tier3 * 120_000;
  }

  if (totalMeasure > 15) {
    const tier4 = totalMeasure - 15;
    raw += tier4 * 95_000;
  }

  const rounded = Math.round(raw / 10_000) * 10_000;
  return Math.max(300_000, rounded);
}

export interface IndicativeDeliveryFeeResult {
  amount: number;
  fleetLabel: string;
}

/**
 * Menghitung estimasi biaya pengiriman & muat workshop berdasarkan dimensi dan volume total unit
 * (memilih kelas armada: Blindvan, Pickup Bak, Truk Engkel CDE, atau Engkel Long CDD).
 */
export function calculateIndicativeDeliveryFee(params: {
  areaSquareMeters: number;
  lengthMeters: number;
  quantity: number;
}): IndicativeDeliveryFeeResult {
  const safeArea = Number.isFinite(params.areaSquareMeters)
    ? Math.max(0.1, params.areaSquareMeters)
    : 1;
  const safeLength = Number.isFinite(params.lengthMeters)
    ? Math.max(0.1, params.lengthMeters)
    : 1;
  const safeQty = Math.max(1, Math.floor(params.quantity || 1));

  const totalAreaSqm = safeArea * safeQty;

  let fleetLabel = 'Engkel Long';
  let raw = 1_150_000;
  let minFee = 1_150_000;

  if (totalAreaSqm <= 2.5 && safeLength <= 2.0) {
    fleetLabel = 'Blindvan';
    raw = 300_000 + totalAreaSqm * 40_000;
    minFee = 350_000;
  } else if (totalAreaSqm <= 6.5 && safeLength <= 3.0) {
    fleetLabel = 'Pickup Bak';
    raw = 450_000 + Math.max(0, totalAreaSqm - 2.5) * 35_000;
    minFee = 500_000;
  } else if (totalAreaSqm <= 13.5 && safeLength <= 4.0) {
    fleetLabel = 'Truk Engkel';
    raw = 750_000 + Math.max(0, totalAreaSqm - 6.5) * 40_000;
    minFee = 800_000;
  } else {
    fleetLabel = 'Engkel Long';
    raw = 1_150_000 + Math.max(0, totalAreaSqm - 13.5) * 45_000;
    minFee = 1_150_000;
  }

  const rounded = Math.round(raw / 10_000) * 10_000;
  return {
    amount: Math.max(minFee, rounded),
    fleetLabel,
  };
}

export interface CustomPromoSummaryInput {
  promoActive: boolean;
  promoMode: 'percent' | 'nominal' | null;
  promoPercentLabel: string | null;
  markupAmount: number;
}

export interface CustomCostDetailsBreakdown {
  surveyFee: number;
  surveyRatePercent: number;
  design3dFee: number;
  deliveryFee: number;
  deliveryFleetLabel: string;
  isPromo: boolean;
  promoMode: 'percent' | 'nominal' | null;
  promoPercentLabel: string | null;
  promoDiscountAmount: number;
  productPriceAmount: number;
  ppnAmount: number;
  priceAfterDiscount: number | null;
  totalAmount: number;
}

export const PPN_RATE = 0.11;

export function extractPreTaxAmount(totalAmount: number): {
  preTaxAmount: number;
  ppnAmount: number;
} {
  const safeTotal = Math.max(0, Math.round(totalAmount));
  const ppnAmount = Math.round(safeTotal * PPN_RATE);
  const preTaxAmount = Math.max(0, safeTotal - ppnAmount);
  return { preTaxAmount, ppnAmount };
}

export function calculateCustomCostDetails(params: {
  estimate: CustomEstimateBreakdown | null;
  quantity: number;
  promo?: CustomPromoSummaryInput | null;
}): CustomCostDetailsBreakdown | null {
  const { estimate } = params;
  if (
    !estimate ||
    estimate.status !== 'configured' ||
    typeof estimate.estimatedLineTotal !== 'number' ||
    !Number.isFinite(estimate.estimatedLineTotal) ||
    estimate.estimatedLineTotal <= 0
  ) {
    return null;
  }

  const safeQty = Math.max(1, Math.floor(params.quantity || 1));
  const totalAmount = Math.round(estimate.estimatedLineTotal);
  const { preTaxAmount: netAfterTaxAmount, ppnAmount } = extractPreTaxAmount(totalAmount);

  const survey = calculateIndicativeSurveyFee(totalAmount);
  const design3dFee = calculateIndicativeDesign3dFee({
    measureQuantity: estimate.measureQuantity,
    quantity: safeQty,
  });
  const delivery = calculateIndicativeDeliveryFee({
    areaSquareMeters: estimate.areaSquareMeters,
    lengthMeters: estimate.lengthMeters,
    quantity: safeQty,
  });

  const promo = params.promo;
  const isPromo = Boolean(promo?.promoActive && promo.markupAmount > 0);

  if (isPromo && promo) {
    const promoDiscountAmount = Math.round(promo.markupAmount * safeQty);
    const productPriceAmount = netAfterTaxAmount + promoDiscountAmount;
    return {
      surveyFee: survey.amount,
      surveyRatePercent: survey.ratePercent,
      design3dFee,
      deliveryFee: delivery.amount,
      deliveryFleetLabel: delivery.fleetLabel,
      isPromo: true,
      promoMode: promo.promoMode,
      promoPercentLabel: promo.promoPercentLabel,
      promoDiscountAmount,
      productPriceAmount,
      ppnAmount,
      priceAfterDiscount: netAfterTaxAmount,
      totalAmount,
    };
  }

  return {
    surveyFee: survey.amount,
    surveyRatePercent: survey.ratePercent,
    design3dFee,
    deliveryFee: delivery.amount,
    deliveryFleetLabel: delivery.fleetLabel,
    isPromo: false,
    promoMode: null,
    promoPercentLabel: null,
    promoDiscountAmount: 0,
    productPriceAmount: netAfterTaxAmount,
    ppnAmount,
    priceAfterDiscount: null,
    totalAmount,
  };
}


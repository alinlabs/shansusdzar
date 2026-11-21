import customPricingData from '../data/aturan-harga-custom.json';
import type { PricingConfiguration } from '../types/business';
import type { CustomServiceMode, RoomDimensionsInput } from '../types/cart';
import { BUSINESS_CONFIG } from './business-config';

export type { CustomServiceMode };

export interface CustomServiceModeMeta {
  id: CustomServiceMode;
  label: string;
  shortLabel: string;
  deskripsi: string;
}

export const CUSTOM_SERVICE_MODES: CustomServiceModeMeta[] = [
  {
    id: 'design-only',
    label: 'Desain Saja',
    shortLabel: 'Desain',
    deskripsi: 'Jasa perencanaan tata letak, visual 3D, dan gambar kerja teknis per m².',
  },
  {
    id: 'build-only',
    label: 'Build Saja',
    shortLabel: 'Build',
    deskripsi: 'Produksi workshop & pemasangan sesuai ukuran, material utama, dan finishing/laminasi.',
  },
  {
    id: 'design-and-build',
    label: 'Desain + Build',
    shortLabel: 'Desain + Build',
    deskripsi: 'Paket lengkap mulai dari konsep desain 3D hingga produksi & pemasangan.',
  },
];

export function getCustomServiceModeLabel(mode?: CustomServiceMode): string {
  const found = CUSTOM_SERVICE_MODES.find((item) => item.id === mode);
  return found ? found.label : 'Build Saja';
}

export function isDesignIncluded(mode: CustomServiceMode): boolean {
  return mode === 'design-only' || mode === 'design-and-build';
}

export function isBuildIncluded(mode: CustomServiceMode): boolean {
  return mode === 'build-only' || mode === 'design-and-build';
}

/**
 * Opsi kelengkapan yang tetap relevan saat klien memesan mode Desain Saja.
 * Aksesori fisik seperti soft-close, LED kabinet, dan jalur kabel hanya dihitung saat Build aktif.
 */
export const DESIGN_COMPATIBLE_OPTION_IDS: ReadonlySet<string> = new Set(['survei-lokasi']);

export interface CustomPricingRules {
  /**
   * Mengaktifkan atau menonaktifkan skema harga promo (harga coret vs harga saat ini).
   */
  promoAktif?: boolean;
  /**
   * Harga jasa desain per meter persegi (m²) saat ini dalam IDR.
   */
  hargaDesainPerMeterPersegi?: number | null;
  /**
   * Harga jasa desain per meter persegi (m²) sebelum promo (harga coret) dalam IDR.
   */
  hargaDesainSebelumPromoPerMeterPersegi?: number | null;
  /**
   * Harga bahan dasar per meter persegi (m²) saat ini dalam IDR.
   * Berlaku untuk: mdf, blockboard, pvc, multipleks, particle-board.
   */
  hargaBahanPerMeterPersegi: Record<string, number | null>;
  /**
   * Harga bahan dasar per meter persegi (m²) sebelum promo (harga coret) dalam IDR.
   */
  hargaBahanSebelumPromoPerMeterPersegi?: Record<string, number | null>;
  /**
   * Harga finishing / laminasi per meter persegi (m²) saat ini dalam IDR.
   * Berlaku untuk: cat-duco, sheet, hpl.
   */
  hargaFinishingPerMeterPersegi: Record<string, number | null>;
  /**
   * Harga finishing / laminasi per meter persegi (m²) sebelum promo (harga coret) dalam IDR.
   */
  hargaFinishingSebelumPromoPerMeterPersegi?: Record<string, number | null>;
  /**
   * Biaya tetap opsional per kelengkapan tambahan dalam IDR.
   */
  biayaTambahanOpsi: Record<string, number | null>;
}

export const DEFAULT_CUSTOM_PRICING_RULES: CustomPricingRules =
  customPricingData.aturanBawaan as CustomPricingRules;

export const INDICATIVE_ESTIMATE_CONFIG: PricingConfiguration =
  customPricingData.konfigurasiIndikatif as PricingConfiguration;

export const INDICATIVE_WORKSHOP_ESTIMATE_RULES: CustomPricingRules =
  customPricingData.aturanIndikatif as CustomPricingRules;

export interface CustomEstimateBreakdown {
  status: 'configured' | 'contact';
  serviceMode: CustomServiceMode;
  areaSquareMeters: number;
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

export function calculateAreaSquareMeters(dimensions: RoomDimensionsInput): number {
  const lengthM = dimensions.normalizedLengthCm / 100;
  const widthM = dimensions.normalizedWidthCm / 100;
  const rawArea = lengthM * widthM;
  return Math.round(rawArea * 100) / 100;
}

function getDisclaimerByMode(serviceMode: CustomServiceMode): string {
  if (serviceMode === 'design-only') {
    return 'Estimasi awal jasa desain dihitung dari luas panjang × lebar dikalikan tarif desain per m²; mencakup konsep tata letak, visual 3D, dan gambar kerja.';
  }
  if (serviceMode === 'design-and-build') {
    return 'Estimasi awal paket Desain + Build dihitung dari luas panjang × lebar dikalikan tarif desain, material utama, dan finishing/laminasi per m²; perlu konfirmasi pengukuran lapangan.';
  }
  return 'Estimasi awal dihitung dari luas panjang × lebar dikalikan tarif material utama dan finishing/laminasi per m²; perlu konfirmasi pengukuran lapangan.';
}

export function calculateCustomEstimate(params: {
  serviceMode?: CustomServiceMode;
  itemTypeId?: string;
  materialId: string;
  finishId: string;
  dimensions: RoomDimensionsInput;
  additionalOptionIds: string[];
  quantity: number;
  pricingConfig?: PricingConfiguration;
  rules?: CustomPricingRules;
}): CustomEstimateBreakdown {
  const serviceMode: CustomServiceMode = params.serviceMode ?? 'build-only';
  const includeDesign = isDesignIncluded(serviceMode);
  const includeBuild = isBuildIncluded(serviceMode);

  const pricingConfig = params.pricingConfig ?? BUSINESS_CONFIG.pengaturanHarga;
  const rules = params.rules ?? DEFAULT_CUSTOM_PRICING_RULES;
  const areaSquareMeters = calculateAreaSquareMeters(params.dimensions);
  const quantity = Math.max(1, Math.floor(params.quantity || 1));
  const disclaimer = getDisclaimerByMode(serviceMode);

  const buildContactFallback = (): CustomEstimateBreakdown => ({
    status: 'contact',
    serviceMode,
    areaSquareMeters,
    designRatePerSqm: null,
    materialRatePerSqm: null,
    finishingRatePerSqm: null,
    designAmount: null,
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

  let designRatePerSqm: number | null = null;
  let designAmount: number | null = null;

  if (includeDesign) {
    const rawDesignRate = rules.hargaDesainPerMeterPersegi ?? null;
    if (typeof rawDesignRate !== 'number' || !Number.isFinite(rawDesignRate) || rawDesignRate <= 0) {
      return buildContactFallback();
    }
    designRatePerSqm = rawDesignRate;
    designAmount = Math.round(areaSquareMeters * rawDesignRate);
  }

  let materialRatePerSqm: number | null = null;
  let finishingRatePerSqm: number | null = null;
  let materialAmount: number | null = null;
  let finishingAmount: number | null = null;
  let buildAmount: number | null = null;

  if (includeBuild) {
    const rawMaterialRate = rules.hargaBahanPerMeterPersegi[params.materialId] ?? null;
    const rawFinishingRate = rules.hargaFinishingPerMeterPersegi[params.finishId] ?? null;

    if (
      typeof rawMaterialRate !== 'number' ||
      !Number.isFinite(rawMaterialRate) ||
      rawMaterialRate <= 0 ||
      typeof rawFinishingRate !== 'number' ||
      !Number.isFinite(rawFinishingRate) ||
      rawFinishingRate <= 0
    ) {
      return buildContactFallback();
    }

    materialRatePerSqm = rawMaterialRate;
    finishingRatePerSqm = rawFinishingRate;
    materialAmount = Math.round(areaSquareMeters * rawMaterialRate);
    finishingAmount = Math.round(areaSquareMeters * rawFinishingRate);
    buildAmount = materialAmount + finishingAmount;
  }

  const baseAmount = (designAmount ?? 0) + (buildAmount ?? 0);

  let optionsAmount = 0;
  for (const optionId of params.additionalOptionIds) {
    if (!includeBuild && !DESIGN_COMPATIBLE_OPTION_IDS.has(optionId)) {
      continue;
    }
    const fee = rules.biayaTambahanOpsi[optionId];
    if (typeof fee === 'number' && Number.isFinite(fee) && fee > 0) {
      optionsAmount += fee;
    }
  }

  const estimatedUnitTotal = baseAmount + optionsAmount;
  const estimatedLineTotal = estimatedUnitTotal * quantity;

  const validDpPercentage =
    typeof pricingConfig.persentaseDp === 'number' &&
    Number.isFinite(pricingConfig.persentaseDp) &&
    pricingConfig.persentaseDp > 0 &&
    pricingConfig.persentaseDp <= 100
      ? pricingConfig.persentaseDp
      : null;

  const estimatedDpUnitAmount =
    validDpPercentage !== null
      ? Math.round((estimatedUnitTotal * validDpPercentage) / 100)
      : null;

  const estimatedDpLineTotal =
    estimatedDpUnitAmount !== null ? estimatedDpUnitAmount * quantity : null;

  return {
    status: 'configured',
    serviceMode,
    areaSquareMeters,
    designRatePerSqm,
    materialRatePerSqm,
    finishingRatePerSqm,
    designAmount,
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
}

export function getCustomStartingRates(
  pricingConfig: PricingConfiguration,
  rules: CustomPricingRules
): CustomStartingRatesSummary {
  if (!pricingConfig.hargaCustomTerkonfigurasi) {
    return {
      isConfigured: false,
      designPerSqm: null,
      minBuildPerSqm: null,
      minDesignAndBuildPerSqm: null,
    };
  }

  const designRate =
    typeof rules.hargaDesainPerMeterPersegi === 'number' &&
    Number.isFinite(rules.hargaDesainPerMeterPersegi) &&
    rules.hargaDesainPerMeterPersegi > 0
      ? rules.hargaDesainPerMeterPersegi
      : null;

  const materialRates = Object.values(rules.hargaBahanPerMeterPersegi).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  );
  const finishingRates = Object.values(rules.hargaFinishingPerMeterPersegi).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  );

  const minBuildPerSqm =
    materialRates.length > 0 && finishingRates.length > 0
      ? Math.min(...materialRates) + Math.min(...finishingRates)
      : null;

  const minDesignAndBuildPerSqm =
    designRate !== null && minBuildPerSqm !== null ? designRate + minBuildPerSqm : null;

  return {
    isConfigured: true,
    designPerSqm: designRate,
    minBuildPerSqm,
    minDesignAndBuildPerSqm,
  };
}

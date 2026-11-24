import {
  calculateCatalogVariantPrice,
  getDefaultProductDimensionsCm,
} from '../lib/catalog-pricing';
import { calculatePaymentSchemeBreakdown } from '../lib/payment-scheme';
import { formatCurrencyIDR } from '../lib/price-format';
import { getProductSlug } from '../lib/product-catalog';
import type { CustomInteriorPricingConfig, PaymentSchemeConfig } from '../types/cms';
import type { ProductItem } from '../types/product';
import type { ExtractedDimensionQuery, SainAiEstimateBreakdown } from './types';

const MATERIAL_LABEL_BY_ID: Record<'blockboard' | 'multipleks' | 'pvc', string> = {
  blockboard: 'Blockboard 18 mm',
  multipleks: 'Multipleks 18 mm',
  pvc: 'PVC Board 18 mm',
};

const FINISH_LABEL_BY_ID: Record<'hpl' | 'cat-duco', string> = {
  hpl: 'HPL',
  'cat-duco': 'Cat Duco',
};

export function computeProductEstimateFromQuery(params: {
  product: ProductItem;
  materialId?: 'blockboard' | 'multipleks' | 'pvc' | null;
  finishId?: 'hpl' | 'cat-duco' | null;
  dimensions?: ExtractedDimensionQuery | null;
  customPricing?: CustomInteriorPricingConfig | null;
  paymentScheme?: PaymentSchemeConfig;
}): SainAiEstimateBreakdown {
  const defaults = getDefaultProductDimensionsCm(params.product);

  let lengthCm = defaults.lengthCm;
  let heightOrDepthCm = defaults.widthCm;
  let areaSqm = defaults.areaSqm;

  if (params.dimensions) {
    if (params.dimensions.lengthCm && params.dimensions.widthOrHeightCm) {
      lengthCm = params.dimensions.lengthCm;
      heightOrDepthCm = params.dimensions.widthOrHeightCm;
      areaSqm = params.dimensions.areaSqm ?? (lengthCm * heightOrDepthCm) / 10000;
    } else if (params.dimensions.areaSqm) {
      areaSqm = params.dimensions.areaSqm;
      lengthCm = Math.round(Math.sqrt(areaSqm) * 100);
      heightOrDepthCm = lengthCm;
    } else if (params.dimensions.lengthCm) {
      lengthCm = params.dimensions.lengthCm;
      areaSqm = Math.round(((lengthCm * heightOrDepthCm) / 10000) * 100) / 100;
    }
  }

  const resolvedMaterial = params.materialId ?? 'multipleks';
  const resolvedFinish = params.finishId ?? 'hpl';

  const calc = calculateCatalogVariantPrice({
    product: params.product,
    areaSqm,
    lengthCm,
    materialLabel: MATERIAL_LABEL_BY_ID[resolvedMaterial],
    finishLabel: FINISH_LABEL_BY_ID[resolvedFinish],
    siteCustomPricing: params.customPricing,
  });

  const dimensionLabel = params.dimensions?.rawLabel
    ? params.product.meterLari
      ? `Panjang ${Math.round(lengthCm)} cm (${calc.measureQuantity} m)`
      : params.dimensions.areaSqm && !params.dimensions.lengthCm
        ? `Luas ${calc.areaSqm} m²`
        : `${Math.round(lengthCm)} × ${Math.round(heightOrDepthCm)} cm`
    : `${Math.round(defaults.lengthCm)} × ${Math.round(defaults.widthCm)} cm (acuan standar)`;

  const unitRateFormatted = formatCurrencyIDR(calc.effectivePerSqmRate) ?? `Rp ${calc.effectivePerSqmRate}`;
  const totalFormatted = formatCurrencyIDR(calc.unitPrice) ?? `Rp ${calc.unitPrice}`;
  const compareAtFormatted =
    calc.promoActive && calc.compareAtUnitPrice !== null
      ? formatCurrencyIDR(calc.compareAtUnitPrice)
      : null;

  const schedule = calculatePaymentSchemeBreakdown(calc.unitPrice, params.paymentScheme);

  return {
    productName: params.product.nama,
    productSlug: getProductSlug(params.product),
    dimensionLabel,
    measureLabel: `${calc.measureQuantity} ${calc.pricingUnitLabel}`,
    materialLabel: MATERIAL_LABEL_BY_ID[resolvedMaterial],
    finishLabel: FINISH_LABEL_BY_ID[resolvedFinish],
    unitRateLabel: `${unitRateFormatted}/${calc.pricingUnitLabel}`,
    totalEstimateFormatted: totalFormatted,
    compareAtFormatted,
    promoLabel: calc.promoActive && calc.promoPercentLabel ? `Hemat ${calc.promoPercentLabel}` : null,
    unitPriceNumeric: calc.unitPrice,
    paymentStages: schedule.map((stage) => ({
      nama: stage.nama,
      persentase: stage.persentase,
      amountFormatted: formatCurrencyIDR(stage.amount) ?? 'Menyesuaikan kontrak',
    })),
  };
}

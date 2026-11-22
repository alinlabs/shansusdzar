import defaultMaterialSpecsJson from '../../../data/spesifikasi-material.json';
import {
  DEFAULT_UNIVERSAL_COLOR,
  UNIVERSAL_COLOR_PALETTE,
} from '../../../lib/color-palette';
import {
  getAvailableFinishIdsFromTariff,
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialIdsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  mapOptionLabelToFinishId,
  mapOptionLabelToMaterialId,
} from '../../../lib/catalog-pricing';
import { getProductSlug } from '../../../lib/product-catalog';
import type {
  CustomCartItem,
  CustomServiceMode,
  DimensionUnit,
  RoomDimensionsInput,
} from '../../../types/cart';
import type { MaterialSpecItem } from '../../../types/cms';
import type { ProductItem } from '../../../types/product';

export interface CustomOptionCatalogItem {
  id: string;
  label: string;
  deskripsi: string;
}

export interface CustomSelectableItem {
  id: string;
  label: string;
  kategori?: string;
  produkSlug?: string;
}

export interface CustomColorSwatch {
  id: string;
  nama: string;
  hex: string;
  catatanNuansa?: string;
}

export function mapMaterialSpecIdToConfiguratorId(
  spec: Pick<MaterialSpecItem, 'id' | 'nama'>
): string {
  return mapOptionLabelToMaterialId(spec.nama) ?? spec.id.replace(/^mat-/, '');
}

export function mapFinishSpecIdToConfiguratorId(
  spec: Pick<MaterialSpecItem, 'id' | 'nama'>
): string {
  return mapOptionLabelToFinishId(spec.nama) ?? spec.id.replace(/^fin-/, '');
}

export function buildCustomMaterialsFromSpecs(
  specs: readonly MaterialSpecItem[]
): CustomOptionCatalogItem[] {
  return specs
    .filter((item) => item.kategori === 'papan')
    .map((item) => ({
      id: mapMaterialSpecIdToConfiguratorId(item),
      label: item.nama,
      deskripsi: item.ringkasan,
    }));
}

export function buildCustomFinishesFromSpecs(
  specs: readonly MaterialSpecItem[]
): CustomOptionCatalogItem[] {
  return specs
    .filter((item) => item.kategori === 'finishing')
    .map((item) => ({
      id: mapFinishSpecIdToConfiguratorId(item),
      label: item.nama,
      deskripsi: item.ringkasan,
    }));
}

export function buildProductMaterialOptions(
  product: ProductItem | null | undefined
): CustomOptionCatalogItem[] {
  if (!product) return [];
  const ids = getAvailableMaterialIdsFromTariff(product);
  const labels = getAvailableMaterialLabelsFromTariff(product);
  return ids.map((id, idx) => ({
    id,
    label: labels[idx] ?? id,
    deskripsi: '',
  }));
}

export function buildProductFinishOptions(
  product: ProductItem | null | undefined
): CustomOptionCatalogItem[] {
  if (!product) return [];
  const ids = getAvailableFinishIdsFromTariff(product);
  const labels = getAvailableFinishLabelsFromTariff(product);
  return ids.map((id, idx) => ({
    id,
    label: labels[idx] ?? id,
    deskripsi: '',
  }));
}

export const CUSTOM_MATERIALS: CustomOptionCatalogItem[] = buildCustomMaterialsFromSpecs(
  defaultMaterialSpecsJson as MaterialSpecItem[]
);

export const CUSTOM_FINISHES: CustomOptionCatalogItem[] = buildCustomFinishesFromSpecs(
  defaultMaterialSpecsJson as MaterialSpecItem[]
);

export const CUSTOM_COLOR_SWATCHES: CustomColorSwatch[] =
  UNIVERSAL_COLOR_PALETTE as CustomColorSwatch[];

export interface CustomDimensionErrors {
  length?: string;
  width?: string;
}

export interface CustomConfiguratorDraft {
  serviceMode: CustomServiceMode;
  selectedProductId: string | null;
  lengthInput: string;
  widthInput: string;
  unit: DimensionUnit;
  materialId: string;
  finishId: string;
  colorId: string;
  customStyleValue: string | null;
  additionalOptionIds: string[];
  notes: string;
  quantity: number;
}

export function createDefaultCustomDraft(
  initialServiceMode: CustomServiceMode = 'design-and-build'
): CustomConfiguratorDraft {
  return {
    serviceMode: initialServiceMode,
    selectedProductId: null,
    lengthInput: '',
    widthInput: '',
    unit: 'cm',
    materialId: CUSTOM_MATERIALS.find((m) => m.id === 'blockboard')?.id ?? CUSTOM_MATERIALS[0]?.id ?? 'blockboard',
    finishId: CUSTOM_FINISHES[0]?.id ?? 'hpl',
    colorId: CUSTOM_COLOR_SWATCHES[0]?.id ?? DEFAULT_UNIVERSAL_COLOR.id,
    customStyleValue: null,
    additionalOptionIds: [],
    notes: '',
    quantity: 1,
  };
}

export function applyProductSelectionToDraft(
  prev: CustomConfiguratorDraft,
  product: ProductItem
): CustomConfiguratorDraft {
  const availableMaterialIds = getAvailableMaterialIdsFromTariff(product);
  const availableFinishIds = getAvailableFinishIdsFromTariff(product);

  const hasValidPairRate = (matId: string, finId: string): boolean => {
    if (!product.harga) return true;
    const bucket = finId === 'cat-duco' || finId === 'duco' ? product.harga.duco : product.harga.hpl;
    const val = bucket?.[matId];
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
  };

  let nextMaterialId = availableMaterialIds.includes(prev.materialId)
    ? prev.materialId
    : (availableMaterialIds[0] ?? prev.materialId);
  let nextFinishId = availableFinishIds.includes(prev.finishId)
    ? prev.finishId
    : (availableFinishIds[0] ?? prev.finishId);

  if (product.harga && !hasValidPairRate(nextMaterialId, nextFinishId)) {
    const validFinishForMat = availableFinishIds.find((f) => hasValidPairRate(nextMaterialId, f));
    if (validFinishForMat) {
      nextFinishId = validFinishForMat;
    } else {
      const validMatForFinish = availableMaterialIds.find((m) => hasValidPairRate(m, nextFinishId));
      if (validMatForFinish) {
        nextMaterialId = validMatForFinish;
      } else {
        outer: for (const f of availableFinishIds) {
          for (const m of availableMaterialIds) {
            if (hasValidPairRate(m, f)) {
              nextMaterialId = m;
              nextFinishId = f;
              break outer;
            }
          }
        }
      }
    }
  }

  const productColors =
    product.pilihanWarna && product.pilihanWarna.length > 0
      ? product.pilihanWarna
      : CUSTOM_COLOR_SWATCHES;
  const hasValidCurrentColor = productColors.some((c) => c.id === prev.colorId);
  const includedOptionIds = [...(product.include ?? [])];

  return {
    ...prev,
    serviceMode: 'design-and-build',
    selectedProductId: product.id,
    unit: 'cm',
    materialId: nextMaterialId,
    finishId: nextFinishId,
    colorId: hasValidCurrentColor
      ? prev.colorId
      : (productColors[0]?.id ?? DEFAULT_UNIVERSAL_COLOR.id),
    customStyleValue: product.customisasi[0] ?? null,
    additionalOptionIds: includedOptionIds,
  };
}

export function filterCustomProducts(
  products: readonly ProductItem[],
  query: string
): ProductItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...products];
  return products.filter((product) =>
    `${product.nama} ${product.kategori}`.toLowerCase().includes(normalized)
  );
}

export function parseCustomServiceModeParam(raw: string | null): CustomServiceMode | null {
  if (raw === 'design-only' || raw === 'build-only' || raw === 'design-and-build') {
    return 'design-and-build';
  }
  return null;
}

export function mapCatalogProductsToSelectableItems(
  products: readonly ProductItem[]
): CustomSelectableItem[] {
  return products.map((product) => ({
    id: product.id,
    label: product.nama,
    kategori: product.kategori,
    produkSlug: getProductSlug(product),
  }));
}

export function convertUnitValue(value: number, from: DimensionUnit, to: DimensionUnit): number {
  if (from === to) return value;
  if (from === 'cm' && to === 'm') {
    return Math.round((value / 100) * 100) / 100;
  }
  return Math.round(value * 100);
}

export function toCentimeters(value: number, unit: DimensionUnit): number {
  const cm = unit === 'm' ? value * 100 : value;
  return Math.round(cm * 100) / 100;
}

export function validateDimensionsInput(params: {
  lengthInput: string;
  widthInput: string;
  unit: DimensionUnit;
}): {
  isValid: boolean;
  errors: CustomDimensionErrors;
  normalized: RoomDimensionsInput | null;
} {
  const errors: CustomDimensionErrors = {};

  const lengthVal = Number(params.lengthInput.replace(',', '.'));
  const widthVal = Number(params.widthInput.replace(',', '.'));

  const normalizedLengthCm =
    params.lengthInput.trim() && Number.isFinite(lengthVal) && lengthVal > 0
      ? toCentimeters(lengthVal, params.unit)
      : 0;
  const normalizedWidthCm =
    params.widthInput.trim() && Number.isFinite(widthVal) && widthVal > 0
      ? toCentimeters(widthVal, params.unit)
      : 0;

  if (normalizedLengthCm <= 0) {
    errors.length = 'Masukkan panjang bidang yang valid (lebih dari 0 cm).';
  }

  if (normalizedWidthCm <= 0) {
    errors.width = 'Masukkan tinggi bidang yang valid (lebih dari 0 cm).';
  }

  if (errors.length || errors.width) {
    return { isValid: false, errors, normalized: null };
  }

  return {
    isValid: true,
    errors,
    normalized: {
      length: Math.round(lengthVal * 100) / 100,
      width: Math.round(widthVal * 100) / 100,
      height: null,
      unit: params.unit,
      normalizedLengthCm,
      normalizedWidthCm,
      normalizedHeightCm: null,
    },
  };
}

export function formatConvertedDimensionDisplay(dimensions: RoomDimensionsInput): string {
  if (dimensions.unit === 'm') {
    return `Setara ${Math.round(dimensions.normalizedLengthCm)} × ${Math.round(dimensions.normalizedWidthCm)} cm`;
  }

  return `Setara ${(dimensions.normalizedLengthCm / 100).toFixed(2)} × ${(dimensions.normalizedWidthCm / 100).toFixed(2)} m`;
}

export function customItemToDraft(
  item: CustomCartItem,
  catalogProducts?: readonly ProductItem[]
): CustomConfiguratorDraft {
  const matchedProduct = catalogProducts?.find(
    (p) => p.id === item.itemTypeId || p.nama === item.itemTypeLabel
  );
  const productMaterials = matchedProduct
    ? buildProductMaterialOptions(matchedProduct)
    : CUSTOM_MATERIALS;
  const productFinishes = matchedProduct
    ? buildProductFinishOptions(matchedProduct)
    : CUSTOM_FINISHES;

  const materialMatch =
    productMaterials.find((m) => m.id === item.materialId || m.label === item.materialLabel) ??
    CUSTOM_MATERIALS.find((m) => m.id === item.materialId || m.label === item.materialLabel);
  const finishMatch =
    productFinishes.find((f) => f.id === item.finishId || f.label === item.finishLabel) ??
    CUSTOM_FINISHES.find((f) => f.id === item.finishId || f.label === item.finishLabel);

  const optionIds = [...(matchedProduct?.include ?? [])];

  const modelEntry = item.additionalOptions.find((entry) => entry.startsWith('Model: '));
  const customStyleValue = modelEntry ? modelEntry.slice('Model: '.length).trim() : null;

  const normalizedLengthCm =
    item.dimensions.unit === 'm'
      ? toCentimeters(item.dimensions.length, 'm')
      : item.dimensions.normalizedLengthCm || item.dimensions.length;
  const normalizedWidthCm =
    item.dimensions.unit === 'm'
      ? toCentimeters(item.dimensions.width, 'm')
      : item.dimensions.normalizedWidthCm || item.dimensions.width;

  return {
    serviceMode: 'design-and-build',
    selectedProductId: item.itemTypeId || null,
    lengthInput: normalizedLengthCm > 0 ? String(normalizedLengthCm) : '',
    widthInput: normalizedWidthCm > 0 ? String(normalizedWidthCm) : '',
    unit: 'cm',
    materialId:
      materialMatch?.id ??
      (CUSTOM_MATERIALS.find((m) => m.id === 'blockboard')?.id ??
        CUSTOM_MATERIALS[0]?.id ??
        'blockboard'),
    finishId: finishMatch?.id ?? CUSTOM_FINISHES[0]?.id ?? 'hpl',
    colorId: item.colorId || CUSTOM_COLOR_SWATCHES[0].id,
    customStyleValue,
    additionalOptionIds: optionIds,
    notes: item.notes,
    quantity: item.quantity,
  };
}

export function resolveFittingGridColumns(params: {
  itemCount: number;
  containerWidth: number;
  maxRequiredItemWidth: number;
  gapPx?: number;
  maxColumns?: number;
}): number {
  const {
    itemCount,
    containerWidth,
    maxRequiredItemWidth,
    gapPx = 8,
    maxColumns = 4,
  } = params;

  if (itemCount <= 1) return 1;
  const upperBound = Math.max(1, Math.min(itemCount, maxColumns));
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return upperBound;
  }
  if (!Number.isFinite(maxRequiredItemWidth) || maxRequiredItemWidth <= 0) {
    return upperBound;
  }

  for (let cols = upperBound; cols >= 1; cols -= 1) {
    const colWidth = (containerWidth - gapPx * (cols - 1)) / cols;
    if (colWidth >= maxRequiredItemWidth) {
      return cols;
    }
  }

  return 1;
}


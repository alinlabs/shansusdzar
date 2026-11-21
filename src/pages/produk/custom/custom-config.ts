import customConfiguratorData from '../../../data/konfigurasi-custom-interior.json';
import type {
  CustomCartItem,
  CustomServiceMode,
  DimensionUnit,
  RoomDimensionsInput,
} from '../../../types/cart';
import type { ProductItem } from '../../../types/product';

export interface CustomOptionCatalogItem {
  id: string;
  label: string;
  deskripsi: string;
}

export interface CustomSelectableItem extends CustomOptionCatalogItem {
  kategori?: string;
  produkSlug?: string;
  hargaProdukLabel?: string | null;
}

export interface CustomColorSwatch {
  id: string;
  nama: string;
  hex: string;
  catatanNuansa: string;
}

export const CUSTOM_PROJECT_TYPES: CustomOptionCatalogItem[] =
  customConfiguratorData.jenisProyek as CustomOptionCatalogItem[];

export const CUSTOM_ITEM_TYPES: CustomOptionCatalogItem[] =
  customConfiguratorData.jenisItem as CustomOptionCatalogItem[];

export const CUSTOM_MATERIALS: CustomOptionCatalogItem[] =
  customConfiguratorData.daftarMaterial as CustomOptionCatalogItem[];

export const CUSTOM_FINISHES: CustomOptionCatalogItem[] =
  customConfiguratorData.daftarFinishing as CustomOptionCatalogItem[];

export const CUSTOM_COLOR_SWATCHES: CustomColorSwatch[] =
  customConfiguratorData.pilihanWarna as CustomColorSwatch[];

export const CUSTOM_ADDITIONAL_OPTIONS: CustomOptionCatalogItem[] =
  customConfiguratorData.opsiTambahan as CustomOptionCatalogItem[];

export const DIMENSION_BOUNDS_CM = customConfiguratorData.batasDimensiCm;

export interface CustomDimensionErrors {
  length?: string;
  width?: string;
}

export interface CustomConfiguratorDraft {
  serviceMode: CustomServiceMode;
  projectTypeId: string;
  lengthInput: string;
  widthInput: string;
  unit: DimensionUnit;
  itemTypeId: string;
  materialId: string;
  finishId: string;
  colorId: string;
  additionalOptionIds: string[];
  notes: string;
  quantity: number;
}

export function createDefaultCustomDraft(
  initialServiceMode: CustomServiceMode = 'design-and-build'
): CustomConfiguratorDraft {
  return {
    serviceMode: initialServiceMode,
    projectTypeId: CUSTOM_PROJECT_TYPES[0].id,
    lengthInput: '300',
    widthInput: '250',
    unit: 'cm',
    itemTypeId: CUSTOM_ITEM_TYPES[0].id,
    materialId: CUSTOM_MATERIALS[3]?.id ?? CUSTOM_MATERIALS[0].id,
    finishId: CUSTOM_FINISHES[2]?.id ?? CUSTOM_FINISHES[0].id,
    colorId: CUSTOM_COLOR_SWATCHES[0].id,
    additionalOptionIds: [],
    notes: '',
    quantity: 1,
  };
}

export function parseCustomServiceModeParam(raw: string | null): CustomServiceMode | null {
  if (raw === 'design-only' || raw === 'build-only' || raw === 'design-and-build') {
    return raw;
  }
  return null;
}

export function mapCatalogCategoryToProjectTypeId(category: string): string {
  const norm = category.toLowerCase();
  if (norm.includes('dapur')) return 'dapur-pantry';
  if (norm.includes('tidur')) return 'kamar-tidur';
  if (norm.includes('makan')) return 'ruang-makan';
  if (norm.includes('kerja')) return 'ruang-kerja';
  if (norm.includes('komersial') || norm.includes('gerai') || norm.includes('mandi')) {
    return 'komersial-lainnya';
  }
  return 'ruang-tamu';
}

export function mapCatalogProductsToSelectableItems(
  products: readonly ProductItem[],
  formatProductPriceLabel: (product: ProductItem) => string | null
): CustomSelectableItem[] {
  const mapped: CustomSelectableItem[] = products.map((product) => ({
    id: product.id,
    label: product.nama,
    deskripsi: product.deskripsiSingkat,
    kategori: product.kategori,
    produkSlug: product.slug,
    hargaProdukLabel: formatProductPriceLabel(product),
  }));

  const roomPackage = CUSTOM_ITEM_TYPES.find((item) => item.id === 'paket-ruang');
  if (roomPackage && !mapped.some((item) => item.id === roomPackage.id)) {
    mapped.push({
      ...roomPackage,
      kategori: 'Paket Penataan',
      hargaProdukLabel: null,
    });
  }

  return mapped.length > 0 ? mapped : CUSTOM_ITEM_TYPES;
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
  return Math.round(cm * 10) / 10;
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
  const unitLabel = params.unit;
  const minHorizontal = params.unit === 'm' ? '0.3' : '30';
  const maxHorizontal = params.unit === 'm' ? '30' : '3000';

  const lengthVal = Number(params.lengthInput.replace(',', '.'));
  const widthVal = Number(params.widthInput.replace(',', '.'));

  if (!params.lengthInput.trim() || !Number.isFinite(lengthVal) || lengthVal <= 0) {
    errors.length = 'Masukkan panjang bidang yang valid (lebih dari 0).';
  } else {
    const cm = toCentimeters(lengthVal, params.unit);
    if (cm < DIMENSION_BOUNDS_CM.panjangMin || cm > DIMENSION_BOUNDS_CM.panjangMax) {
      errors.length = `Panjang harus berada di antara ${minHorizontal} hingga ${maxHorizontal} ${unitLabel}.`;
    }
  }

  if (!params.widthInput.trim() || !Number.isFinite(widthVal) || widthVal <= 0) {
    errors.width = 'Masukkan lebar bidang yang valid (lebih dari 0).';
  } else {
    const cm = toCentimeters(widthVal, params.unit);
    if (cm < DIMENSION_BOUNDS_CM.lebarMin || cm > DIMENSION_BOUNDS_CM.lebarMax) {
      errors.width = `Lebar harus berada di antara ${minHorizontal} hingga ${maxHorizontal} ${unitLabel}.`;
    }
  }

  if (errors.length || errors.width) {
    return { isValid: false, errors, normalized: null };
  }

  const normalizedLengthCm = toCentimeters(lengthVal, params.unit);
  const normalizedWidthCm = toCentimeters(widthVal, params.unit);

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

export function customItemToDraft(item: CustomCartItem): CustomConfiguratorDraft {
  const materialMatch = CUSTOM_MATERIALS.find(
    (m) => m.id === item.materialId || m.label === item.materialLabel
  );
  const finishMatch = CUSTOM_FINISHES.find(
    (f) => f.id === item.finishId || f.label === item.finishLabel
  );
  const optionIds = CUSTOM_ADDITIONAL_OPTIONS.filter((opt) =>
    item.additionalOptions.includes(opt.label)
  ).map((opt) => opt.id);

  return {
    serviceMode: item.serviceMode ?? 'build-only',
    projectTypeId: item.projectTypeId || CUSTOM_PROJECT_TYPES[0].id,
    lengthInput: String(item.dimensions.length),
    widthInput: String(item.dimensions.width),
    unit: item.dimensions.unit,
    itemTypeId: item.itemTypeId || CUSTOM_ITEM_TYPES[0].id,
    materialId: materialMatch?.id ?? (CUSTOM_MATERIALS[3]?.id ?? CUSTOM_MATERIALS[0].id),
    finishId: finishMatch?.id ?? (CUSTOM_FINISHES[2]?.id ?? CUSTOM_FINISHES[0].id),
    colorId: item.colorId || CUSTOM_COLOR_SWATCHES[0].id,
    additionalOptionIds: optionIds,
    notes: item.notes,
    quantity: item.quantity,
  };
}

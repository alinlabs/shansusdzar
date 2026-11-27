import produkData from '../data/produk.json';
import type { CustomInteriorPricingConfig } from '../types/cms';
import type { ProjectProductAddonItem, ProjectProductItem } from '../types/finance';
import type { ProductItem } from '../types/product';
import {
  calculateCatalogVariantPrice,
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  type CatalogVariantPriceResult,
} from './catalog-pricing';
import { extractDimensionAreaPairCm } from './dimension-format';

export const DEFAULT_CATALOG_PRODUCTS = produkData as ProductItem[];
export const DEFAULT_PROJECT_MATERIAL_OPTIONS = ['Blockboard', 'Multipleks', 'PVC Board'] as const;
export const DEFAULT_PROJECT_FINISHING_OPTIONS = ['HPL', 'Cat Duco'] as const;

export function findCatalogProduct(
  productId?: string | null,
  products: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): ProductItem | undefined {
  const code = String(productId ?? '').trim();
  if (!code) return undefined;
  return products.find((product) => product.id === code);
}

export function resolveProjectProductName(
  item: Pick<ProjectProductItem, 'id' | 'namaProduk'>,
  products: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): string {
  const matched = findCatalogProduct(item.id, products);
  if (matched?.nama) {
    return matched.nama;
  }
  const manualName = String(item.namaProduk ?? '').trim();
  if (manualName) {
    return manualName;
  }
  return '';
}

export function getProjectProductOptionSets(product?: ProductItem | null): {
  customisasiOptions: string[];
  materialOptions: string[];
  finishingOptions: string[];
} {
  if (!product) {
    return {
      customisasiOptions: [],
      materialOptions: [...DEFAULT_PROJECT_MATERIAL_OPTIONS],
      finishingOptions: [...DEFAULT_PROJECT_FINISHING_OPTIONS],
    };
  }

  const customisasiOptions = Array.isArray(product.customisasi)
    ? product.customisasi.map((item) => item.trim()).filter(Boolean)
    : [];

  const materialOptions = getAvailableMaterialLabelsFromTariff(product);
  const finishingOptions = getAvailableFinishLabelsFromTariff(product);

  return {
    customisasiOptions,
    materialOptions:
      materialOptions.length > 0 ? materialOptions : [...DEFAULT_PROJECT_MATERIAL_OPTIONS],
    finishingOptions:
      finishingOptions.length > 0 ? finishingOptions : [...DEFAULT_PROJECT_FINISHING_OPTIONS],
  };
}

export function seedTambahanFromProduct(
  product?: ProductItem | null
): ProjectProductAddonItem[] {
  if (!product || !Array.isArray(product.include)) {
    return [];
  }
  return product.include
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((jenis) => ({
      jenis,
      biaya: 0,
    }));
}

export function buildProjectProductSpecification(
  item: Pick<ProjectProductItem, 'customisasi' | 'material' | 'finishing' | 'kodeWarna' | 'tambahan'>
): string {
  const parts: string[] = [];
  const customisasi = String(item.customisasi ?? '').trim();
  const material = String(item.material ?? '').trim();
  const finishing = String(item.finishing ?? '').trim();
  const kodeWarna = String(item.kodeWarna ?? '').trim();

  if (customisasi) {
    parts.push(customisasi);
  }
  if (material) {
    parts.push(/\b18\s*mm\b/i.test(material) ? material : `${material} 18 MM`);
  }
  if (finishing) {
    const finishText = /^finishing\b/i.test(finishing) ? finishing : `Finishing ${finishing}`;
    parts.push(kodeWarna ? `${finishText} (${kodeWarna})` : finishText);
  } else if (kodeWarna) {
    parts.push(`Kode Warna ${kodeWarna}`);
  }
  if (Array.isArray(item.tambahan)) {
    for (const addon of item.tambahan) {
      const jenis = String(addon?.jenis ?? '').trim();
      if (jenis) {
        parts.push(jenis);
      }
    }
  }

  return parts.join(', ');
}

export interface ProjectProductAutoPriceInfo {
  unitPrice: number;
  areaPair: { lengthCm: number; widthCm: number } | null;
  pricingUnit: 'm' | 'm2';
  pricingUnitLabel: string;
  variantResult: CatalogVariantPriceResult | null;
}

export function calculateProjectProductAutoPrice(params: {
  productId?: string | null;
  dimensi?: string | null;
  material?: string | null;
  finishing?: string | null;
  siteCustomPricing?: CustomInteriorPricingConfig | null;
  products?: ReadonlyArray<ProductItem>;
}): ProjectProductAutoPriceInfo {
  const product = findCatalogProduct(params.productId, params.products);
  const areaPair = extractDimensionAreaPairCm(params.dimensi);
  const pricingUnit: 'm' | 'm2' = product?.meterLari ? 'm' : 'm2';
  const pricingUnitLabel = pricingUnit === 'm' ? 'm' : 'm²';

  if (!product || !areaPair) {
    return {
      unitPrice: 0,
      areaPair,
      pricingUnit,
      pricingUnitLabel,
      variantResult: null,
    };
  }

  const areaSqm = (areaPair.lengthCm * areaPair.widthCm) / 10000;
  const variantResult = calculateCatalogVariantPrice({
    product,
    areaSqm,
    lengthCm: areaPair.lengthCm,
    materialLabel: params.material,
    finishLabel: params.finishing,
    siteCustomPricing: params.siteCustomPricing,
  });

  return {
    unitPrice: Math.max(0, Math.round(variantResult.unitPrice)),
    areaPair,
    pricingUnit: variantResult.pricingUnit,
    pricingUnitLabel: variantResult.pricingUnitLabel,
    variantResult,
  };
}

export function computeProjectProductTambahanTotal(
  item: Pick<ProjectProductItem, 'tambahan'>
): number {
  if (!Array.isArray(item.tambahan)) return 0;
  return item.tambahan.reduce((acc, addon) => {
    const biaya = Math.max(0, Math.round(Number(addon?.biaya) || 0));
    return acc + biaya;
  }, 0);
}

export function computeProjectProductSubtotal(
  item: Pick<ProjectProductItem, 'jumlah' | 'hargaSatuan' | 'tambahan'>
): number {
  const qty = Math.max(1, Math.round(Number(item.jumlah) || 1));
  const unitPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
  return qty * unitPrice + computeProjectProductTambahanTotal(item);
}

export function applyCatalogProductSelection(
  currentItem: ProjectProductItem,
  productId: string,
  options?: {
    products?: ReadonlyArray<ProductItem>;
    siteCustomPricing?: CustomInteriorPricingConfig | null;
  }
): ProjectProductItem {
  const products = options?.products ?? DEFAULT_CATALOG_PRODUCTS;
  const product = findCatalogProduct(productId, products);
  if (!product) {
    return currentItem;
  }

  const optionSets = getProjectProductOptionSets(product);
  const currentCustom = String(currentItem.customisasi ?? '').trim();
  const nextCustomisasi = optionSets.customisasiOptions.includes(currentCustom)
    ? currentCustom
    : (optionSets.customisasiOptions[0] ?? '');

  const currentMaterial = String(currentItem.material ?? '').trim();
  const nextMaterial = optionSets.materialOptions.includes(currentMaterial)
    ? currentMaterial
    : optionSets.materialOptions.includes('Multipleks')
      ? 'Multipleks'
      : (optionSets.materialOptions[0] ?? 'Multipleks');

  const currentFinishing = String(currentItem.finishing ?? '').trim();
  const nextFinishing = optionSets.finishingOptions.includes(currentFinishing)
    ? currentFinishing
    : optionSets.finishingOptions.includes('HPL')
      ? 'HPL'
      : (optionSets.finishingOptions[0] ?? 'HPL');

  const previousCatalog = findCatalogProduct(currentItem.id, products);
  const previousIncludeSet = new Set(
    (previousCatalog?.include ?? []).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  );
  const existingCustomAddons = (currentItem.tambahan ?? [])
    .filter((addon) => {
      const jenis = String(addon?.jenis ?? '').trim();
      if (!jenis) return false;
      const biaya = Math.max(0, Math.round(Number(addon?.biaya) || 0));
      return !(biaya === 0 && previousIncludeSet.has(jenis.toLowerCase()));
    })
    .map((addon) => ({
      jenis: String(addon.jenis).trim(),
      biaya: Math.max(0, Math.round(Number(addon.biaya) || 0)),
    }));
  const seededIncludes = seedTambahanFromProduct(product).filter(
    (seeded) =>
      !existingCustomAddons.some(
        (custom) => custom.jenis.toLowerCase() === seeded.jenis.toLowerCase()
      )
  );
  const nextTambahan = [...seededIncludes, ...existingCustomAddons];

  const baseUpdated: ProjectProductItem = {
    ...currentItem,
    id: product.id,
    namaProduk: undefined,
    customisasi: nextCustomisasi,
    material: nextMaterial,
    finishing: nextFinishing,
    tambahan: nextTambahan,
  };

  return recalculateProjectProductItem(baseUpdated, {
    products,
    siteCustomPricing: options?.siteCustomPricing,
  });
}

export function recalculateProjectProductItem(
  item: ProjectProductItem,
  options?: {
    products?: ReadonlyArray<ProductItem>;
    siteCustomPricing?: CustomInteriorPricingConfig | null;
  }
): ProjectProductItem {
  const products = options?.products ?? DEFAULT_CATALOG_PRODUCTS;
  const hasCatalog = Boolean(findCatalogProduct(item.id, products));

  let nextHargaSatuan = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
  if (hasCatalog && !item.hargaManual) {
    const auto = calculateProjectProductAutoPrice({
      productId: item.id,
      dimensi: item.dimensi,
      material: item.material,
      finishing: item.finishing,
      siteCustomPricing: options?.siteCustomPricing,
      products,
    });
    nextHargaSatuan = auto.unitPrice;
  }

  let nextSpec = String(item.spesifikasiMaterial ?? '').trim();
  if (!item.spesifikasiManual) {
    const generated = buildProjectProductSpecification(item);
    if (generated) {
      nextSpec = generated;
    }
  }

  return {
    ...item,
    hargaSatuan: nextHargaSatuan,
    spesifikasiMaterial: nextSpec,
  };
}

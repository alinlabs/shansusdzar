import type {
  CooperationAgreementDocument,
  QuotationDocument,
} from '../types/documents';
import type { ProjectInvoice, WorkshopProject } from '../types/finance';
import type { ProductItem } from '../types/product';
import { resolveProductPromoMarkup } from './catalog-pricing';
import {
  calculateIndicativeDeliveryFee,
  calculateIndicativeDesign3dFee,
  calculateIndicativeSurveyFee,
  extractPreTaxAmount,
} from './custom-pricing';
import { extractDimensionAreaPairCm } from './dimension-format';
import { DEFAULT_CATALOG_PRODUCTS, findCatalogProduct } from './project-products';

export interface DocumentCostLineInput {
  productId?: string | null;
  namaProduk?: string | null;
  dimensi?: string | null;
  jumlah?: number | null;
  hargaSatuan?: number | null;
  subtotal?: number | null;
}

export interface DocumentCostBreakdown {
  surveyFee: number;
  surveyRatePercent: number;
  design3dFee: number;
  deliveryFee: number;
  deliveryFleetLabel: string;
  isPromo: boolean;
  promoDiscountAmount: number;
  productPriceAmount: number;
  priceAfterDiscount: number;
  ppnAmount: number;
  totalAmount: number;
}

function normalizeProductLookupName(raw?: string | null): string {
  const base = String(raw ?? '')
    .split(/\s*(?:\(|—|\[)\s*/)[0]
    .trim()
    .toLowerCase();
  return base;
}

function extractDimensionFromDescription(description?: string | null): string {
  const match = String(description ?? '').match(
    /\((\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?)?)\)/i
  );
  return match ? match[1] : '';
}

function findMatchingCatalogProduct(
  productId: string | null | undefined,
  namaProduk: string | null | undefined,
  catalogProducts: ReadonlyArray<ProductItem>
): ProductItem | undefined {
  const byCode = findCatalogProduct(productId, catalogProducts);
  if (byCode) return byCode;

  const cleanName = normalizeProductLookupName(namaProduk);
  if (!cleanName) return undefined;

  return catalogProducts.find(
    (product) => product.nama.trim().toLowerCase() === cleanName
  );
}

/**
 * Menghitung rincian komponen biaya (Survei, Desain 3D, Pengiriman, Harga Produk,
 * Potongan Promo, Harga Setelah Potongan, dan PPN 11%) secara identik dengan halaman
 * Custom Produk / Produk Detail dengan menjaga total akhir 100% sama persis dengan nominal dokumen.
 */
export function calculateDocumentCostBreakdown(params: {
  items: ReadonlyArray<DocumentCostLineInput>;
  totalAmount: number;
  extraDiscountAmount?: number | null;
  catalogProducts?: ReadonlyArray<ProductItem>;
}): DocumentCostBreakdown | null {
  const totalAmount = Math.max(0, Math.round(Number(params.totalAmount) || 0));
  if (totalAmount <= 0) {
    return null;
  }

  const catalogProducts = params.catalogProducts ?? DEFAULT_CATALOG_PRODUCTS;
  let totalMeasure = 0;
  let totalAreaSqm = 0;
  let maxLengthMeters = 0;
  let catalogPromoDiscount = 0;

  for (const item of params.items) {
    const qty = Math.max(1, Math.round(Number(item.jumlah) || 1));
    const rawUnitPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
    const rawSubtotal =
      typeof item.subtotal === 'number' && Number.isFinite(item.subtotal) && item.subtotal > 0
        ? Math.round(item.subtotal)
        : rawUnitPrice * qty;
    const effectiveUnitPrice = rawUnitPrice > 0 ? rawUnitPrice : Math.round(rawSubtotal / qty);

    const matchedProduct = findMatchingCatalogProduct(
      item.productId,
      item.namaProduk,
      catalogProducts
    );

    const areaPair = extractDimensionAreaPairCm(item.dimensi);
    let lengthMeters = 2;
    let areaSqm = 2;

    if (areaPair) {
      lengthMeters = Math.max(0.1, Math.round((areaPair.lengthCm / 100) * 10000) / 10000);
      areaSqm = Math.max(
        0.01,
        Math.round(((areaPair.lengthCm * areaPair.widthCm) / 10000) * 10000) / 10000
      );
    } else if (effectiveUnitPrice > 0) {
      const approxUnits = Math.max(
        1,
        Math.min(20, Math.round((effectiveUnitPrice / 2_500_000) * 10) / 10)
      );
      lengthMeters = approxUnits;
      areaSqm = approxUnits;
    }

    const itemMeasure = matchedProduct?.meterLari ? lengthMeters : areaSqm;
    totalMeasure += itemMeasure * qty;
    totalAreaSqm += areaSqm * qty;
    maxLengthMeters = Math.max(maxLengthMeters, lengthMeters);

    if (matchedProduct && effectiveUnitPrice > 0) {
      const promoCalc = resolveProductPromoMarkup(effectiveUnitPrice, matchedProduct.promo);
      if (promoCalc.promoActive && promoCalc.markupAmount > 0) {
        catalogPromoDiscount += promoCalc.markupAmount * qty;
      }
    }
  }

  if (totalMeasure <= 0) {
    const approxMeasure = Math.max(
      1,
      Math.min(30, Math.round((totalAmount / 2_500_000) * 10) / 10)
    );
    totalMeasure = approxMeasure;
    totalAreaSqm = approxMeasure;
    maxLengthMeters = Math.max(1.5, Math.min(6, Math.round((approxMeasure / 2) * 10) / 10));
  }

  const survey = calculateIndicativeSurveyFee(totalAmount);
  const design3dFee = calculateIndicativeDesign3dFee({
    measureQuantity: totalMeasure,
    quantity: 1,
  });
  const delivery = calculateIndicativeDeliveryFee({
    areaSquareMeters: totalAreaSqm,
    lengthMeters: maxLengthMeters,
    quantity: 1,
  });

  const extraDiscount = Math.max(0, Math.round(Number(params.extraDiscountAmount) || 0));
  const promoDiscountAmount = catalogPromoDiscount + extraDiscount;

  const { preTaxAmount: priceAfterDiscount, ppnAmount } = extractPreTaxAmount(totalAmount);
  const productPriceAmount = priceAfterDiscount + promoDiscountAmount;

  return {
    surveyFee: survey.amount,
    surveyRatePercent: survey.ratePercent,
    design3dFee,
    deliveryFee: delivery.amount,
    deliveryFleetLabel: delivery.fleetLabel,
    isPromo: promoDiscountAmount > 0,
    promoDiscountAmount,
    productPriceAmount,
    priceAfterDiscount,
    ppnAmount,
    totalAmount,
  };
}

function mapProjectItemsForBreakdown(
  project?: WorkshopProject | null
): DocumentCostLineInput[] {
  if (!project?.daftarProduk?.length) return [];
  return project.daftarProduk.map((item) => ({
    productId: item.id,
    namaProduk: item.namaProduk,
    dimensi: item.dimensi,
    jumlah: item.jumlah,
    hargaSatuan: item.hargaSatuan,
  }));
}

export function buildCostBreakdownFromProject(
  project: WorkshopProject,
  totalAmountOverride?: number,
  catalogProducts: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): DocumentCostBreakdown | null {
  const totalAmount =
    typeof totalAmountOverride === 'number' && Number.isFinite(totalAmountOverride)
      ? totalAmountOverride
      : project.nilaiKontrak;

  return calculateDocumentCostBreakdown({
    items: mapProjectItemsForBreakdown(project),
    totalAmount,
    catalogProducts,
  });
}

export function buildCostBreakdownFromQuotation(
  quo: QuotationDocument,
  linkedProject?: WorkshopProject | null,
  catalogProducts: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): DocumentCostBreakdown | null {
  const grandTotal = quo.daftarItem.reduce(
    (sum, item) => sum + Math.max(1, item.jumlah || 1) * Math.max(0, item.hargaSatuan || 0),
    0
  );
  const projectItems = mapProjectItemsForBreakdown(linkedProject);

  const items: DocumentCostLineInput[] = quo.daftarItem.map((item, idx) => {
    const matchedProjectItem =
      projectItems[idx] ??
      projectItems.find(
        (p) =>
          normalizeProductLookupName(p.namaProduk) ===
          normalizeProductLookupName(item.namaItem)
      );
    return {
      productId: matchedProjectItem?.productId,
      namaProduk: item.namaItem,
      dimensi: item.dimensi || matchedProjectItem?.dimensi,
      jumlah: item.jumlah,
      hargaSatuan: item.hargaSatuan,
    };
  });

  return calculateDocumentCostBreakdown({
    items,
    totalAmount: grandTotal,
    catalogProducts,
  });
}

export function buildCostBreakdownFromAgreement(
  spks: CooperationAgreementDocument,
  linkedProject?: WorkshopProject | null,
  catalogProducts: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): DocumentCostBreakdown | null {
  const projectItems = mapProjectItemsForBreakdown(linkedProject);
  const items: DocumentCostLineInput[] =
    spks.daftarProduk && spks.daftarProduk.length > 0
      ? spks.daftarProduk.map((item, idx) => ({
          productId: projectItems[idx]?.productId ?? item.id,
          namaProduk: item.namaProduk,
          dimensi: item.dimensi,
          jumlah: item.jumlah,
          hargaSatuan: item.hargaSatuan,
          subtotal: item.subtotal,
        }))
      : projectItems;

  return calculateDocumentCostBreakdown({
    items,
    totalAmount: spks.nilaiKontrak || 0,
    catalogProducts,
  });
}

export function buildCostBreakdownFromInvoice(
  invoice: ProjectInvoice,
  linkedProject?: WorkshopProject | null,
  catalogProducts: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): DocumentCostBreakdown | null {
  const projectItems = mapProjectItemsForBreakdown(linkedProject);
  const items: DocumentCostLineInput[] =
    projectItems.length > 0
      ? projectItems
      : (invoice.rincianItem ?? []).map((line) => ({
          namaProduk: line.deskripsi,
          dimensi: extractDimensionFromDescription(line.deskripsi),
          jumlah: line.jumlah,
          hargaSatuan: line.hargaSatuan,
        }));

  return calculateDocumentCostBreakdown({
    items,
    totalAmount: invoice.nilaiTotalKontrak || 0,
    extraDiscountAmount: invoice.nominalDiskon,
    catalogProducts,
  });
}

import customConfiguratorData from '../../../data/konfigurasi-custom-interior.json';
import { resolveCatalogStartingPrice } from '../../../lib/catalog-pricing';
import type { CustomInteriorPricingConfig } from '../../../types/cms';
import type { AvailabilityStatus, ProductDimensions, ProductItem } from '../../../types/product';
import type { CatalogFilterState, CatalogSortOption } from './types';

export const ALL_CATEGORIES_VALUE = 'Semua';

export const SORT_OPTIONS: Array<{ nilai: CatalogSortOption; label: string }> =
  customConfiguratorData.opsiUrutan as Array<{ nilai: CatalogSortOption; label: string }>;

export function extractAvailableCategories(products: ProductItem[]): string[] {
  const unique = new Set<string>();
  for (const product of products) {
    const trimmed = product.kategori.trim();
    if (trimmed) unique.add(trimmed);
  }
  return [ALL_CATEGORIES_VALUE, ...Array.from(unique)];
}

function getEffectivePrice(
  product: ProductItem,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): number | null {
  if (product.statusHarga === 'tetap' && product.harga !== null && product.kaitkanHargaCustom !== true) {
    return product.harga;
  }
  if (product.statusHarga === 'mulai' && product.hargaMulai !== null && product.kaitkanHargaCustom !== true) {
    return product.hargaMulai;
  }
  if (product.kaitkanHargaCustom === false) {
    return null;
  }
  return resolveCatalogStartingPrice(product, siteCustomPricing).numericPrice;
}

export function filterAndSortProducts(
  products: ProductItem[],
  filters: CatalogFilterState,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): ProductItem[] {
  const normalizedQuery = filters.searchQuery.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (
      filters.category !== ALL_CATEGORIES_VALUE &&
      product.kategori.toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      product.nama,
      product.kategori,
      product.deskripsiSingkat,
      ...product.daftarMaterial,
      ...product.pilihanWarna.map((c) => c.nama),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sortBy === 'name-asc') {
      return a.nama.localeCompare(b.nama, 'id');
    }
    if (filters.sortBy === 'name-desc') {
      return b.nama.localeCompare(a.nama, 'id');
    }
    if (filters.sortBy === 'price-asc') {
      const priceA = getEffectivePrice(a, siteCustomPricing);
      const priceB = getEffectivePrice(b, siteCustomPricing);
      if (priceA !== null && priceB !== null) return priceA - priceB;
      if (priceA !== null) return -1;
      if (priceB !== null) return 1;
      return a.urutan - b.urutan;
    }
    if (a.unggulan !== b.unggulan) {
      return a.unggulan ? -1 : 1;
    }
    return a.urutan - b.urutan;
  });

  return sorted;
}

export function getAvailabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'tersedia':
      return 'Tersedia';
    case 'pre-order':
      return 'Pre-order';
    case 'terbatas':
      return 'Stok terbatas';
    case 'konsultasi':
    default:
      return 'Sesuai pesanan & konsultasi';
  }
}

export function formatDimensionsSummary(dimensions: ProductDimensions): string {
  const parts: string[] = [];
  if (dimensions.lebarCm !== null) parts.push(`P ${dimensions.lebarCm} cm`);
  if (dimensions.kedalamanCm !== null) parts.push(`L ${dimensions.kedalamanCm} cm`);
  if (dimensions.tinggiCm !== null) parts.push(`T ${dimensions.tinggiCm} cm`);

  if (parts.length > 0 && dimensions.catatan) {
    return `${parts.join(' × ')} ${dimensions.catatan}`;
  }
  if (parts.length > 0) {
    return parts.join(' × ');
  }
  return dimensions.catatan ?? 'Dimensi dikonfirmasi sesuai kebutuhan ruangan.';
}

function splitCleanSpecList(raw: string): string[] {
  return raw
    .split(/,|\batau\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function deduplicateCaseInsensitive(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function extractDimensionBadges(dimensions: ProductDimensions): string[] {
  const badges: string[] = ['Custom'];

  const numericParts: number[] = [];
  if (dimensions.lebarCm !== null) numericParts.push(dimensions.lebarCm);
  if (dimensions.kedalamanCm !== null) numericParts.push(dimensions.kedalamanCm);
  if (dimensions.tinggiCm !== null) numericParts.push(dimensions.tinggiCm);
  if (numericParts.length > 0) {
    badges.push(`${numericParts.join('×')} cm`);
  }

  for (const preset of dimensions.referensiUkuran ?? []) {
    badges.push(preset);
  }

  return deduplicateCaseInsensitive(badges);
}

export function extractBaseMaterialBadges(product: ProductItem): string[] {
  const bahanOption = product.opsiKustom.find(
    (opt) => /\b(bahan|material)\b/i.test(opt.id) || /\b(bahan|material)\b/i.test(opt.label)
  );
  if (bahanOption && bahanOption.daftarNilai.length > 0) {
    return deduplicateCaseInsensitive(bahanOption.daftarNilai);
  }

  const collected: string[] = [];
  for (const entry of product.daftarMaterial) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (/^(finishing|laminasi)\b/i.test(trimmed)) continue;
    const colonIdx = trimmed.indexOf(':');
    const body =
      colonIdx >= 0 && /^(bahan|material)/i.test(trimmed.slice(0, colonIdx))
        ? trimmed.slice(colonIdx + 1)
        : trimmed;
    collected.push(...splitCleanSpecList(body));
  }
  return deduplicateCaseInsensitive(collected);
}

export function extractFinishingBadges(product: ProductItem): string[] {
  const finishingOption = product.opsiKustom.find(
    (opt) =>
      /\bfinishing\b|\blaminasi\b/i.test(opt.id) ||
      /\bfinishing\b|\blaminasi\b/i.test(opt.label)
  );
  if (finishingOption && finishingOption.daftarNilai.length > 0) {
    return deduplicateCaseInsensitive(finishingOption.daftarNilai);
  }

  const collected: string[] = [];
  for (const entry of product.daftarMaterial) {
    const trimmed = entry.trim();
    if (!/^(finishing|laminasi)\b/i.test(trimmed)) continue;
    const colonIdx = trimmed.indexOf(':');
    const body = colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : trimmed;
    collected.push(...splitCleanSpecList(body));
  }
  return deduplicateCaseInsensitive(collected);
}

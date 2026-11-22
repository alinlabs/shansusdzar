import {
  getAvailableFinishLabelsFromTariff,
  getAvailableMaterialLabelsFromTariff,
  resolveCatalogStartingPrice,
} from '../../../lib/catalog-pricing';
import { parseReferenceSizeCm } from '../../../lib/product-catalog';
import type { CustomInteriorPricingConfig } from '../../../types/cms';
import type { ProductItem } from '../../../types/product';
import type { CatalogFilterState, CatalogSortOption } from './types';

export const ALL_CATEGORIES_VALUE = 'Semua';

export const SORT_OPTIONS: Array<{ nilai: CatalogSortOption; label: string }> = [
  { nilai: 'featured', label: 'Urutan Koleksi' },
  { nilai: 'name-asc', label: 'Nama: A - Z' },
  { nilai: 'name-desc', label: 'Nama: Z - A' },
  { nilai: 'price-asc', label: 'Harga: Terendah' },
];

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
): number {
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
      ...product.referensiUkuran,
      ...extractBaseMaterialBadges(product),
      ...extractFinishingBadges(product),
      ...product.customisasi,
      ...product.include,
      ...(product.pilihanWarna ?? []).map((c) => c.nama),
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
      return getEffectivePrice(a, siteCustomPricing) - getEffectivePrice(b, siteCustomPricing);
    }
    return 0;
  });

  return sorted;
}

export function formatDimensionsSummary(referensiUkuran: string | readonly string[]): string {
  const list = Array.isArray(referensiUkuran) ? referensiUkuran : [referensiUkuran];
  const formatted = list
    .map((entry) => {
      const parsed = parseReferenceSizeCm(entry);
      if (parsed) return `P ${parsed.lengthCm} cm × L ${parsed.widthCm} cm`;
      const trimmed = String(entry ?? '').trim();
      return trimmed ? `${trimmed} cm` : null;
    })
    .filter((entry): entry is string => entry !== null);

  return formatted.length > 0
    ? formatted.join(' · ')
    : 'Dimensi dikonfirmasi sesuai kebutuhan ruangan.';
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

export function extractDimensionBadges(referensiUkuran: string | readonly string[]): string[] {
  const badges: string[] = ['Custom'];
  const list = Array.isArray(referensiUkuran) ? referensiUkuran : [referensiUkuran];
  for (const entry of list) {
    const parsed = parseReferenceSizeCm(entry);
    if (parsed) {
      badges.push(`${parsed.lengthCm}×${parsed.widthCm} cm`);
    } else if (String(entry ?? '').trim()) {
      badges.push(`${String(entry).trim()} cm`);
    }
  }
  return deduplicateCaseInsensitive(badges);
}

export function extractBaseMaterialBadges(product: ProductItem): string[] {
  return deduplicateCaseInsensitive(getAvailableMaterialLabelsFromTariff(product));
}

export function extractFinishingBadges(product: ProductItem): string[] {
  return deduplicateCaseInsensitive(getAvailableFinishLabelsFromTariff(product));
}

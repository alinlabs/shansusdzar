export type CatalogMode = 'furniture' | 'custom';

export type CatalogSortOption = 'featured' | 'name-asc' | 'name-desc' | 'price-asc';

export interface CatalogFilterState {
  searchQuery: string;
  category: string;
  sortBy: CatalogSortOption;
}

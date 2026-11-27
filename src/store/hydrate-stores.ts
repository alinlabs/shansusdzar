import { bootstrapLocalCache } from '../lib/indexeddb-storage';
import { useAdminAuthStore } from './admin-auth-store';
import { useAnalyticsStore } from './analytics-store';
import { useCartStore } from './cart-store';
import { useDocumentsStore } from './documents-store';
import { useFinanceStore } from './finance-store';
import { useMarketingStore } from './marketing-store';
import { useProjectsStore } from './projects-store';
import { usePublicPreferencesStore } from './public-preferences-store';
import { useSiteContentStore } from './site-content-store';
import { useUserProfileStore } from './user-profile-store';

export function reloadAllStoresFromLocalCache(): void {
  useSiteContentStore.getState().reloadFromStorage();
  useProjectsStore.getState().reloadFromStorage();
  useFinanceStore.getState().reloadFromStorage();
  useDocumentsStore.getState().reloadFromStorage();
  useMarketingStore.getState().reloadFromStorage();
  useAdminAuthStore.getState().reloadFromStorage();
  useAnalyticsStore.getState().reloadFromStorage();
  useCartStore.getState().reloadFromStorage();
  useUserProfileStore.getState().reloadFromStorage();
  usePublicPreferencesStore.getState().reloadFromStorage();
}

export async function hydrateAllStoresFromIndexedDb(options?: {
  timeoutMs?: number;
}): Promise<void> {
  try {
    await bootstrapLocalCache(options);
  } catch {
    // Fallback to initial in-memory / localStorage snapshot
  }
  reloadAllStoresFromLocalCache();
}

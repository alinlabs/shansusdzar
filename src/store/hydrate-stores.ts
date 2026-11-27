import { bootstrapLocalCache, reloadRegisteredStores } from '../lib/indexeddb-storage';
import { useAnalyticsStore } from './analytics-store';
import { useCartStore } from './cart-store';
import { usePublicPreferencesStore } from './public-preferences-store';
import { useSiteContentStore } from './site-content-store';
import { useUserProfileStore } from './user-profile-store';

export function reloadAllStoresFromLocalCache(): void {
  // Core public stores are always registered and reloaded, alongside any lazy-loaded admin stores
  useSiteContentStore.getState().reloadFromStorage();
  useAnalyticsStore.getState().reloadFromStorage();
  useCartStore.getState().reloadFromStorage();
  useUserProfileStore.getState().reloadFromStorage();
  usePublicPreferencesStore.getState().reloadFromStorage();
  reloadRegisteredStores();
}

export async function hydrateAllStoresFromIndexedDb(options?: {
  timeoutMs?: number;
}): Promise<void> {
  let hydratedSettled = false;
  try {
    await bootstrapLocalCache({
      ...options,
      onHydrated: () => {
        hydratedSettled = true;
        reloadAllStoresFromLocalCache();
      },
    });
  } catch {
    // Fallback to initial in-memory / localStorage snapshot
  }
  if (!hydratedSettled) {
    reloadAllStoresFromLocalCache();
  }
}

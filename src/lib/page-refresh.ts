import { create } from 'zustand';
import { checkForNewBuildAndReload } from './app-version';
import { reloadRegisteredStores } from './indexeddb-storage';
import { useAnalyticsStore } from '../store/analytics-store';
import { useCartStore } from '../store/cart-store';
import { usePublicPreferencesStore } from '../store/public-preferences-store';
import { useSiteContentStore } from '../store/site-content-store';
import { useUserProfileStore } from '../store/user-profile-store';

export const PAGE_REFRESH_EVENT = 'shansusdzar:page-refresh';

interface PageRefreshStoreState {
  epoch: number;
  lastRefreshedAt: number | null;
  bumpEpoch: () => number;
}

export const usePageRefreshStore = create<PageRefreshStoreState>((set, get) => ({
  epoch: 0,
  lastRefreshedAt: null,
  bumpEpoch: () => {
    const next = get().epoch + 1;
    set({ epoch: next, lastRefreshedAt: Date.now() });
    return next;
  },
}));

export function reloadAllAppStores(): void {
  useSiteContentStore.getState().reloadFromStorage();
  void useSiteContentStore.getState().ensureBaseCatalogLoaded(true);
  useAnalyticsStore.getState().reloadFromStorage();
  useCartStore.getState().reloadFromStorage();
  useUserProfileStore.getState().reloadFromStorage();
  usePublicPreferencesStore.getState().reloadFromStorage();
  reloadRegisteredStores();
}

export async function executeInPlacePageRefresh(pathname?: string): Promise<number> {
  const startedAt = Date.now();
  reloadAllAppStores();

  const nextEpoch = usePageRefreshStore.getState().bumpEpoch();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PAGE_REFRESH_EVENT, {
        detail: {
          epoch: nextEpoch,
          pathname: pathname ?? window.location.pathname,
        },
      })
    );

    void checkForNewBuildAndReload({
      force: true,
      onNewBuildDetected: () => {
        window.location.reload();
      },
    });
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        void registration.update().catch(() => {});
      }
    } catch {
      // Ignore service worker check errors in restricted preview contexts
    }
  }

  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, 420 - elapsed);
  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }

  return nextEpoch;
}

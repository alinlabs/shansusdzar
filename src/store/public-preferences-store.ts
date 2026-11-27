import { create } from 'zustand';
import {
  readLocalCacheItem,
  registerStoreReloadHandler,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';

export const PUBLIC_PREFERENCES_STORAGE_KEY = 'shansusdzar-public-preferences-v1';
export const PUBLIC_PREFERENCES_SCHEMA_VERSION = 1;

export type PreferredLanguage = 'id' | 'en';

export interface NavigationPreferences {
  showBottomNav: boolean;
  showBottomNavLabels: boolean;
  showFooter: boolean;
  showFooterMobile: boolean;
  autoScrollToTop: boolean;
  showFloatingScrollbar: boolean;
  showInstallBanner: boolean;
}

export interface NotificationPreferences {
  promoAndCatalog: boolean;
  orderAndSurveyReminder: boolean;
  articlesAndTips: boolean;
}

export interface PublicPreferencesData {
  navigation: NavigationPreferences;
  preferredLanguage: PreferredLanguage;
  notifications: NotificationPreferences;
}

export const DEFAULT_PUBLIC_PREFERENCES: PublicPreferencesData = {
  navigation: {
    showBottomNav: true,
    showBottomNavLabels: true,
    showFooter: true,
    showFooterMobile: false,
    autoScrollToTop: true,
    showFloatingScrollbar: true,
    showInstallBanner: true,
  },
  preferredLanguage: 'id',
  notifications: {
    promoAndCatalog: false,
    orderAndSurveyReminder: false,
    articlesAndTips: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizePublicPreferences(raw: unknown): PublicPreferencesData {
  if (!isRecord(raw)) return structuredClone(DEFAULT_PUBLIC_PREFERENCES);

  const navRaw = isRecord(raw.navigation) ? raw.navigation : {};
  const notifRaw = isRecord(raw.notifications) ? raw.notifications : {};

  return {
    navigation: {
      showBottomNav:
        typeof navRaw.showBottomNav === 'boolean'
          ? navRaw.showBottomNav
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showBottomNav,
      showBottomNavLabels:
        typeof navRaw.showBottomNavLabels === 'boolean'
          ? navRaw.showBottomNavLabels
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showBottomNavLabels,
      showFooter:
        typeof navRaw.showFooter === 'boolean'
          ? navRaw.showFooter
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showFooter,
      showFooterMobile:
        typeof navRaw.showFooterMobile === 'boolean'
          ? navRaw.showFooterMobile
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showFooterMobile,
      autoScrollToTop:
        typeof navRaw.autoScrollToTop === 'boolean'
          ? navRaw.autoScrollToTop
          : DEFAULT_PUBLIC_PREFERENCES.navigation.autoScrollToTop,
      showFloatingScrollbar:
        typeof navRaw.showFloatingScrollbar === 'boolean'
          ? navRaw.showFloatingScrollbar
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showFloatingScrollbar,
      showInstallBanner:
        typeof navRaw.showInstallBanner === 'boolean'
          ? navRaw.showInstallBanner
          : DEFAULT_PUBLIC_PREFERENCES.navigation.showInstallBanner,
    },
    preferredLanguage: raw.preferredLanguage === 'en' ? 'en' : 'id',
    notifications: {
      promoAndCatalog:
        typeof notifRaw.promoAndCatalog === 'boolean'
          ? notifRaw.promoAndCatalog
          : DEFAULT_PUBLIC_PREFERENCES.notifications.promoAndCatalog,
      orderAndSurveyReminder:
        typeof notifRaw.orderAndSurveyReminder === 'boolean'
          ? notifRaw.orderAndSurveyReminder
          : DEFAULT_PUBLIC_PREFERENCES.notifications.orderAndSurveyReminder,
      articlesAndTips:
        typeof notifRaw.articlesAndTips === 'boolean'
          ? notifRaw.articlesAndTips
          : DEFAULT_PUBLIC_PREFERENCES.notifications.articlesAndTips,
    },
  };
}

function loadPersistedPublicPreferences(): PublicPreferencesData {
  if (typeof window === 'undefined') {
    return structuredClone(DEFAULT_PUBLIC_PREFERENCES);
  }
  try {
    const raw = readLocalCacheItem(PUBLIC_PREFERENCES_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PUBLIC_PREFERENCES);
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== PUBLIC_PREFERENCES_SCHEMA_VERSION) {
      return structuredClone(DEFAULT_PUBLIC_PREFERENCES);
    }
    return sanitizePublicPreferences(parsed.data);
  } catch {
    return structuredClone(DEFAULT_PUBLIC_PREFERENCES);
  }
}

function savePersistedPublicPreferences(data: PublicPreferencesData): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(
      PUBLIC_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: PUBLIC_PREFERENCES_SCHEMA_VERSION,
        data,
      })
    );
  } catch {
    // Abaikan kegagalan penyimpanan
  }
}

interface PublicPreferencesStoreState extends PublicPreferencesData {
  setNavigationPreference: <K extends keyof NavigationPreferences>(
    key: K,
    value: NavigationPreferences[K]
  ) => void;
  setPreferredLanguage: (language: PreferredLanguage) => void;
  setNotificationPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => void;
  reloadFromStorage: () => void;
  resetPublicPreferences: () => void;
}

const initialPreferences = loadPersistedPublicPreferences();

export const usePublicPreferencesStore = create<PublicPreferencesStoreState>((set) => ({
  ...initialPreferences,
  setNavigationPreference: (key, value) =>
    set((state) => {
      const nextData: PublicPreferencesData = {
        navigation: {
          ...state.navigation,
          [key]: value,
        },
        preferredLanguage: state.preferredLanguage,
        notifications: state.notifications,
      };
      savePersistedPublicPreferences(nextData);
      return nextData;
    }),
  setPreferredLanguage: (language) =>
    set((state) => {
      const nextData: PublicPreferencesData = {
        navigation: state.navigation,
        preferredLanguage: language,
        notifications: state.notifications,
      };
      savePersistedPublicPreferences(nextData);
      return nextData;
    }),
  setNotificationPreference: (key, value) =>
    set((state) => {
      const nextData: PublicPreferencesData = {
        navigation: state.navigation,
        preferredLanguage: state.preferredLanguage,
        notifications: {
          ...state.notifications,
          [key]: value,
        },
      };
      savePersistedPublicPreferences(nextData);
      return nextData;
    }),
  reloadFromStorage: () => set(loadPersistedPublicPreferences()),
  resetPublicPreferences: () =>
    set(() => {
      const nextData = structuredClone(DEFAULT_PUBLIC_PREFERENCES);
      savePersistedPublicPreferences(nextData);
      return nextData;
    }),
}));

registerStoreReloadHandler(() => {
  usePublicPreferencesStore.getState().reloadFromStorage();
});

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(PUBLIC_PREFERENCES_STORAGE_KEY, () => {
    usePublicPreferencesStore.setState(loadPersistedPublicPreferences());
  });
}

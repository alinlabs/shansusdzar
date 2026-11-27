import { useCallback, useEffect, useState } from 'react';
import {
  detectIOSDevice,
  getPwaAppConfig,
  INSTALL_PROMPT_AUTO_HIDE_MS,
  INSTALL_PROMPT_DWELL_MS,
  isAdminAppPath,
  isStandaloneDisplayMode,
  loadInstallBannerRecord,
  type PwaAppContext,
  resolvePwaAppContext,
  saveInstallBannerRecord,
  shouldShowInstallPromptCard,
  STANDALONE_DISPLAY_MODE_QUERIES,
  syncDocumentPwaManifest,
} from '../lib/app-install';
import { usePublicPreferencesStore } from '../store/public-preferences-store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __SHANSUSDZAR_BOOT_APP_CONTEXT__?: PwaAppContext;
  }
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
let deferredPromptContext: PwaAppContext | null = null;
let guideOpenGlobal = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

function resolveBootContext(): PwaAppContext {
  if (typeof window === 'undefined') return 'public';
  if (
    window.__SHANSUSDZAR_BOOT_APP_CONTEXT__ === 'public' ||
    window.__SHANSUSDZAR_BOOT_APP_CONTEXT__ === 'admin'
  ) {
    return window.__SHANSUSDZAR_BOOT_APP_CONTEXT__;
  }
  return resolvePwaAppContext(window.location.pathname);
}

export function initAppInstallListener(): void {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPromptGlobal = event as BeforeInstallPromptEvent;
    deferredPromptContext = resolveBootContext();
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    const installedContext = deferredPromptContext ?? resolveBootContext();
    deferredPromptGlobal = null;
    deferredPromptContext = null;
    guideOpenGlobal = false;
    const prev = loadInstallBannerRecord(window.localStorage, installedContext);
    saveInstallBannerRecord(
      window.localStorage,
      {
        ...prev,
        installedAt: Date.now(),
      },
      installedContext
    );
    notifySubscribers();
  });
}

export function checkStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return isStandaloneDisplayMode({
    matchMedia:
      typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined,
    navigatorStandalone: (window.navigator as unknown as { standalone?: boolean }).standalone,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
}

function checkContextInstalled(appContext: PwaAppContext): boolean {
  if (typeof window === 'undefined') return false;
  return loadInstallBannerRecord(window.localStorage, appContext).installedAt !== null;
}

export function useAppInstall(pathname: string) {
  const appContext = resolvePwaAppContext(pathname);
  const appConfig = getPwaAppConfig(appContext);

  const hasMatchingNativePrompt = useCallback(
    () => Boolean(deferredPromptGlobal && deferredPromptContext === appContext),
    [appContext]
  );

  const [hasNativePrompt, setHasNativePrompt] = useState(hasMatchingNativePrompt);
  const [isStandalone, setIsStandalone] = useState(() => checkStandaloneMode());
  const [isInstalled, setIsInstalled] = useState(() => checkContextInstalled(appContext));
  const [isIOS] = useState(() =>
    typeof window !== 'undefined' ? detectIOSDevice(window.navigator.userAgent) : false
  );
  const [dwellElapsed, setDwellElapsed] = useState(false);
  const [autoHidden, setAutoHidden] = useState(false);
  const [dismissedInView, setDismissedInView] = useState(false);
  const [isDismissChoiceOpen, setIsDismissChoiceOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpenState] = useState(() => guideOpenGlobal);

  const setIsGuideOpen = useCallback((next: boolean) => {
    guideOpenGlobal = next;
    setIsGuideOpenState(next);
    notifySubscribers();
  }, []);

  useEffect(() => {
    initAppInstallListener();
    syncDocumentPwaManifest(pathname);

    const sync = () => {
      setHasNativePrompt(hasMatchingNativePrompt());
      setIsStandalone(checkStandaloneMode());
      setIsInstalled(checkContextInstalled(appContext));
      setIsGuideOpenState(guideOpenGlobal);
    };
    subscribers.add(sync);
    sync();

    const mediaQueries =
      typeof window.matchMedia === 'function'
        ? STANDALONE_DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query))
        : [];
    const handleDisplayModeChange = () => {
      setIsStandalone(checkStandaloneMode());
    };
    for (const mq of mediaQueries) {
      mq.addEventListener('change', handleDisplayModeChange);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === appConfig.storageKey || event.key === null) {
        sync();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      subscribers.delete(sync);
      for (const mq of mediaQueries) {
        mq.removeEventListener('change', handleDisplayModeChange);
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [pathname, appContext, appConfig.storageKey, hasMatchingNativePrompt]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDwellElapsed(true);
    }, INSTALL_PROMPT_DWELL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const showInstallBannerPref = usePublicPreferencesStore(
    (state) => state.navigation.showInstallBanner
  );
  const isAdminRoute = isAdminAppPath(pathname);
  const record =
    typeof window !== 'undefined'
      ? loadInstallBannerRecord(window.localStorage, appContext)
      : { dismissedAt: null, dismissCount: 0, installedAt: null, neverShowAgain: false };

  const isEligible =
    showInstallBannerPref &&
    shouldShowInstallPromptCard({
      isStandalone,
      isAdminRoute,
      hasNativePrompt,
      isIOS,
      record,
      now: Date.now(),
    });

  const showBanner = isEligible && dwellElapsed && !autoHidden && !dismissedInView;

  // Tampil hanya beberapa saat saja lalu menutup otomatis bila tidak berinteraksi
  useEffect(() => {
    if (!showBanner || isDismissChoiceOpen || isGuideOpen) return;

    const timer = window.setTimeout(() => {
      setAutoHidden(true);
    }, INSTALL_PROMPT_AUTO_HIDE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showBanner, isDismissChoiceOpen, isGuideOpen]);

  const dismissTemporarily = useCallback(() => {
    setDismissedInView(true);
    setIsDismissChoiceOpen(false);
    if (typeof window !== 'undefined') {
      const prev = loadInstallBannerRecord(window.localStorage, appContext);
      saveInstallBannerRecord(
        window.localStorage,
        {
          ...prev,
          dismissedAt: Date.now(),
          dismissCount: prev.dismissCount + 1,
        },
        appContext
      );
    }
  }, [appContext]);

  const dismissPermanently = useCallback(() => {
    setDismissedInView(true);
    setIsDismissChoiceOpen(false);
    if (typeof window !== 'undefined') {
      const prev = loadInstallBannerRecord(window.localStorage, appContext);
      saveInstallBannerRecord(
        window.localStorage,
        {
          ...prev,
          dismissedAt: Date.now(),
          dismissCount: prev.dismissCount + 1,
          neverShowAgain: true,
        },
        appContext
      );
    }
  }, [appContext]);

  const openDismissOptions = useCallback(() => {
    setIsDismissChoiceOpen(true);
  }, []);

  const triggerInstall = useCallback(async () => {
    setIsDismissChoiceOpen(false);
    if (deferredPromptGlobal && deferredPromptContext === appContext) {
      const promptEvent = deferredPromptGlobal;
      deferredPromptGlobal = null;
      deferredPromptContext = null;
      setHasNativePrompt(false);

      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          if (typeof window !== 'undefined') {
            const prev = loadInstallBannerRecord(window.localStorage, appContext);
            saveInstallBannerRecord(
              window.localStorage,
              {
                ...prev,
                installedAt: Date.now(),
              },
              appContext
            );
          }
          setIsInstalled(true);
          guideOpenGlobal = false;
          setIsGuideOpenState(false);
          setDismissedInView(true);
          notifySubscribers();
          return;
        }
      } catch {
        // Fall through to temporary dismissal or guide if aborted
      }
      if (!isAdminRoute) {
        dismissTemporarily();
      }
      return;
    }

    setDismissedInView(true);
    setIsGuideOpen(true);
  }, [appContext, isAdminRoute, dismissTemporarily, setIsGuideOpen]);

  return {
    appContext,
    appConfig,
    showBanner,
    isIOS,
    isStandalone,
    isInstalled,
    hasNativePrompt,
    openDismissOptions,
    dismissTemporarily,
    dismissPermanently,
    triggerInstall,
    isDismissChoiceOpen,
    setIsDismissChoiceOpen,
    isGuideOpen,
    setIsGuideOpen,
  };
}

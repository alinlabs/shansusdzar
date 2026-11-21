import { useCallback, useEffect, useState } from 'react';
import {
  detectIOSDevice,
  INSTALL_PROMPT_AUTO_HIDE_MS,
  INSTALL_PROMPT_DWELL_MS,
  loadInstallBannerRecord,
  saveInstallBannerRecord,
  shouldShowInstallPromptCard,
} from '../lib/app-install';
import { usePublicPreferencesStore } from '../store/public-preferences-store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

export function initAppInstallListener(): void {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPromptGlobal = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null;
    const prev = loadInstallBannerRecord(window.localStorage);
    saveInstallBannerRecord(window.localStorage, {
      ...prev,
      installedAt: Date.now(),
    });
    notifySubscribers();
  });
}

function checkStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function useAppInstall(pathname: string) {
  const [hasNativePrompt, setHasNativePrompt] = useState(() => Boolean(deferredPromptGlobal));
  const [isStandalone, setIsStandalone] = useState(() => checkStandaloneMode());
  const [isIOS] = useState(() =>
    typeof window !== 'undefined' ? detectIOSDevice(window.navigator.userAgent) : false
  );
  const [dwellElapsed, setDwellElapsed] = useState(false);
  const [autoHidden, setAutoHidden] = useState(false);
  const [dismissedInView, setDismissedInView] = useState(false);
  const [isDismissChoiceOpen, setIsDismissChoiceOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    initAppInstallListener();

    const sync = () => {
      setHasNativePrompt(Boolean(deferredPromptGlobal));
      setIsStandalone(checkStandaloneMode());
    };
    subscribers.add(sync);
    sync();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsStandalone(checkStandaloneMode());
    };
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      subscribers.delete(sync);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

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
  const isAdminRoute = pathname.startsWith('/admin');
  const record =
    typeof window !== 'undefined'
      ? loadInstallBannerRecord(window.localStorage)
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
      const prev = loadInstallBannerRecord(window.localStorage);
      saveInstallBannerRecord(window.localStorage, {
        ...prev,
        dismissedAt: Date.now(),
        dismissCount: prev.dismissCount + 1,
      });
    }
  }, []);

  const dismissPermanently = useCallback(() => {
    setDismissedInView(true);
    setIsDismissChoiceOpen(false);
    if (typeof window !== 'undefined') {
      const prev = loadInstallBannerRecord(window.localStorage);
      saveInstallBannerRecord(window.localStorage, {
        ...prev,
        dismissedAt: Date.now(),
        dismissCount: prev.dismissCount + 1,
        neverShowAgain: true,
      });
    }
  }, []);

  const openDismissOptions = useCallback(() => {
    setIsDismissChoiceOpen(true);
  }, []);

  const triggerInstall = useCallback(async () => {
    setIsDismissChoiceOpen(false);
    if (deferredPromptGlobal) {
      const promptEvent = deferredPromptGlobal;
      deferredPromptGlobal = null;
      setHasNativePrompt(false);

      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          if (typeof window !== 'undefined') {
            const prev = loadInstallBannerRecord(window.localStorage);
            saveInstallBannerRecord(window.localStorage, {
              ...prev,
              installedAt: Date.now(),
            });
          }
          setIsStandalone(true);
          setDismissedInView(true);
          return;
        }
      } catch {
        // Fall through to temporary dismissal if aborted
      }
      dismissTemporarily();
      return;
    }

    setDismissedInView(true);
    setIsGuideOpen(true);
  }, [dismissTemporarily]);

  return {
    showBanner,
    isIOS,
    isStandalone,
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

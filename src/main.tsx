import './lib/storage-cleanup';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './app/App.tsx';
import {checkForNewBuildAndReload} from './lib/app-version';
import {warmBrandMediaCache} from './lib/media-cache';
import {initAppInstallListener} from './hooks/use-app-install';
import {shouldTriggerDeployReload} from './lib/theme-preference';
import {hydrateAllStoresFromIndexedDb} from './store/hydrate-stores';
import './index.css';

const DEPLOY_RELOAD_TIMESTAMP_KEY = 'shansusdzar-deploy-reload-at';

function triggerSafeDeployReload(hadController: boolean, state: {isReloading: boolean}) {
  let lastReloadAt: number | null = null;
  try {
    const raw = window.sessionStorage.getItem(DEPLOY_RELOAD_TIMESTAMP_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) lastReloadAt = parsed;
    }
  } catch {
    // Ignore storage errors
  }

  const now = Date.now();
  if (
    !shouldTriggerDeployReload({
      hadController,
      isReloading: state.isReloading,
      lastReloadAt,
      now,
    })
  ) {
    return;
  }

  state.isReloading = true;
  try {
    window.sessionStorage.setItem(DEPLOY_RELOAD_TIMESTAMP_KEY, String(now));
  } catch {
    // Ignore storage errors
  }
  window.location.reload();
}

if (typeof window !== 'undefined') {
  initAppInstallListener();
  warmBrandMediaCache();

  const reloadState = {isReloading: false};
  const checkDeployVersion = (force = false) => {
    void checkForNewBuildAndReload({
      force,
      onNewBuildDetected: () => {
        triggerSafeDeployReload(true, reloadState);
      },
    });
  };

  // Recover automatically if an open tab requests a lazy-loaded chunk replaced by a newer deploy
  window.addEventListener('vite:preloadError', () => {
    triggerSafeDeployReload(true, reloadState);
  });

  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => checkDeployVersion(true), {timeout: 2000});
    } else {
      window.setTimeout(() => checkDeployVersion(true), 600);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkDeployVersion(false);
    }
  });

  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      triggerSafeDeployReload(hadController, reloadState);
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', {updateViaCache: 'none'})
        .then((registration) => {
          void registration.update().catch(() => {});

          if (registration.waiting) {
            registration.waiting.postMessage({type: 'SKIP_WAITING'});
          }

          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({type: 'SKIP_WAITING'});
              }
            });
          });

          let lastCheckAt = Date.now();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastCheckAt < 30_000) return;
            lastCheckAt = now;
            void registration.update().catch(() => {});
          });
        })
        .catch(() => {
          // Ignore SW registration errors in restricted preview contexts
        });
    });
  }
}

async function mountApp() {
  try {
    await hydrateAllStoresFromIndexedDb({timeoutMs: 200});
  } finally {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

void mountApp();

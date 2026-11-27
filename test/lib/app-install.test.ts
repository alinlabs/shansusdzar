import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_INSTALL_STORAGE_KEY,
  buildInstallGuideSteps,
  detectIOSDevice,
  getPwaAppConfig,
  INSTALL_BANNER_STORAGE_KEY,
  INSTALL_PROMPT_COOLDOWN_MS,
  isAdminAppPath,
  isStandaloneDisplayMode,
  loadInstallBannerRecord,
  resolvePwaAppContext,
  saveInstallBannerRecord,
  shouldReloadForManifestBoundary,
  shouldShowAdminSidebarInstallAction,
  shouldShowInstallPromptCard,
  shouldShowManualInstallAction,
} from '../../src/lib/app-install';

test('isAdminAppPath and resolvePwaAppContext distinguish public and admin routes accurately', () => {
  assert.equal(isAdminAppPath('/'), false);
  assert.equal(isAdminAppPath('/produk'), false);
  assert.equal(isAdminAppPath('/admin-panel'), false);
  assert.equal(isAdminAppPath('/admin'), true);
  assert.equal(isAdminAppPath('/admin/'), true);
  assert.equal(isAdminAppPath('/admin/login'), true);
  assert.equal(isAdminAppPath('/admin/proyek/123?tab=dokumen'), true);

  assert.equal(resolvePwaAppContext('/'), 'public');
  assert.equal(resolvePwaAppContext('/admin/proyek'), 'admin');
});

test('getPwaAppConfig keeps SDI Furniture and SDI Admin completely separated', () => {
  const pub = getPwaAppConfig('public');
  const adm = getPwaAppConfig('admin');

  assert.equal(pub.appName, 'SDI Furniture');
  assert.equal(pub.shortName, 'SDI Furniture');
  assert.equal(pub.manifestPath, '/manifest.webmanifest');
  assert.equal(pub.startUrl, '/');
  assert.equal(pub.scope, '/');
  assert.equal(pub.storageKey, INSTALL_BANNER_STORAGE_KEY);

  assert.equal(adm.appName, 'SDI Admin');
  assert.equal(adm.shortName, 'SDI Admin');
  assert.equal(adm.manifestPath, '/manifest-admin.webmanifest');
  assert.equal(adm.startUrl, '/admin');
  assert.equal(adm.scope, '/');
  assert.equal(adm.storageKey, ADMIN_INSTALL_STORAGE_KEY);
});

test('shouldReloadForManifestBoundary triggers only in non-standalone browser when crossing public/admin', () => {
  assert.equal(
    shouldReloadForManifestBoundary({
      bootContext: 'public',
      pathname: '/admin/login',
      isStandalone: false,
    }),
    true
  );
  assert.equal(
    shouldReloadForManifestBoundary({
      bootContext: 'admin',
      pathname: '/',
      isStandalone: false,
    }),
    true
  );
  assert.equal(
    shouldReloadForManifestBoundary({
      bootContext: 'admin',
      pathname: '/admin/proyek',
      isStandalone: false,
    }),
    false
  );
  assert.equal(
    shouldReloadForManifestBoundary({
      bootContext: 'admin',
      pathname: '/',
      isStandalone: true,
    }),
    false
  );
  assert.equal(
    shouldReloadForManifestBoundary({
      bootContext: undefined,
      pathname: '/admin',
      isStandalone: false,
    }),
    false
  );
});

test('loadInstallBannerRecord and saveInstallBannerRecord isolate public and admin states', () => {
  const map = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;

  saveInstallBannerRecord(
    mockStorage,
    { dismissedAt: 100, dismissCount: 1, installedAt: 200, neverShowAgain: false },
    'public'
  );

  const pubRecord = loadInstallBannerRecord(mockStorage, 'public');
  const admRecord = loadInstallBannerRecord(mockStorage, 'admin');

  assert.equal(pubRecord.installedAt, 200);
  assert.equal(admRecord.installedAt, null);
  assert.equal(admRecord.dismissCount, 0);
});

test('shouldShowInstallPromptCard suppresses prompt in standalone or admin mode', () => {
  const base = {
    hasNativePrompt: true,
    isIOS: false,
    record: { dismissedAt: null, dismissCount: 0, installedAt: null, neverShowAgain: false },
    now: 1_000_000,
  };

  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: true, isAdminRoute: false }),
    false
  );
  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: false, isAdminRoute: true }),
    false
  );
  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: false, isAdminRoute: false }),
    true
  );
});

test('shouldShowInstallPromptCard respects temporary dismissal cooldown and re-enables periodically', () => {
  const dismissedAt = 10_000;
  const record = { dismissedAt, dismissCount: 1, installedAt: null, neverShowAgain: false };

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: false,
      isIOS: false,
      record,
      now: dismissedAt + INSTALL_PROMPT_COOLDOWN_MS - 1000,
    }),
    false
  );

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: false,
      isIOS: false,
      record,
      now: dismissedAt + INSTALL_PROMPT_COOLDOWN_MS + 1000,
    }),
    true
  );
});

test('shouldShowInstallPromptCard suppresses forever once installed or neverShowAgain is chosen', () => {
  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: true,
      isIOS: false,
      record: { dismissedAt: null, dismissCount: 0, installedAt: 5000, neverShowAgain: false },
      now: 5000 + INSTALL_PROMPT_COOLDOWN_MS * 10,
    }),
    false
  );

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: true,
      isIOS: false,
      record: { dismissedAt: 5000, dismissCount: 1, installedAt: null, neverShowAgain: true },
      now: 5000 + INSTALL_PROMPT_COOLDOWN_MS * 10,
    }),
    false
  );
});

test('detectIOSDevice and buildInstallGuideSteps avoid PWA terminology cleanly and include app name', () => {
  assert.equal(detectIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), true);
  assert.equal(detectIOSDevice('Mozilla/5.0 (Linux; Android 14)'), false);

  const iosGuide = buildInstallGuideSteps(true, 'SDI Admin');
  const desktopGuide = buildInstallGuideSteps(false, 'SDI Furniture');
  const combined = `${iosGuide.title} ${iosGuide.steps.join(' ')} ${desktopGuide.title} ${desktopGuide.steps.join(' ')}`;

  assert.equal(/\bpwa\b/i.test(combined), false);
  assert.equal(iosGuide.title.includes('SDI Admin'), true);
  assert.equal(desktopGuide.title.includes('SDI Furniture'), true);
});

test('shouldShowManualInstallAction and shouldShowAdminSidebarInstallAction enforce standalone and installed hiding', () => {
  assert.equal(
    shouldShowManualInstallAction({ isStandalone: false, isInstalled: false, isAdminRoute: false }),
    true
  );
  assert.equal(
    shouldShowManualInstallAction({ isStandalone: true, isInstalled: false, isAdminRoute: false }),
    false
  );
  assert.equal(
    shouldShowManualInstallAction({ isStandalone: false, isInstalled: true, isAdminRoute: false }),
    false
  );
  assert.equal(
    shouldShowManualInstallAction({ isStandalone: false, isInstalled: false, isAdminRoute: true }),
    false
  );

  assert.equal(shouldShowAdminSidebarInstallAction({ isStandalone: false, isInstalled: false }), true);
  assert.equal(shouldShowAdminSidebarInstallAction({ isStandalone: true, isInstalled: false }), false);
  assert.equal(shouldShowAdminSidebarInstallAction({ isStandalone: false, isInstalled: true }), false);
});

test('isStandaloneDisplayMode detects all PWA display modes, iOS standalone, and Android TWA referrer', () => {
  assert.equal(isStandaloneDisplayMode({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(
    isStandaloneDisplayMode({
      matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
    }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({
      matchMedia: (q) => ({ matches: q === '(display-mode: minimal-ui)' }),
    }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({
      matchMedia: (q) => ({ matches: q === '(display-mode: fullscreen)' }),
    }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({
      matchMedia: (q) => ({ matches: q === '(display-mode: window-controls-overlay)' }),
    }),
    true
  );
  assert.equal(isStandaloneDisplayMode({ navigatorStandalone: true }), true);
  assert.equal(
    isStandaloneDisplayMode({ referrer: 'android-app://com.shansusdzar.app' }),
    true
  );
});

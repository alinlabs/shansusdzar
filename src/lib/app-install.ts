export const INSTALL_BANNER_STORAGE_KEY = 'shansusdzar-install-prompt-v1';
export const ADMIN_INSTALL_STORAGE_KEY = 'shansusdzar-admin-install-prompt-v1';

export const INSTALL_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
export const INSTALL_PROMPT_DWELL_MS = 6_000; // 6 seconds before sliding out below header
export const INSTALL_PROMPT_AUTO_HIDE_MS = 18_000; // Visible briefly (18 seconds)

export type PwaAppContext = 'public' | 'admin';

export interface PwaAppManifestConfig {
  context: PwaAppContext;
  appName: string;
  shortName: string;
  manifestPath: string;
  startUrl: string;
  scope: string;
  storageKey: string;
}

export const PUBLIC_PWA_CONFIG: PwaAppManifestConfig = {
  context: 'public',
  appName: 'SDI Furniture',
  shortName: 'SDI Furniture',
  manifestPath: '/manifest.webmanifest',
  startUrl: '/',
  scope: '/',
  storageKey: INSTALL_BANNER_STORAGE_KEY,
};

export const ADMIN_PWA_CONFIG: PwaAppManifestConfig = {
  context: 'admin',
  appName: 'SDI Admin',
  shortName: 'SDI Admin',
  manifestPath: '/manifest-admin.webmanifest',
  startUrl: '/admin',
  scope: '/',
  storageKey: ADMIN_INSTALL_STORAGE_KEY,
};

export interface InstallBannerRecord {
  dismissedAt: number | null;
  dismissCount: number;
  installedAt: number | null;
  neverShowAgain: boolean;
}

export function isAdminAppPath(pathname: string): boolean {
  const withoutQueryOrHash = (pathname || '/').split(/[?#]/)[0] ?? '/';
  const normalized = withoutQueryOrHash.replace(/\/+$/, '') || '/';
  return normalized === '/admin' || normalized.startsWith('/admin/');
}

export function resolvePwaAppContext(pathname: string): PwaAppContext {
  return isAdminAppPath(pathname) ? 'admin' : 'public';
}

export function getPwaAppConfig(context: PwaAppContext): PwaAppManifestConfig {
  return context === 'admin' ? ADMIN_PWA_CONFIG : PUBLIC_PWA_CONFIG;
}

export function shouldReloadForManifestBoundary({
  bootContext,
  pathname,
  isStandalone,
}: {
  bootContext: PwaAppContext | undefined;
  pathname: string;
  isStandalone: boolean;
}): boolean {
  if (isStandalone) return false;
  if (bootContext !== 'public' && bootContext !== 'admin') return false;
  return resolvePwaAppContext(pathname) !== bootContext;
}

export function syncDocumentPwaManifest(pathname: string): PwaAppManifestConfig {
  const context = resolvePwaAppContext(pathname);
  const config = getPwaAppConfig(context);

  if (typeof document !== 'undefined') {
    const manifestLink =
      document.getElementById('app-manifest-link') ??
      document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.getAttribute('href') !== config.manifestPath) {
      manifestLink.setAttribute('href', config.manifestPath);
    }
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle && appleTitle.getAttribute('content') !== config.shortName) {
      appleTitle.setAttribute('content', config.shortName);
    }
  }

  return config;
}

export const STANDALONE_DISPLAY_MODE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: minimal-ui)',
  '(display-mode: fullscreen)',
  '(display-mode: window-controls-overlay)',
] as const;

export function isStandaloneDisplayMode(env: {
  matchMedia?: (query: string) => { matches: boolean };
  navigatorStandalone?: boolean;
  referrer?: string;
}): boolean {
  if (env.navigatorStandalone === true) return true;
  if (typeof env.referrer === 'string' && env.referrer.startsWith('android-app://')) {
    return true;
  }
  if (typeof env.matchMedia === 'function') {
    return STANDALONE_DISPLAY_MODE_QUERIES.some(
      (query) => Boolean(env.matchMedia?.(query)?.matches)
    );
  }
  return false;
}

export function detectIOSDevice(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function loadInstallBannerRecord(
  storage: Storage | null | undefined,
  context: PwaAppContext = 'public'
): InstallBannerRecord {
  const empty: InstallBannerRecord = {
    dismissedAt: null,
    dismissCount: 0,
    installedAt: null,
    neverShowAgain: false,
  };
  if (!storage) return empty;

  const { storageKey } = getPwaAppConfig(context);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<InstallBannerRecord>;
    return {
      dismissedAt: typeof parsed.dismissedAt === 'number' ? parsed.dismissedAt : null,
      dismissCount: typeof parsed.dismissCount === 'number' ? parsed.dismissCount : 0,
      installedAt: typeof parsed.installedAt === 'number' ? parsed.installedAt : null,
      neverShowAgain: parsed.neverShowAgain === true,
    };
  } catch {
    return empty;
  }
}

export function saveInstallBannerRecord(
  storage: Storage | null | undefined,
  record: InstallBannerRecord,
  context: PwaAppContext = 'public'
): void {
  if (!storage) return;
  const { storageKey } = getPwaAppConfig(context);
  try {
    storage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors
  }
}

export interface InstallEligibilityInput {
  isStandalone: boolean;
  isAdminRoute: boolean;
  hasNativePrompt: boolean;
  isIOS: boolean;
  record: InstallBannerRecord;
  now: number;
  cooldownMs?: number;
}

/**
 * Menentukan apakah bilah ajakan Install Aplikasi di bawah header layak tampil
 * secara berkala tanpa mengganggu mode aplikasi terpasang atau panel admin.
 */
export function shouldShowInstallPromptCard({
  isStandalone,
  isAdminRoute,
  record,
  now,
  cooldownMs = INSTALL_PROMPT_COOLDOWN_MS,
}: InstallEligibilityInput): boolean {
  if (isStandalone || isAdminRoute) return false;
  if (record.installedAt !== null || record.neverShowAgain) return false;
  if (record.dismissedAt !== null && now - record.dismissedAt < cooldownMs) {
    return false;
  }
  return true;
}

/**
 * Tombol install manual di sidebar mobile dan Pengaturan desktop tetap tersedia
 * meski pengguna pernah menutup atau menonaktifkan banner otomatis, selama belum
 * berjalan di mode aplikasi terpasang (standalone) atau rute admin.
 */
export function shouldShowManualInstallAction({
  isStandalone,
  isInstalled = false,
  isAdminRoute = false,
}: {
  isStandalone: boolean;
  isInstalled?: boolean;
  isAdminRoute?: boolean;
}): boolean {
  return !isStandalone && !isInstalled && !isAdminRoute;
}

/**
 * Tombol install khusus panel admin di sidebar (mobile & desktop) tetap tersedia
 * selama aplikasi admin belum terpasang dan belum berjalan dalam mode aplikasi terpasang (standalone).
 */
export function shouldShowAdminSidebarInstallAction({
  isStandalone,
  isInstalled = false,
}: {
  isStandalone: boolean;
  isInstalled?: boolean;
}): boolean {
  return !isStandalone && !isInstalled;
}

export function buildInstallGuideSteps(
  isIOS: boolean,
  appName = PUBLIC_PWA_CONFIG.appName
): {
  title: string;
  steps: string[];
} {
  if (isIOS) {
    return {
      title: `Pasang ${appName} di Layar Utama`,
      steps: [
        'Ketuk ikon Bagikan (Share) di bilah navigasi Safari.',
        'Gulir daftar opsi ke bawah, lalu ketuk "Tambahkan ke Layar Utama" (Add to Home Screen).',
        `Pastikan nama aplikasi "${appName}", lalu ketuk "Tambah" di sudut kanan atas.`,
      ],
    };
  }

  return {
    title: `Cara Pasang ${appName}`,
    steps: [
      'Buka menu peramban Anda (ikon tiga titik ⋮ atau tombol pasang di bilah alamat).',
      `Pilih menu "Install Aplikasi" atau "Tambahkan ke Layar Utama" untuk ${appName}.`,
      `Konfirmasi pemasangan agar ${appName} muncul di layar utama perangkat Anda.`,
    ],
  };
}

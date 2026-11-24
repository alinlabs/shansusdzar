export const INSTALL_BANNER_STORAGE_KEY = 'shansusdzar-install-prompt-v1';

export const INSTALL_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
export const INSTALL_PROMPT_DWELL_MS = 6_000; // 6 seconds before sliding out below header
export const INSTALL_PROMPT_AUTO_HIDE_MS = 18_000; // Visible briefly (18 seconds)

export interface InstallBannerRecord {
  dismissedAt: number | null;
  dismissCount: number;
  installedAt: number | null;
  neverShowAgain: boolean;
}

export function detectIOSDevice(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function loadInstallBannerRecord(storage: Storage | null | undefined): InstallBannerRecord {
  const empty: InstallBannerRecord = {
    dismissedAt: null,
    dismissCount: 0,
    installedAt: null,
    neverShowAgain: false,
  };
  if (!storage) return empty;

  try {
    const raw = storage.getItem(INSTALL_BANNER_STORAGE_KEY);
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
  record: InstallBannerRecord
): void {
  if (!storage) return;
  try {
    storage.setItem(INSTALL_BANNER_STORAGE_KEY, JSON.stringify(record));
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
  isAdminRoute = false,
}: {
  isStandalone: boolean;
  isAdminRoute?: boolean;
}): boolean {
  return !isStandalone && !isAdminRoute;
}

export function buildInstallGuideSteps(isIOS: boolean): {
  title: string;
  steps: string[];
} {
  if (isIOS) {
    return {
      title: 'Pasang di Layar Utama',
      steps: [
        'Ketuk ikon Bagikan (Share) di bilah navigasi Safari.',
        'Gulir daftar opsi ke bawah, lalu ketuk "Tambahkan ke Layar Utama" (Add to Home Screen).',
        'Ketuk "Tambah" di sudut kanan atas untuk menyimpan pintasan aplikasi.',
      ],
    };
  }

  return {
    title: 'Cara Pasang Aplikasi',
    steps: [
      'Buka menu peramban Anda (ikon tiga titik ⋮ atau tombol pasang di bilah alamat).',
      'Pilih menu "Install Aplikasi" atau "Tambahkan ke Layar Utama".',
      'Konfirmasi pemasangan agar aplikasi muncul di layar utama perangkat Anda.',
    ],
  };
}

export type MobileSettingsTab = 'akun' | 'tampilan' | 'notifikasi' | 'penyimpanan';

export interface MobileSettingsTabOption {
  id: MobileSettingsTab;
  label: string;
}

export const MOBILE_SETTINGS_TABS: readonly MobileSettingsTabOption[] = [
  { id: 'akun', label: 'Akun' },
  { id: 'tampilan', label: 'Tampilan' },
  { id: 'notifikasi', label: 'Notifikasi' },
  { id: 'penyimpanan', label: 'Penyimpanan' },
];

export function resolveMobileSettingsTabFromLocation(input: {
  hash?: string;
  intent?: string | null;
}): MobileSettingsTab {
  const normalizedHash = (input.hash ?? '').trim().toLowerCase();

  if (
    normalizedHash === '#tema' ||
    normalizedHash === '#navigasi' ||
    normalizedHash === '#sain-ai' ||
    normalizedHash === '#bahasa'
  ) {
    return 'tampilan';
  }

  if (normalizedHash === '#notifikasi') {
    return 'notifikasi';
  }

  if (normalizedHash === '#penyimpanan') {
    return 'penyimpanan';
  }

  if (
    normalizedHash === '#akun' ||
    input.intent === 'survei' ||
    input.intent === 'pesanan'
  ) {
    return 'akun';
  }

  return 'akun';
}

export function formatStorageBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

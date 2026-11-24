export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'shansusdzar-theme-v2';
export const DEFAULT_THEME: ThemeMode = 'dark';

export function resolveInitialTheme(storedValue?: string | null): ThemeMode {
  if (storedValue === 'light') {
    return 'light';
  }
  return DEFAULT_THEME;
}

export interface ThemeMetaConfig {
  colorScheme: ThemeMode;
  themeColor: string;
  appleStatusBarStyle: 'default' | 'black';
}

export function resolveThemeMetaConfig(theme: ThemeMode): ThemeMetaConfig {
  if (theme === 'light') {
    return {
      colorScheme: 'light',
      themeColor: '#fafafa',
      appleStatusBarStyle: 'default',
    };
  }
  return {
    colorScheme: 'dark',
    themeColor: '#171716',
    appleStatusBarStyle: 'black',
  };
}

export function shouldTriggerDeployReload(options: {
  hadController: boolean;
  isReloading: boolean;
  lastReloadAt: number | null;
  now: number;
  cooldownMs?: number;
}): boolean {
  const {
    hadController,
    isReloading,
    lastReloadAt,
    now,
    cooldownMs = 10_000,
  } = options;

  if (!hadController || isReloading) {
    return false;
  }

  if (typeof lastReloadAt === 'number' && Number.isFinite(lastReloadAt)) {
    if (now - lastReloadAt < cooldownMs) {
      return false;
    }
  }

  return true;
}

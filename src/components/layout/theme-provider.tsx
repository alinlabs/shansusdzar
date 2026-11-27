import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Moon, Sun } from 'lucide-react';

import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../../lib/indexeddb-storage';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  resolveInitialTheme,
  resolveThemeMetaConfig,
  type ThemeMode,
} from '../../lib/theme-preference';

export type { ThemeMode };

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = readLocalCacheItem(THEME_STORAGE_KEY);
    return resolveInitialTheme(stored);
  } catch {
    // Ignore storage access failures in restricted environments
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    const root = document.documentElement;
    const metaConfig = resolveThemeMetaConfig(nextTheme);
    root.classList.toggle('dark', nextTheme === 'dark');
    root.style.colorScheme = metaConfig.colorScheme;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', metaConfig.themeColor);
    }
    const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusMeta) {
      appleStatusMeta.setAttribute('content', metaConfig.appleStatusBarStyle);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    return subscribeLocalCacheChange(THEME_STORAGE_KEY, () => {
      setThemeState(getInitialTheme());
    });
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    try {
      writeLocalCacheItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage access failures
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme harus digunakan di dalam ThemeProvider.');
  }
  return context;
}

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'default' | 'plain';
  className?: string;
}

export function ThemeToggle({
  showLabel = false,
  variant = 'default',
  className = '',
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Ubah ke mode terang' : 'Ubah ke mode gelap';

  const displayClass = /\bhidden\b/.test(className) ? '' : 'inline-flex';

  const baseClassName =
    variant === 'plain'
      ? `${displayClass} items-center justify-center gap-2 min-h-8 min-w-8 p-1 bg-transparent border-0 text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer`.trim()
      : `${displayClass} items-center justify-center gap-2 min-h-10 min-w-10 px-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer`.trim();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`${baseClassName} ${className}`.trim()}
    >
      {isDark ? (
        <Sun className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Moon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
      )}
    </button>
  );
}

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronLeft,
  Download,
  Filter,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Search,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  AdminActionButton,
  AdminHeaderActionsScope,
} from '../../components/admin/admin-action-buttons';
import { AppInstallGuideModal } from '../../components/layout/app-install-guide-modal';
import { useTheme } from '../../components/layout/theme-provider';
import { IconButton } from '../../components/ui/icon-button';
import { useModalMotionState } from '../../components/ui/modal';
import { PullToRefreshIndicator } from '../../components/ui/pull-to-refresh-indicator';
import { RouteLoadingFallback } from '../../components/ui/route-loading-fallback';
import { useAppInstall } from '../../hooks/use-app-install';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh';
import { shouldShowAdminSidebarInstallAction } from '../../lib/app-install';
import {
  ADMIN_NAV_DEFINITIONS,
  resolveAdminHeaderBackMeta,
  resolveLockedAdminAddon,
  shouldShowMobileAdminHamburger,
  type AdminNavItemDef,
} from '../../lib/admin-routing';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { executeInPlacePageRefresh } from '../../lib/page-refresh';
import { evaluateAdminBypassAttempt } from '../../lib/admin-bypass';
import {
  ADMIN_PENDING_ROUTE_STORAGE_KEY,
  buildLocationFullPath,
  sanitizeAdminReturnRoute,
} from '../../lib/pull-to-refresh-logic';
import { canViewPage, getUserActorLabel, hasPageAccess } from '../../lib/rbac';
import { useAdminAuthStore } from '../../store/admin-auth-store';
import { useSiteContentStore } from '../../store/site-content-store';
import type { AdminAccessLevel, AdminAccessPageKey } from '../../types/cms';

const ADMIN_NAV_ICONS: Record<AdminNavItemDef['iconKey'], typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  proyek: FolderKanban,
  keuangan: Wallet,
  produk: LayoutGrid,
  portofolio: Briefcase,
  informasi: BookOpen,
  tentang: Building2,
  akses: Users,
  marketing: Megaphone,
  seo: Globe,
};

const ADMIN_NAV_ITEMS = ADMIN_NAV_DEFINITIONS.map((def) => ({
  ...def,
  icon: ADMIN_NAV_ICONS[def.iconKey],
}));

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/produk': 'Daftar Produk',
  '/admin/produk/baru': 'Tambah Produk',
  '/admin/portofolio': 'Portofolio',
  '/admin/portofolio/baru': 'Tambah Portofolio',
  '/admin/marketing/database': 'Database Kontak',
  '/admin/marketing/database/baru': 'Tambah Kontak',
  '/admin/marketing/campaign': 'Campaign',
  '/admin/marketing/campaign/baru': 'Buat Campaign',
  '/admin/marketing/content-plan': 'Content Plan',
  '/admin/marketing/content-plan/baru': 'Tambah Konten',
  '/admin/seo': 'SEO Global',
  '/admin/informasi/berita': 'Berita',
  '/admin/informasi/berita/baru': 'Tulis Berita',
  '/admin/informasi/material': 'Material',
  '/admin/informasi/material/baru': 'Tambah Material',
  '/admin/informasi/faq': 'FAQ',
  '/admin/informasi/faq/baru': 'Tambah FAQ',
  '/admin/tentang': 'Profil Usaha',
  '/admin/profil-usaha': 'Profil Usaha',
  '/admin/proyek': 'Proyek',
  '/admin/proyek/baru': 'Buat Proyek',
  '/admin/keuangan': 'Keuangan',
  '/admin/keuangan/baru': 'Catat Transaksi Kas',
  '/admin/akses': 'Pengguna',
  '/admin/akses/pengguna/baru': 'Tambah Pengguna',
};

export interface AdminHeaderSearchConfig {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onActiveChange?: (isActive: boolean) => void;
  hasActiveFilter?: boolean;
  onResetAll?: () => void;
  filterAriaLabel?: string;
  filterTitle?: string;
  renderFilterContent?: (closeFilter: () => void) => ReactNode;
}

interface AdminHeaderMetaState {
  ownerId: string;
  title: string;
  description?: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  hasSearch?: boolean;
  searchAriaLabel?: string;
}

interface AdminHeaderContextValue {
  actionsHost: HTMLDivElement | null;
  searchBarHost: HTMLDivElement | null;
  subHeaderHost: HTMLDivElement | null;
  bottomNavHost: HTMLDivElement | null;
  isSearchActive: boolean;
  closeSearch: () => void;
  scrollMainToTop: () => void;
  scrollMainToFirstError: (container?: HTMLElement | null) => void;
  setHeaderMeta: (
    ownerId: string,
    title: string,
    description?: string,
    backTo?: string,
    backLabel?: string,
    subtitle?: string,
    hasSearch?: boolean,
    searchAriaLabel?: string
  ) => void;
  clearHeaderMeta: (ownerId: string) => void;
}

const AdminHeaderContext = createContext<AdminHeaderContextValue | null>(null);

function AdminHeaderSearchBar({
  search,
  onClose,
}: {
  search: AdminHeaderSearchConfig;
  onClose: () => void;
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterWrapperRef = useRef<HTMLDivElement>(null);

  const onChangeRef = useRef(search.onChange);
  onChangeRef.current = search.onChange;
  const onResetAllRef = useRef(search.onResetAll);
  onResetAllRef.current = search.onResetAll;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleBack = useCallback(() => {
    setIsFilterOpen(false);
    onChangeRef.current('');
    onResetAllRef.current?.();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        isFilterOpen &&
        filterWrapperRef.current &&
        !filterWrapperRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isFilterOpen) {
        event.preventDefault();
        setIsFilterOpen(false);
      } else {
        event.preventDefault();
        handleBack();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen, handleBack]);

  return (
    <div
      data-testid="admin-header-search-bar"
      className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0"
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Kembali ke tampilan normal"
        title="Kembali"
        data-testid="admin-header-search-back"
        className="inline-flex items-center justify-start sm:justify-center w-6 h-10 sm:size-9 -ml-0.5 bg-transparent border-0 shadow-none rounded-none sm:rounded-[var(--radius-md)] text-[var(--text)] hover:text-[var(--text-muted)] sm:hover:bg-[var(--surface-muted)] transition-colors duration-150 cursor-pointer shrink-0"
      >
        <ChevronLeft className="size-5 sm:size-4.5 shrink-0" aria-hidden="true" />
      </button>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          inputRef.current?.blur();
        }}
        onClick={() => inputRef.current?.focus()}
        className="relative flex-1 min-w-0 flex items-center cursor-text"
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder || 'Cari...'}
          aria-label={search.ariaLabel || search.placeholder || 'Kata kunci pencarian'}
          data-testid="admin-header-search-input"
          className={[
            'w-full h-10 pl-1 bg-transparent border-0 rounded-none shadow-none text-left text-base md:text-sm font-medium text-[var(--text)] placeholder:font-normal placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none',
            search.value.length > 0 ? 'pr-8' : 'pr-1',
          ].join(' ')}
        />
        {search.value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              search.onChange('');
              inputRef.current?.focus();
            }}
            aria-label="Hapus kata kunci pencarian"
            title="Hapus pencarian"
            data-testid="admin-header-search-clear"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </form>

      {search.renderFilterContent && (
        <div
          ref={filterWrapperRef}
          className="relative flex items-center justify-end shrink-0"
        >
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={isFilterOpen}
            aria-label={search.filterAriaLabel || 'Filter pencarian'}
            title={search.filterAriaLabel || 'Filter'}
            data-testid="admin-header-search-filter"
            className={[
              'relative inline-flex items-center justify-center size-10 sm:size-9 -mr-1.5 sm:mr-0 rounded-none sm:rounded-[var(--radius-md)] border transition-colors duration-150 cursor-pointer shrink-0',
              isFilterOpen || search.hasActiveFilter
                ? 'border-transparent sm:border-[var(--border-strong)] bg-transparent sm:bg-[var(--surface-muted)] text-[var(--accent)] sm:text-[var(--text)]'
                : 'border-transparent sm:border-[var(--border)] bg-transparent sm:bg-[var(--surface)] text-[var(--text)] hover:text-[var(--text-muted)] sm:hover:bg-[var(--surface-muted)]',
            ].join(' ')}
          >
            <Filter className="size-4 shrink-0" aria-hidden="true" />
            {search.hasActiveFilter && (
              <span
                aria-hidden="true"
                className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 size-1.5 rounded-full bg-[var(--accent)]"
              />
            )}
          </button>

          {isFilterOpen && (
            <div
              role="dialog"
              aria-label={search.filterTitle || search.filterAriaLabel || 'Filter pencarian'}
              className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-2rem))] sm:w-80 max-h-[min(75vh,34rem)] overflow-y-auto z-50 border border-[var(--border-strong)] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-xl p-4 space-y-4"
            >
              {search.renderFilterContent(() => setIsFilterOpen(false))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  search?: AdminHeaderSearchConfig;
}

export function AdminPageHeader({
  title,
  description,
  subtitle,
  backTo,
  backLabel,
  actions,
  search,
}: AdminPageHeaderProps) {
  const ctx = useContext(AdminHeaderContext);
  const ownerId = useId();
  const hasSearch = Boolean(search);
  const searchAriaLabel = search?.ariaLabel;

  const onActiveChangeRef = useRef(search?.onActiveChange);
  onActiveChangeRef.current = search?.onActiveChange;

  const isSearchActiveForPage = Boolean(ctx?.isSearchActive && search);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.setHeaderMeta(
      ownerId,
      title,
      description,
      backTo,
      backLabel,
      subtitle,
      hasSearch,
      searchAriaLabel
    );
  }, [ctx, ownerId, title, description, backTo, backLabel, subtitle, hasSearch, searchAriaLabel]);

  useLayoutEffect(() => {
    if (!ctx) return;
    return () => {
      ctx.clearHeaderMeta(ownerId);
    };
  }, [ctx, ownerId]);

  useLayoutEffect(() => {
    onActiveChangeRef.current?.(isSearchActiveForPage);
  }, [isSearchActiveForPage]);

  useEffect(() => {
    return () => {
      onActiveChangeRef.current?.(false);
    };
  }, []);

  return (
    <>
      {actions && ctx?.actionsHost
        ? createPortal(<AdminHeaderActionsScope>{actions}</AdminHeaderActionsScope>, ctx.actionsHost)
        : null}
      {isSearchActiveForPage && search && ctx?.searchBarHost
        ? createPortal(
            <AdminHeaderSearchBar search={search} onClose={ctx.closeSearch} />,
            ctx.searchBarHost
          )
        : null}
    </>
  );
}

export function AdminMobileSubHeader({ children }: { children: ReactNode }) {
  const ctx = useContext(AdminHeaderContext);
  return ctx?.subHeaderHost ? createPortal(children, ctx.subHeaderHost) : null;
}

export function AdminMobileBottomAction({ children }: { children: ReactNode }) {
  const ctx = useContext(AdminHeaderContext);
  return ctx?.bottomNavHost ? createPortal(children, ctx.bottomNavHost) : null;
}

export function useAdminScrollControl() {
  const ctx = useContext(AdminHeaderContext);
  return {
    scrollMainToTop: ctx?.scrollMainToTop ?? (() => {}),
    scrollMainToFirstError: ctx?.scrollMainToFirstError ?? (() => {}),
  };
}

export function RequireAdminPermission({
  page,
  minLevel = 'view',
  children,
}: {
  page?: AdminAccessPageKey;
  minLevel?: Exclude<AdminAccessLevel, 'hide'>;
  children: ReactNode;
}) {
  const location = useLocation();
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;

  const allowed = Boolean(currentUser) && (!page || hasPageAccess(currentUser, page, minLevel));

  if (!allowed) {
    const fallbackBackMeta = resolveAdminHeaderBackMeta(location.pathname);
    return (
      <div className="p-8 border border-[var(--danger-border)] bg-[var(--danger-surface)] rounded-[var(--radius-lg)] space-y-3 max-w-xl">
        <AdminPageHeader
          title="Akses Dibatasi"
          backTo={fallbackBackMeta?.backTo}
          backLabel={fallbackBackMeta?.backLabel}
        />
        <p className="text-sm text-[var(--text)] leading-relaxed">
          Akun <strong>{currentUser?.nama ?? 'Anda'}</strong> tidak memiliki izin akses ke halaman ini.
        </p>
        <div className="pt-2">
          <Link
            to="/admin"
            className="inline-flex items-center px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getInitialExpandedGroups(pathname: string): Record<string, boolean> {
  const clean = pathname.replace(/\/+$/, '') || '/admin';
  const initial: Record<string, boolean> = {};
  for (const item of ADMIN_NAV_ITEMS) {
    if (item.children) {
      initial[item.to] = clean === item.to || clean.startsWith(`${item.to}/`);
    }
  }
  return initial;
}

export function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isMounted: isMobileDrawerMounted, motionState: mobileDrawerMotionState } =
    useModalMotionState(mobileMenuOpen);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    getInitialExpandedGroups(location.pathname)
  );
  const [headerMeta, setHeaderMetaState] = useState<AdminHeaderMetaState | null>(null);
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [searchBarHost, setSearchBarHost] = useState<HTMLDivElement | null>(null);
  const [subHeaderHost, setSubHeaderHost] = useState<HTMLDivElement | null>(null);
  const [bottomNavHost, setBottomNavHost] = useState<HTMLDivElement | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const { theme, setTheme } = useTheme();
  const {
    appConfig: adminAppConfig,
    isIOS,
    isStandalone,
    isInstalled,
    triggerInstall,
    isGuideOpen,
    setIsGuideOpen,
  } = useAppInstall(location.pathname);
  const canShowAdminInstall = shouldShowAdminSidebarInstallAction({
    isStandalone,
    isInstalled,
  });
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const users = useAdminAuthStore((state) => state.users);
  const loginByBypass = useAdminAuthStore((state) => state.loginByBypass);
  const logout = useAdminAuthStore((state) => state.logout);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const bypassAttempt = useMemo(
    () =>
      evaluateAdminBypassAttempt(users, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
    [users, location.pathname, location.search, location.hash]
  );

  const setHeaderMeta = useCallback(
    (
      ownerId: string,
      title: string,
      description?: string,
      backTo?: string,
      backLabel?: string,
      subtitle?: string,
      hasSearch?: boolean,
      searchAriaLabel?: string
    ) => {
      setHeaderMetaState((prev) => {
        if (
          prev &&
          prev.ownerId === ownerId &&
          prev.title === title &&
          prev.description === description &&
          prev.subtitle === subtitle &&
          prev.backTo === backTo &&
          prev.backLabel === backLabel &&
          prev.hasSearch === hasSearch &&
          prev.searchAriaLabel === searchAriaLabel
        ) {
          return prev;
        }
        return {
          ownerId,
          title,
          description,
          subtitle,
          backTo,
          backLabel,
          hasSearch,
          searchAriaLabel,
        };
      });
    },
    []
  );

  const clearHeaderMeta = useCallback((ownerId: string) => {
    setHeaderMetaState((prev) => (prev && prev.ownerId === ownerId ? null : prev));
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchActive(false);
  }, []);

  const scrollAdminMainToTop = useCallback(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const scrollMainToFirstError = useCallback((container?: HTMLElement | null) => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scope = container ?? mainScrollRef.current;
        if (!scope) return;
        const target = scope.querySelector<HTMLElement>(
          '[aria-invalid="true"], [data-field-error="true"], [role="alert"]'
        );
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLButtonElement
        ) {
          target.focus({ preventScroll: true });
        }
      });
    });
  }, []);

  const headerContextValue = useMemo<AdminHeaderContextValue>(
    () => ({
      actionsHost,
      searchBarHost,
      subHeaderHost,
      bottomNavHost,
      isSearchActive,
      closeSearch,
      scrollMainToTop: scrollAdminMainToTop,
      scrollMainToFirstError,
      setHeaderMeta,
      clearHeaderMeta,
    }),
    [
      actionsHost,
      searchBarHost,
      subHeaderHost,
      bottomNavHost,
      isSearchActive,
      closeSearch,
      scrollAdminMainToTop,
      scrollMainToFirstError,
      setHeaderMeta,
      clearHeaderMeta,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void import('../../lib/pdf/image-prep')
        .then((mod) => {
          if (!cancelled) mod.preloadWorkshopBrandPdfAssets();
        })
        .catch(() => {});
    };

    if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const timer = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
  }, [location.pathname]);

  useEffect(() => {
    const clean = location.pathname.replace(/\/+$/, '') || '/admin';
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of ADMIN_NAV_ITEMS) {
        if (item.children && (clean === item.to || clean.startsWith(`${item.to}/`))) {
          if (!next[item.to]) {
            next[item.to] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/admin';
  const resolvedHeaderTitle = headerMeta?.title || ROUTE_TITLES[normalizedPath] || 'Panel Admin';
  const lockedAddon = useMemo(
    () => resolveLockedAdminAddon(normalizedPath),
    [normalizedPath]
  );
  const fallbackBackMeta = useMemo(
    () => resolveAdminHeaderBackMeta(normalizedPath),
    [normalizedPath]
  );
  const activeBackTo = headerMeta ? headerMeta.backTo : fallbackBackMeta?.backTo;
  const activeBackLabel = headerMeta
    ? headerMeta.backLabel || fallbackBackMeta?.backLabel || 'Kembali'
    : fallbackBackMeta?.backLabel || 'Kembali';
  const showMobileHamburger = shouldShowMobileAdminHamburger(Boolean(activeBackTo));

  useLayoutEffect(() => {
    scrollAdminMainToTop();
    if (typeof window === 'undefined') return;
    const rafId = window.requestAnimationFrame(() => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [location.pathname, scrollAdminMainToTop]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, activeBackTo]);

  useEffect(() => {
    setIsSearchActive(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!headerMeta?.hasSearch) {
      setIsSearchActive(false);
    }
  }, [headerMeta?.hasSearch]);

  const effectiveSearchActive = Boolean(isSearchActive && headerMeta?.hasSearch && !lockedAddon);
  const fullLocationPath = buildLocationFullPath(location);

  const pullToRefresh = usePullToRefresh({
    scrollRef: mainScrollRef,
    enabled: Boolean(currentUser) && !lockedAddon,
    onRefresh: () => executeInPlacePageRefresh(location.pathname),
  });

  useEffect(() => {
    if (currentUser || bypassAttempt.active || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        ADMIN_PENDING_ROUTE_STORAGE_KEY,
        sanitizeAdminReturnRoute(fullLocationPath)
      );
    } catch {
      // Ignore storage restrictions
    }
  }, [currentUser, bypassAttempt.active, fullLocationPath]);

  useLayoutEffect(() => {
    if (!bypassAttempt.active) return;

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(ADMIN_PENDING_ROUTE_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    }

    if (bypassAttempt.ok) {
      if (currentUser?.id !== bypassAttempt.user.id) {
        loginByBypass();
      }
      navigate(bypassAttempt.cleanTargetPath, { replace: true });
      return;
    }

    if (currentUser) {
      logout();
    }
    navigate('/admin/login', {
      replace: true,
      state: {
        from: bypassAttempt.cleanTargetPath,
        bypassError: bypassAttempt.message,
      },
    });
  }, [bypassAttempt, currentUser, loginByBypass, logout, navigate]);

  if (bypassAttempt.active) {
    return <RouteLoadingFallback fullViewport immediate />;
  }

  if (!currentUser) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: sanitizeAdminReturnRoute(fullLocationPath) }}
      />
    );
  }

  const visibleNavItems = ADMIN_NAV_ITEMS.flatMap((item) => {
    if (item.children && item.children.length > 0) {
      const visibleChildren = item.children.filter((child) => {
        const targetPage = child.page ?? item.page;
        return !targetPage || canViewPage(currentUser, targetPage);
      });
      if (visibleChildren.length === 0) return [];
      return [{ ...item, children: visibleChildren }];
    }
    if (item.page && !canViewPage(currentUser, item.page)) {
      return [];
    }
    return [item];
  });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const sidebarBrandHeader = (
    <Link
      to="/"
      onClick={() => setMobileMenuOpen(false)}
      aria-label={`Kembali ke beranda ${shortBrandName}`}
      title="Kembali ke beranda"
      data-testid="admin-brand-home-link"
      className="inline-flex items-center gap-2.5 min-w-0 text-[var(--text)] hover:opacity-80 transition-opacity"
    >
      <img
        src={lightLogoSrc}
        alt=""
        aria-hidden="true"
        className="size-7 shrink-0 object-contain dark:hidden"
      />
      <img
        src={darkLogoSrc}
        alt=""
        aria-hidden="true"
        className="hidden size-7 shrink-0 object-contain dark:block"
      />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="text-sm font-bold tracking-tight text-[var(--text)] truncate">
          {shortBrandName}
        </span>
        <span className="text-[10px] font-light tracking-normal text-[var(--text-muted)] truncate">
          Panel Pengelola
        </span>
      </span>
    </Link>
  );

  const sidebarBody = (
    <div className="flex-1 min-h-0 flex flex-col justify-between">
      <nav
        aria-label="Navigasi panel admin"
        data-scroll-side="left"
        className="app-scroll-region app-scroll-region-slim flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4 space-y-1"
      >
        {canShowAdminInstall && (
          <div className="pb-2.5 mb-1.5 border-b border-[var(--border)]">
            <button
              type="button"
              data-testid="admin-sidebar-install-app"
              aria-label="Instal Admin App"
              onClick={() => {
                setMobileMenuOpen(false);
                void triggerInstall();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] border border-[#5c4b3e]/45 dark:border-[#c6b9a7]/30 bg-gradient-to-br from-[#1f1d1b] via-[#342d28] to-[#5c4b3e] dark:from-[#473c33] dark:via-[#2e2925] dark:to-[#1f1d1a] text-white shadow-[var(--shadow-sm)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer text-left"
            >
              <span className="size-8 rounded-[var(--radius-sm)] bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
                <Download className="size-4 shrink-0 text-white" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-tight text-white truncate">
                  Instal Admin App
                </span>
                <span className="block text-[10px] font-normal text-white/75 truncate mt-0.5">
                  Pasang aplikasi pengelola
                </span>
              </span>
            </button>
          </div>
        )}

        {visibleNavItems.map((item, idx) => {
          const Icon = item.icon;
          const prevItem = idx > 0 ? visibleNavItems[idx - 1] : null;
          const showAddonDivider = Boolean(item.isAddon && (!prevItem || !prevItem.isAddon));

          if (item.children && item.children.length > 0) {
            const isGroupRouteActive =
              normalizedPath === item.to || normalizedPath.startsWith(`${item.to}/`);
            const isExpanded = Boolean(expandedGroups[item.to]);
            const submenuId = `admin-submenu-${item.to.replace(/[^a-z0-9]+/gi, '-')}`;

            return (
              <div key={item.to} className="space-y-1">
                {showAddonDivider && (
                  <div className="my-2 border-t border-[var(--border)]" aria-hidden="true" />
                )}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  onClick={() => toggleGroup(item.to)}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors cursor-pointer whitespace-nowrap',
                    isGroupRouteActive
                      ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.isAddon && (
                      <Lock
                        className="size-3.5 text-[var(--text-subtle)] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <ChevronDown
                      className={[
                        'size-4 shrink-0 transition-transform duration-200',
                        isExpanded ? 'rotate-180' : '',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {isExpanded && (
                  <div
                    id={submenuId}
                    className="ml-4 pl-3 border-l border-[var(--border)] space-y-1 py-0.5"
                  >
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          scrollAdminMainToTop();
                        }}
                        className={({ isActive }) =>
                          [
                            'block px-3 py-2 rounded-[var(--radius-md)] text-xs transition-colors whitespace-nowrap truncate',
                            isActive
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                          ].join(' ')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={item.to}>
              {showAddonDivider && (
                <div className="my-2 border-t border-[var(--border)]" aria-hidden="true" />
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => {
                  setMobileMenuOpen(false);
                  scrollAdminMainToTop();
                }}
                className={({ isActive }) =>
                  [
                    'flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                  ].join(' ')
                }
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.isAddon && (
                  <Lock className="size-3.5 opacity-70 shrink-0" aria-hidden="true" />
                )}
              </NavLink>
            </div>
          );
        })}

        <div className="pt-2.5 mt-2 border-t border-[var(--border)] space-y-2">
          <div
            role="radiogroup"
            aria-label="Pilih tema tampilan"
            data-testid="admin-theme-tabs"
            className="grid grid-cols-2 gap-1 p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]"
          >
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              data-testid="admin-theme-light"
              onClick={() => setTheme('light')}
              className={[
                'inline-flex items-center justify-center gap-1.5 min-h-8 px-2.5 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer whitespace-nowrap',
                theme === 'light'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
              ].join(' ')}
            >
              <Sun className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Terang</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              data-testid="admin-theme-dark"
              onClick={() => setTheme('dark')}
              className={[
                'inline-flex items-center justify-center gap-1.5 min-h-8 px-2.5 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer whitespace-nowrap',
                theme === 'dark'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
              ].join(' ')}
            >
              <Moon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Gelap</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
        <div className="pt-3.5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-2 px-1.5">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-[var(--text)] truncate">{currentUser.nama}</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {currentUser.isOwner
                  ? `Owner · ${currentUser.divisi}`
                  : `${getUserActorLabel(currentUser)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Keluar Sesi"
              aria-label="Keluar Sesi"
              data-testid="admin-logout-btn"
              className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AdminHeaderContext.Provider value={headerContextValue}>
      <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden flex bg-[var(--bg)] text-[var(--text)]">
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] border-r border-[var(--border)] bg-[var(--surface)]">
          <div className="h-16 shrink-0 border-b border-[var(--border)] px-5 flex items-center">
            {sidebarBrandHeader}
          </div>
          {sidebarBody}
        </aside>

        {isMobileDrawerMounted && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              aria-hidden="true"
              data-state={mobileDrawerMotionState}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 modal-backdrop-motion"
            />
            <aside
              id="admin-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigasi panel admin seluler"
              data-state={mobileDrawerMotionState}
              className="relative z-10 w-72 max-w-[85vw] h-full pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] flex flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] modal-drawer-left-motion"
            >
              <div className="h-16 shrink-0 px-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
                {sidebarBrandHeader}
                <IconButton
                  aria-label="Tutup menu admin"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
              {sidebarBody}
            </aside>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="shrink-0 relative z-30 pt-[env(safe-area-inset-top)] bg-[var(--surface)]">
            <div className="min-h-16 border-b border-[var(--border)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div
                aria-hidden={effectiveSearchActive}
                className={
                  effectiveSearchActive
                    ? 'hidden'
                    : 'flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1'
                }
              >
                {showMobileHamburger && (
                  <button
                    type="button"
                    aria-label="Buka menu navigasi admin"
                    aria-expanded={mobileMenuOpen}
                    aria-controls="admin-mobile-drawer"
                    onClick={() => setMobileMenuOpen(true)}
                    className="lg:hidden inline-flex items-center justify-start w-6 h-10 -ml-0.5 bg-transparent border-0 shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
                  >
                    <Menu className="size-4.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
                {activeBackTo && (
                  <Link
                    to={activeBackTo}
                    aria-label={activeBackLabel}
                    title={activeBackLabel}
                    className="inline-flex items-center justify-start sm:justify-center w-6 h-10 sm:size-9 -ml-0.5 bg-transparent border-0 shadow-none rounded-none sm:rounded-[var(--radius-md)] text-[var(--text)] hover:text-[var(--text-muted)] sm:hover:bg-[var(--surface-muted)] transition-colors duration-150 shrink-0"
                  >
                    <ChevronLeft className="size-4.5 sm:size-4 shrink-0" aria-hidden="true" />
                  </Link>
                )}
                <div className="min-w-0 flex-1 flex flex-col leading-tight">
                  <h1 className="text-[14px] sm:text-base font-bold tracking-tight text-[var(--text)] truncate">
                    {resolvedHeaderTitle}
                  </h1>
                  <p className="text-[10.5px] sm:text-[11px] font-light tracking-normal text-[var(--text-muted)] truncate">
                    {headerMeta?.subtitle || shortBrandName}
                  </p>
                </div>
              </div>

              <div
                aria-hidden={effectiveSearchActive || Boolean(lockedAddon)}
                className={[
                  'flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 max-w-full shrink-0',
                  effectiveSearchActive || lockedAddon ? 'hidden pointer-events-none' : '',
                ].join(' ')}
              >
                {headerMeta?.hasSearch && (
                  <AdminHeaderActionsScope>
                    <AdminActionButton
                      icon={<Search className="size-3.5" />}
                      label={headerMeta.searchAriaLabel || 'Cari'}
                      iconOnly
                      onClick={() => setIsSearchActive(true)}
                      data-testid="admin-header-search-trigger"
                    />
                  </AdminHeaderActionsScope>
                )}
                <div
                  ref={setActionsHost}
                  className="empty:hidden flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 min-w-0 max-w-full shrink-0"
                />
              </div>

              <div
                ref={setSearchBarHost}
                className={effectiveSearchActive ? 'w-full min-w-0' : 'hidden'}
              />
            </div>
          </header>

          <div
            ref={setSubHeaderHost}
            aria-hidden={effectiveSearchActive || Boolean(lockedAddon)}
            data-testid="admin-mobile-subheader-host"
            className={[
              'md:hidden empty:hidden shrink-0 relative z-20 bg-[var(--surface)] border-b border-[var(--border)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] print:hidden',
              effectiveSearchActive || lockedAddon ? 'hidden pointer-events-none' : '',
            ].join(' ')}
          />

          <div className="relative flex-1 min-h-0 flex flex-col">
            <main
              ref={mainScrollRef}
              aria-hidden={Boolean(lockedAddon)}
              className={[
                'app-scroll-region flex-1 min-h-0 pl-[max(0.875rem,env(safe-area-inset-left))] pr-[max(0.875rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:py-8 flex flex-col',
                lockedAddon
                  ? 'overflow-hidden pointer-events-none select-none blur-[6px] opacity-60'
                  : 'overflow-y-auto overflow-x-hidden overscroll-y-contain',
              ].join(' ')}
            >
              <PullToRefreshIndicator
                pullDistance={pullToRefresh.pullDistance}
                phase={pullToRefresh.phase}
                progress={pullToRefresh.progress}
              />
              <div className="w-full flex-1 flex flex-col">
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Outlet />
                </Suspense>
              </div>
            </main>

            {lockedAddon && (
              <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="admin-addon-lock-title"
                className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-[var(--bg)]/40 backdrop-blur-[2px]"
              >
                <div className="w-full max-w-md border border-[var(--border-strong)] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-6 sm:p-7 text-center space-y-4">
                  <div className="mx-auto size-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)]">
                    <Lock className="size-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1.5">
                    <h2
                      id="admin-addon-lock-title"
                      className="text-base font-bold text-[var(--text)] tracking-tight"
                    >
                      {lockedAddon.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                      {lockedAddon.description}
                    </p>
                  </div>
                  <div className="pt-1 flex justify-center">
                    <Link
                      to="/admin"
                      className="inline-flex items-center justify-center min-h-9 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Kembali ke Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            ref={setBottomNavHost}
            aria-hidden={Boolean(lockedAddon)}
            className={[
              'md:hidden empty:hidden shrink-0 relative z-30 border-t border-[var(--border)] bg-[var(--surface)] pl-[max(0.875rem,env(safe-area-inset-left))] pr-[max(0.875rem,env(safe-area-inset-right))] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden',
              lockedAddon ? 'hidden pointer-events-none' : '',
            ].join(' ')}
          />
        </div>
      </div>

      <AppInstallGuideModal
        isOpen={isGuideOpen && !isStandalone && !isInstalled}
        onClose={() => setIsGuideOpen(false)}
        isIOS={isIOS}
        appName={adminAppConfig.appName}
      />
    </AdminHeaderContext.Provider>
  );
}

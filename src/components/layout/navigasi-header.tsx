import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Filter,
  Menu,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  buildDetailSearchRedirectState,
  clearDetailSearchSession,
  consumeDetailSearchSessionHistoryBack,
  markDetailSearchSessionStarted,
  parseDetailSearchRedirectState,
  resolveDetailSearchCloseTarget,
} from '../../lib/detail-search-navigation';
import {
  SEARCH_FILTER_OPTIONS,
  parseSearchFilterKey,
  type SearchFilterKey,
} from '../../lib/global-search';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import { useAdaptiveNav, type AdaptiveHeaderSearchConfig } from './adaptive-nav-context';
import { Container } from './container';
import { InformasiNavPopup, isInformasiRouteActive } from './informasi-menu-popup';
import { MobileNavSidebar } from './mobile-nav-sidebar';

function PublicHeaderSearchBar({
  search,
  onClose,
}: {
  search: AdaptiveHeaderSearchConfig;
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
      data-testid="public-header-search-bar"
      className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0"
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Kembali ke tampilan normal"
        title="Kembali"
        data-testid="public-header-search-back"
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
          data-testid="public-header-search-input"
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
            data-testid="public-header-search-clear"
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
            data-testid="public-header-search-filter"
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
              data-testid="public-header-search-filter-dialog"
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

const LEFT_NAV_ITEMS = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/produk', label: 'Produk', end: false },
  { to: '/portofolio', label: 'Portofolio', end: false },
];

export function NavigasiHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const items = useCartStore((state) => state.items);
  const isDrawerOpen = useCartStore((state) => state.isDrawerOpen);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const { totalQuantity } = calculateCartSummary(items);
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isPageSearchActive, setIsPageSearchActive] = useState(false);
  const infoMenuWrapperRef = useRef<HTMLDivElement>(null);
  const filterMenuWrapperRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const infoActive = isInformasiRouteActive(location.pathname);
  const isSearchRoute = location.pathname === '/pencarian';
  const mobileSearchQuery = isSearchRoute ? (searchParams.get('q') ?? '') : '';
  const activeMobileFilter = isSearchRoute
    ? parseSearchFilterKey(searchParams.get('filter'))
    : 'semua';

  const { adaptiveNav } = useAdaptiveNav();
  const headerOverride = adaptiveNav?.header ?? null;
  const hideDesktopNav = Boolean(headerOverride?.hideDesktopNav);
  const hideDesktopAccountIcons = Boolean(headerOverride?.hideDesktopAccountIcons);
  const hideSearchIcon = Boolean(headerOverride?.hideSearchIcon);
  const hideCartIcon = Boolean(headerOverride?.hideCartIcon);
  const desktopSidebarSplit = Boolean(headerOverride?.desktopSidebarSplit);
  const headerBackTo = headerOverride?.backTo ?? null;
  const headerBackAriaLabel = headerOverride?.backAriaLabel ?? 'Kembali ke daftar produk';
  const headerMobileEyebrow = headerOverride?.mobileEyebrow ?? null;
  const headerMobileTitle = headerOverride?.mobileTitle ?? null;
  const headerSearch = headerOverride?.search ?? null;
  const headerSearchRedirect = headerOverride?.searchRedirect ?? null;
  const hasHeaderSearch = Boolean(headerSearch);
  const detailSearchState = parseDetailSearchRedirectState(location.state);
  const shouldOpenDetailSearch = Boolean(detailSearchState?.openSearch);
  const effectivePageSearchActive = Boolean(isPageSearchActive && hasHeaderSearch);

  const onPageSearchActiveChangeRef = useRef(headerSearch?.onActiveChange);
  onPageSearchActiveChangeRef.current = headerSearch?.onActiveChange;

  const closePageSearch = useCallback(() => {
    setIsPageSearchActive(false);
    const returnTarget = resolveDetailSearchCloseTarget(location.pathname, location.state);
    if (!returnTarget) return;
    const canStepBack =
      consumeDetailSearchSessionHistoryBack(returnTarget) &&
      typeof window !== 'undefined' &&
      window.history.length > 1;
    if (canStepBack) {
      navigate(-1);
    } else {
      navigate(returnTarget, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  useLayoutEffect(() => {
    setIsInfoMenuOpen(false);
    setIsMobileSidebarOpen(false);
    setIsMobileFilterOpen(false);
    if (shouldOpenDetailSearch) {
      setIsPageSearchActive(true);
    } else {
      setIsPageSearchActive(false);
      clearDetailSearchSession();
    }
  }, [location.pathname, location.key, shouldOpenDetailSearch]);

  useEffect(() => {
    if (!hasHeaderSearch && !shouldOpenDetailSearch) {
      setIsPageSearchActive(false);
    }
  }, [hasHeaderSearch, shouldOpenDetailSearch]);

  useLayoutEffect(() => {
    onPageSearchActiveChangeRef.current?.(effectivePageSearchActive);
  }, [effectivePageSearchActive]);

  useEffect(() => {
    return () => {
      onPageSearchActiveChangeRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    if (!isSearchRoute) return;
    const frameId = window.requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isSearchRoute]);

  useEffect(() => {
    if (!isInfoMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        infoMenuWrapperRef.current &&
        !infoMenuWrapperRef.current.contains(event.target as Node)
      ) {
        setIsInfoMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInfoMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInfoMenuOpen]);

  useEffect(() => {
    if (!isMobileFilterOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        filterMenuWrapperRef.current &&
        !filterMenuWrapperRef.current.contains(event.target as Node)
      ) {
        setIsMobileFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileFilterOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileFilterOpen]);

  const updateMobileSearchParams = (nextQuery: string, nextFilter: SearchFilterKey) => {
    const nextParams = new URLSearchParams();
    if (nextQuery.length > 0 && nextQuery.trim().length > 0) {
      nextParams.set('q', nextQuery);
    } else if (nextQuery.length > 0) {
      nextParams.set('q', nextQuery);
    }
    if (nextFilter !== 'semua') {
      nextParams.set('filter', nextFilter);
    }
    setSearchParams(nextParams, { replace: true, state: location.state });
  };

  const handleCloseMobileSearch = () => {
    setIsMobileFilterOpen(false);
    const navState = location.state as { returnTo?: string } | null;
    if (navState?.returnTo && !navState.returnTo.startsWith('/pencarian')) {
      navigate(navState.returnTo);
      return;
    }
    navigate('/');
  };

  const cartAriaLabel =
    totalQuantity > 0
      ? `Buka keranjang pesanan, ${totalQuantity} item`
      : 'Buka keranjang pesanan';

  const currentReturnPath = `${location.pathname}${location.search}`;

  const headerInnerClassName = [
    'h-16 flex items-center justify-between gap-2.5 md:gap-4',
    hideDesktopNav || effectivePageSearchActive
      ? ''
      : 'md:flex md:items-center md:justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]',
  ]
    .filter(Boolean)
    .join(' ');

  const headerContent = (
    <>
      {effectivePageSearchActive && headerSearch && (
        <PublicHeaderSearchBar search={headerSearch} onClose={closePageSearch} />
      )}

      {isSearchRoute && !effectivePageSearchActive && (
            <div className="flex md:hidden items-center gap-1 w-full min-w-0">
              <button
                type="button"
                onClick={handleCloseMobileSearch}
                aria-label="Kembali ke halaman sebelumnya"
                className="inline-flex items-center justify-start w-6 h-10 -ml-0.5 bg-transparent border-0 shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
              >
                <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
              </button>

              <form
                role="search"
                aria-label="Pencarian cepat"
                onSubmit={(event) => {
                  event.preventDefault();
                  mobileSearchInputRef.current?.blur();
                }}
                onClick={() => mobileSearchInputRef.current?.focus()}
                className="relative flex-1 min-w-0 flex items-center cursor-text"
              >
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={mobileSearchQuery}
                  onChange={(event) =>
                    updateMobileSearchParams(event.target.value, activeMobileFilter)
                  }
                  placeholder="Cari produk, portofolio, berita..."
                  aria-label="Kata kunci pencarian"
                  className={[
                    'w-full h-10 pl-1 bg-transparent border-0 rounded-none shadow-none text-left text-base font-medium text-[var(--text)] placeholder:font-normal placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none',
                    mobileSearchQuery.length > 0 ? 'pr-8' : 'pr-1',
                  ].join(' ')}
                />
                {mobileSearchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      updateMobileSearchParams('', activeMobileFilter);
                      mobileSearchInputRef.current?.focus();
                    }}
                    aria-label="Hapus kata kunci"
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </form>

              <div ref={filterMenuWrapperRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isMobileFilterOpen}
                  aria-label="Filter kategori pencarian"
                  className={[
                    'relative inline-flex items-center justify-center size-10 -mr-1.5 bg-transparent border-0 transition-colors duration-150 cursor-pointer shrink-0',
                    activeMobileFilter !== 'semua' || isMobileFilterOpen
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text)] hover:text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
                  {activeMobileFilter !== 'semua' && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]"
                    />
                  )}
                </button>

                {isMobileFilterOpen && (
                  <div
                    role="menu"
                    aria-label="Pilihan kategori pencarian"
                    className="absolute right-0 top-[calc(100%+0.5rem)] w-52 p-1.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)] z-50"
                  >
                    <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Filter Pencarian
                    </p>
                    {SEARCH_FILTER_OPTIONS.map((option) => {
                      const isSelected = activeMobileFilter === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            updateMobileSearchParams(mobileSearchQuery, option.id);
                            setIsMobileFilterOpen(false);
                          }}
                          className={[
                            'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-md)] text-xs text-left transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-[var(--surface-muted)] font-semibold text-[var(--text)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface-muted)]',
                          ].join(' ')}
                        >
                          <span>{option.label}</span>
                          {isSelected && (
                            <Check className="size-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            aria-hidden={effectivePageSearchActive}
            className={[
              effectivePageSearchActive
                ? 'hidden'
                : isSearchRoute
                  ? 'hidden md:flex'
                  : 'flex',
              'items-center min-w-0 justify-self-start',
              headerMobileTitle ? 'flex-1 md:flex-initial' : '',
              headerBackTo ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {headerBackTo ? (
              <>
                <Link
                  to={headerBackTo}
                  data-testid="header-back-card"
                  aria-label={headerBackAriaLabel}
                  title={headerBackAriaLabel}
                  className="inline-flex items-center justify-start w-6 sm:w-7 h-10 -ml-0.5 bg-transparent border-0 shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 shrink-0"
                >
                  <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
                </Link>

                {headerMobileTitle ? (
                  <>
                    <div
                      data-testid="header-mobile-product-title"
                      className="flex md:hidden flex-col min-w-0 leading-tight"
                    >
                      {headerMobileEyebrow && (
                        <span className="text-[10.5px] font-light tracking-normal text-[var(--text-muted)] truncate">
                          {headerMobileEyebrow}
                        </span>
                      )}
                      <h1 className="text-[14px] font-bold tracking-tight text-[var(--text)] truncate">
                        {headerMobileTitle}
                      </h1>
                    </div>

                    <NavLink
                      to="/"
                      className="hidden md:inline-flex items-center min-w-0 text-[var(--text)]"
                    >
                      <span className="flex flex-col min-w-0 leading-tight">
                        <span className="text-[12.5px] sm:text-[15px] font-bold tracking-tight text-[var(--text)] truncate">
                          {shortBrandName}
                        </span>
                        <span className="text-[9.5px] sm:text-[11px] font-light tracking-normal text-[var(--text-muted)] truncate">
                          Interior Design &amp; Building
                        </span>
                      </span>
                    </NavLink>
                  </>
                ) : (
                  <NavLink
                    to="/"
                    className="inline-flex items-center min-w-0 text-[var(--text)]"
                  >
                    <span className="flex flex-col min-w-0 leading-tight">
                      <span className="text-[12.5px] sm:text-[15px] font-bold tracking-tight text-[var(--text)] truncate">
                        {shortBrandName}
                      </span>
                      <span className="text-[9.5px] sm:text-[11px] font-light tracking-normal text-[var(--text-muted)] truncate">
                        Interior Design &amp; Building
                      </span>
                    </span>
                  </NavLink>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  aria-label="Buka menu navigasi seluler"
                  aria-expanded={isMobileSidebarOpen}
                  aria-controls="mobile-nav-sidebar"
                  className="md:hidden inline-flex items-center justify-start w-6 h-10 -ml-0.5 bg-transparent border-0 shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
                >
                  <Menu className="size-4.5 shrink-0" aria-hidden="true" />
                </button>

                <NavLink
                  to="/"
                  className="inline-flex items-center gap-1.5 sm:gap-2 min-w-0 text-[var(--text)]"
                >
                  <img
                    src={lightLogoSrc}
                    alt=""
                    aria-hidden="true"
                    className="size-7 sm:size-8 shrink-0 object-contain dark:hidden"
                  />
                  <img
                    src={darkLogoSrc}
                    alt=""
                    aria-hidden="true"
                    className="hidden size-7 sm:size-8 shrink-0 object-contain dark:block"
                  />
                  <span className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[12.5px] sm:text-[15px] font-bold tracking-tight text-[var(--text)] truncate">
                      {shortBrandName}
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-light tracking-normal text-[var(--text-muted)] truncate">
                      Interior Design &amp; Building
                    </span>
                  </span>
                </NavLink>
              </>
            )}
          </div>

          {!hideDesktopNav && !effectivePageSearchActive && (
            <nav
              aria-label="Navigasi utama desktop"
              className="hidden md:flex items-center justify-center md:gap-4 lg:gap-6 xl:gap-7"
            >
              {LEFT_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onMouseEnter={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                  className={({ isActive }) =>
                    [
                      'relative py-1 text-sm transition-colors duration-150 whitespace-nowrap shrink-0',
                      isActive
                        ? 'font-semibold text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:bg-[var(--accent)]'
                        : 'font-normal text-[var(--text-muted)] hover:text-[var(--text)]',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <div ref={infoMenuWrapperRef} className="relative flex items-center">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isInfoMenuOpen}
                  onClick={() => setIsInfoMenuOpen((prev) => !prev)}
                  className={[
                    'relative inline-flex items-center gap-1 py-1 text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer',
                    infoActive || isInfoMenuOpen
                      ? 'font-semibold text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:bg-[var(--accent)]'
                      : 'font-normal text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  <span>Informasi</span>
                  <ChevronDown
                    className={[
                      'size-3.5 transition-transform duration-150',
                      isInfoMenuOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </button>

                {isInfoMenuOpen && (
                  <InformasiNavPopup
                    variant="desktop"
                    currentPathname={location.pathname}
                    onSelectItem={() => setIsInfoMenuOpen(false)}
                    onClose={() => setIsInfoMenuOpen(false)}
                  />
                )}
              </div>

              <NavLink
                to="/tentang"
                onMouseEnter={() => prefetchRoute('/tentang')}
                onFocus={() => prefetchRoute('/tentang')}
                className={({ isActive }) =>
                  [
                    'relative py-1 text-sm transition-colors duration-150 whitespace-nowrap shrink-0',
                    isActive
                      ? 'font-semibold text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:bg-[var(--accent)]'
                      : 'font-normal text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')
                }
              >
                Tentang
              </NavLink>
            </nav>
          )}

          <div
            aria-hidden={effectivePageSearchActive}
            className={[
              effectivePageSearchActive
                ? 'hidden'
                : isSearchRoute
                  ? 'hidden md:flex'
                  : 'flex',
              'items-center gap-1 justify-self-end shrink-0',
            ].join(' ')}
          >
            {!hideSearchIcon &&
              (headerSearch ? (
                <button
                  type="button"
                  onClick={() => setIsPageSearchActive(true)}
                  aria-label={headerSearch.ariaLabel || 'Buka pencarian'}
                  title={headerSearch.ariaLabel || 'Cari'}
                  data-testid="header-search-trigger"
                  className="inline-flex items-center justify-center size-9 md:size-8 p-1 bg-transparent border-0 text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
                >
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                </button>
              ) : headerSearchRedirect ? (
                <button
                  type="button"
                  onMouseEnter={() => prefetchRoute(headerSearchRedirect.listRoute)}
                  onFocus={() => prefetchRoute(headerSearchRedirect.listRoute)}
                  onPointerDown={() => prefetchRoute(headerSearchRedirect.listRoute)}
                  onClick={() => {
                    const redirectState = buildDetailSearchRedirectState(
                      location.pathname,
                      location.search,
                      location.hash
                    );
                    markDetailSearchSessionStarted(redirectState.returnTo);
                    navigate(headerSearchRedirect.listRoute, { state: redirectState });
                  }}
                  aria-label={headerSearchRedirect.ariaLabel || 'Buka pencarian'}
                  title={headerSearchRedirect.ariaLabel || 'Cari'}
                  data-testid="header-search-trigger"
                  className="inline-flex items-center justify-center size-9 md:size-8 p-1 bg-transparent border-0 text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
                >
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                </button>
              ) : (
                <Link
                  to="/pencarian"
                  state={!isSearchRoute ? { returnTo: currentReturnPath } : location.state}
                  onMouseEnter={() => prefetchRoute('/pencarian')}
                  onFocus={() => prefetchRoute('/pencarian')}
                  aria-label="Buka halaman pencarian"
                  title="Pencarian"
                  className={[
                    'inline-flex items-center justify-center size-9 md:size-8 p-1 bg-transparent border-0 transition-colors duration-150 shrink-0',
                    isSearchRoute
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text)] hover:text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              ))}

            {!hideCartIcon && (
              <button
                type="button"
                onClick={openDrawer}
                aria-label={cartAriaLabel}
                aria-expanded={isDrawerOpen}
                aria-controls="sidebar-cart-drawer"
                className="relative inline-flex items-center justify-center size-9 md:size-8 p-1 bg-transparent border-0 text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 cursor-pointer shrink-0"
              >
                <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
                {totalQuantity > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] ring-2 ring-[var(--surface)] text-[10px] font-semibold leading-none tabular-nums"
                  >
                    {totalQuantity > 99 ? '99+' : totalQuantity}
                  </span>
                )}
              </button>
            )}

            {!hideDesktopAccountIcons && (
              <>
                <Link
                  to="/pengaturan"
                  onMouseEnter={() => prefetchRoute('/pengaturan')}
                  onFocus={() => prefetchRoute('/pengaturan')}
                  aria-label="Pengaturan Umum"
                  title="Pengaturan"
                  className={[
                    'hidden md:inline-flex items-center justify-center size-8 p-1 bg-transparent border-0 transition-colors duration-150 shrink-0',
                    location.pathname.startsWith('/pengaturan')
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text)] hover:text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <Settings className="size-4 shrink-0" aria-hidden="true" />
                </Link>

                <Link
                  to="/admin/login"
                  aria-label="Masuk Panel Admin"
                  title="Masuk Panel Admin"
                  className="hidden md:inline-flex items-center justify-center size-8 p-1 bg-transparent border-0 text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 shrink-0"
                >
                  <Shield className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
    </>
  );

  return (
    <>
      <header className="shrink-0 relative z-40 pt-[env(safe-area-inset-top)] border-b border-[var(--border)] bg-[var(--surface)] print:hidden">
        {desktopSidebarSplit ? (
          <div className={`w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[calc(3vw+2rem)] lg:pr-[max(2.5rem,env(safe-area-inset-right))] xl:pr-[max(3rem,env(safe-area-inset-right))] ${headerInnerClassName}`}>
            {headerContent}
          </div>
        ) : (
          <Container className={headerInnerClassName}>
            {headerContent}
          </Container>
        )}
      </header>

      <MobileNavSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Menu,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  SEARCH_FILTER_OPTIONS,
  parseSearchFilterKey,
  type SearchFilterKey,
} from '../../lib/global-search';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import { useAdaptiveNav } from './adaptive-nav-context';
import { Container } from './container';
import { InformasiNavPopup, isInformasiRouteActive } from './informasi-menu-popup';
import { MobileNavSidebar } from './mobile-nav-sidebar';

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
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const { totalQuantity } = calculateCartSummary(items);
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
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

  useEffect(() => {
    setIsInfoMenuOpen(false);
    setIsMobileSidebarOpen(false);
    setIsMobileFilterOpen(false);
  }, [location.pathname]);

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
    hideDesktopNav ? '' : 'md:flex md:items-center md:justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]',
  ]
    .filter(Boolean)
    .join(' ');

  const headerContent = (
    <>
      {isSearchRoute && (
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
                className="relative flex-1 min-w-0"
              >
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
                  aria-hidden="true"
                />
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
                  className="w-full h-10 pl-9 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-base md:text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)] transition-colors"
                />
                {mobileSearchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      updateMobileSearchParams('', activeMobileFilter);
                      mobileSearchInputRef.current?.focus();
                    }}
                    aria-label="Hapus kata kunci"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
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
            className={[
              isSearchRoute ? 'hidden md:flex' : 'flex',
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

          {!hideDesktopNav && (
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
            className={[
              isSearchRoute ? 'hidden md:flex' : 'flex',
              'items-center gap-1 justify-self-end shrink-0',
            ].join(' ')}
          >
            {!hideSearchIcon && (
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
            )}

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

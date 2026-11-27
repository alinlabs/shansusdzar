import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  BookOpen,
  Briefcase,
  ChevronUp,
  Headset,
  Home,
  Info,
  LayoutGrid,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { CartPlusIcon } from '../ui/cart-plus-icon';
import { IconButton } from '../ui/icon-button';
import { useModalMotionState } from '../ui/modal';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { useAdaptiveNav } from './adaptive-nav-context';
import { Container } from './container';
import { InformasiBottomSheet, isInformasiRouteActive } from './informasi-menu-popup';

function MobileNavItem({
  to,
  label,
  end,
  icon: Icon,
  showLabel,
}: {
  to: string;
  label: string;
  end: boolean;
  icon: typeof Home;
  showLabel: boolean;
}) {
  const isCenterCatalog = to === '/produk';

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        [
          'relative h-full w-full flex flex-col items-center gap-1 px-0.5 transition-colors duration-150',
          isCenterCatalog
            ? showLabel
              ? 'justify-end pb-3'
              : 'justify-center pb-1.5'
            : 'justify-center',
          isActive
            ? 'text-[var(--text)] font-semibold'
            : 'text-[var(--text-muted)] font-normal hover:text-[var(--text)]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isCenterCatalog ? (
            <span
              className={[
                showLabel ? '-mt-6' : '-mt-3',
                'size-12 rounded-full flex items-center justify-center shrink-0 transition-transform duration-150',
                'bg-[var(--accent)] text-[var(--accent-contrast)] dark:bg-[#5C4B3E] dark:text-white',
                'ring-4 ring-[var(--surface)] shadow-[var(--shadow-md)]',
                isActive ? 'scale-[1.03]' : '',
              ].join(' ')}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
            </span>
          ) : (
            <Icon className={showLabel ? 'size-4 shrink-0' : 'size-5 shrink-0'} aria-hidden="true" />
          )}
          {showLabel && (
            <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">{label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function NavigasiBottom() {
  const location = useLocation();
  const dropUpId = useId();
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const [isDropUpOpen, setIsDropUpOpen] = useState(false);
  const showBottomNav = usePublicPreferencesStore((state) => state.navigation.showBottomNav);
  const showBottomNavLabels = usePublicPreferencesStore(
    (state) => state.navigation.showBottomNavLabels
  );
  const { adaptiveNav } = useAdaptiveNav();
  const bottomOverride = adaptiveNav?.bottom ?? null;
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isSettingsRoute =
    normalizedPath === '/pengaturan' || normalizedPath.startsWith('/pengaturan/');
  const hasProductDropUp =
    bottomOverride?.type === 'product-detail' && Boolean(bottomOverride.renderDropUp);
  const infoActive = isInformasiRouteActive(location.pathname);

  const { isMounted: isDropUpMounted, motionState: dropUpMotionState } = useModalMotionState(
    isDropUpOpen && hasProductDropUp
  );

  useEffect(() => {
    setIsInfoMenuOpen(false);
    setIsDropUpOpen(false);
  }, [location.pathname, showBottomNav]);

  useEffect(() => {
    if (!hasProductDropUp) {
      setIsDropUpOpen(false);
    }
  }, [hasProductDropUp]);

  useEffect(() => {
    if (!isDropUpMounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsDropUpOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropUpMounted]);

  if (bottomOverride?.type === 'custom') {
    return (
      <nav
        aria-label="Navigasi aksi seluler"
        className="md:hidden shrink-0 relative z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] print:hidden"
      >
        <Container>{bottomOverride.render()}</Container>
      </nav>
    );
  }

  if (bottomOverride?.type === 'product-detail') {
    const hasPromo = Boolean(
      bottomOverride.compareAtPriceLabel || bottomOverride.promoPercentLabel
    );

    const priceSummaryContent = hasPromo ? (
      <>
        <div className="flex items-center gap-1 min-w-0 text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
          <span className="shrink-0">Est.</span>
          {bottomOverride.compareAtPriceLabel && (
            <span className="text-[var(--text-subtle)] line-through truncate">
              {bottomOverride.compareAtPriceLabel}
            </span>
          )}
          {hasProductDropUp && (
            <ChevronUp
              className={[
                'size-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200',
                isDropUpOpen ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 tabular-nums">
          <span
            data-testid="mobile-bottom-live-price"
            className="text-sm font-extrabold text-[var(--text)] truncate"
          >
            {bottomOverride.priceLabel}
          </span>
          {bottomOverride.promoPercentLabel && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-red-500 bg-red-600 text-white text-[10px] font-semibold leading-none tabular-nums shrink-0">
              {bottomOverride.promoPercentLabel}
            </span>
          )}
        </div>
      </>
    ) : (
      <>
        <div className="flex items-center gap-1 min-w-0 text-[11px] font-medium text-[var(--text-muted)]">
          <span className="truncate">{bottomOverride.estimateLabel ?? 'Estimasi Harga'}</span>
          {hasProductDropUp && (
            <ChevronUp
              className={[
                'size-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200',
                isDropUpOpen ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex items-center gap-1 min-w-0 tabular-nums">
          <span
            data-testid="mobile-bottom-live-price"
            className="text-sm font-extrabold text-[var(--text)] truncate"
          >
            {bottomOverride.priceLabel}
          </span>
        </div>
      </>
    );

    return (
      <div className="md:hidden shrink-0 relative z-40 print:hidden">
        {hasProductDropUp && isDropUpMounted && (
          <>
            <div
              aria-hidden="true"
              data-state={dropUpMotionState}
              onClick={() => setIsDropUpOpen(false)}
              className="fixed inset-0 z-0 modal-backdrop-motion"
            />

            <div
              id={dropUpId}
              role="dialog"
              aria-modal="true"
              aria-label={bottomOverride.dropUpTitle ?? 'Detail Estimasi'}
              data-testid="mobile-bottom-estimate-dropup"
              data-state={dropUpMotionState}
              className="absolute inset-x-0 bottom-full z-10 max-h-[min(75dvh,calc(100dvh-11.5rem-env(safe-area-inset-top)))] flex flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-x border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] modal-panel-motion"
            >
              <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  {bottomOverride.dropUpEyebrow && (
                    <p className="text-[11px] font-normal text-[var(--text-muted)] truncate leading-tight">
                      {bottomOverride.dropUpEyebrow}
                    </p>
                  )}
                  <h2 className="text-base font-bold tracking-tight text-[var(--text)] truncate leading-snug">
                    {bottomOverride.dropUpTitle ?? 'Detail Estimasi'}
                  </h2>
                  {bottomOverride.dropUpSubtitle && (
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {bottomOverride.dropUpSubtitle}
                    </p>
                  )}
                </div>
                <IconButton
                  onClick={() => setIsDropUpOpen(false)}
                  aria-label="Tutup rincian estimasi"
                  variant="ghost"
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </div>

              <div className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4">
                {bottomOverride.renderDropUp?.()}
              </div>
            </div>
          </>
        )}

        <nav
          aria-label="Aksi pembelian dan konsultasi produk"
          data-testid="bottom-nav-product-detail"
          className="relative z-20 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
        >
          <Container className="py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2.5">
              {hasProductDropUp ? (
                <button
                  type="button"
                  data-testid="mobile-bottom-estimate-toggle"
                  aria-expanded={isDropUpOpen}
                  aria-controls={dropUpId}
                  aria-haspopup="dialog"
                  aria-label={
                    isDropUpOpen ? 'Tutup rincian estimasi' : 'Lihat rincian estimasi'
                  }
                  onClick={() => setIsDropUpOpen((prev) => !prev)}
                  className="min-w-0 flex-1 text-left rounded-[var(--radius-sm)] py-0.5 -my-0.5 transition-colors hover:opacity-85 cursor-pointer"
                >
                  {priceSummaryContent}
                </button>
              ) : (
                <div className="min-w-0 flex-1">{priceSummaryContent}</div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <div
                  role="group"
                  aria-label="Jumlah unit"
                  className="h-9 w-24 shrink-0 inline-flex items-center justify-between border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]"
                >
                  <button
                    type="button"
                    aria-label="Kurangi jumlah produk"
                    disabled={
                      bottomOverride.canDecreaseQuantity === false || bottomOverride.quantity <= 1
                    }
                    onClick={bottomOverride.onDecreaseQuantity}
                    className="inline-flex items-center justify-center w-8 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span
                    data-testid="mobile-bottom-qty"
                    aria-label={`Jumlah unit: ${bottomOverride.quantity}`}
                    className="flex-1 text-center text-xs font-semibold tabular-nums text-[var(--text)]"
                  >
                    {bottomOverride.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah produk"
                    disabled={bottomOverride.canIncreaseQuantity === false}
                    onClick={bottomOverride.onIncreaseQuantity}
                    className="inline-flex items-center justify-center w-8 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-r-[var(--radius-md)] cursor-pointer"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={bottomOverride.primaryLabel ?? 'Tambah ke Keranjang'}
                  onClick={() => {
                    if (isDropUpOpen) {
                      setIsDropUpOpen(false);
                    }
                    bottomOverride.onPrimaryAction();
                  }}
                  data-testid="mobile-bottom-add-now"
                  className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] transition-colors duration-150 cursor-pointer"
                >
                  <CartPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>

            <a
              href={bottomOverride.consultationHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => bottomOverride.onConsultationAction?.()}
              aria-label="Konsultasi via WhatsApp"
              data-testid="mobile-bottom-consultation"
              className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[var(--radius-md)] border border-transparent bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-medium text-[var(--accent-contrast)] transition-colors duration-150 whitespace-nowrap"
            >
              <Headset className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{bottomOverride.consultationLabel ?? 'Konsultasi'}</span>
            </a>
          </Container>
        </nav>
      </div>
    );
  }

  if (!showBottomNav || isSettingsRoute) return null;

  return (
    <>
      <InformasiBottomSheet
        isOpen={isInfoMenuOpen}
        currentPathname={location.pathname}
        onSelectItem={() => setIsInfoMenuOpen(false)}
        onClose={() => setIsInfoMenuOpen(false)}
      />

      <nav
        aria-label="Navigasi utama seluler"
        className="md:hidden shrink-0 relative z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] print:hidden"
      >
        <Container>
          <ul className={['grid grid-cols-5', showBottomNavLabels ? 'h-15' : 'h-13'].join(' ')}>
            <li className="h-full">
              <MobileNavItem to="/" label="Beranda" end icon={Home} showLabel={showBottomNavLabels} />
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/portofolio"
                label="Portofolio"
                end={false}
                icon={Briefcase}
                showLabel={showBottomNavLabels}
              />
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/produk"
                label="Produk"
                end={false}
                icon={LayoutGrid}
                showLabel={showBottomNavLabels}
              />
            </li>
            <li className="h-full">
              <button
                type="button"
                aria-label="Informasi"
                aria-haspopup="dialog"
                aria-expanded={isInfoMenuOpen}
                onClick={() => setIsInfoMenuOpen((prev) => !prev)}
                className={[
                  'relative h-full w-full flex flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-150 cursor-pointer',
                  infoActive || isInfoMenuOpen
                    ? 'text-[var(--text)] font-semibold'
                    : 'text-[var(--text-muted)] font-normal hover:text-[var(--text)]',
                ].join(' ')}
              >
                <BookOpen
                  className={showBottomNavLabels ? 'size-4 shrink-0' : 'size-5 shrink-0'}
                  aria-hidden="true"
                />
                {showBottomNavLabels && (
                  <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">
                    Informasi
                  </span>
                )}
              </button>
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/tentang"
                label="Tentang"
                end={false}
                icon={Info}
                showLabel={showBottomNavLabels}
              />
            </li>
          </ul>
        </Container>
      </nav>
    </>
  );
}

import { Suspense, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';
import { BUSINESS_CONFIG } from '../../lib/business-config';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useAnalyticsStore } from '../../store/analytics-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import { useIsMobileViewport } from '../../hooks/use-mobile-viewport';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import {
  shouldResetScrollOnLocationChange,
  type ScrollRouteSnapshot,
} from '../../lib/scroll-navigation';
import { AdaptiveNavProvider, useAdaptiveNav } from './adaptive-nav-context';
import { AppInstallBanner } from './app-install-banner';
import { Button } from '../ui/button';
import { RouteLoadingFallback } from '../ui/route-loading-fallback';
import { Container } from './container';
import { NavigasiBottom } from './navigasi-bottom';
import { NavigasiHeader } from './navigasi-header';
import {
  OrderBottomActionProvider,
  useOrderBottomAction,
} from './order-bottom-action';
import { SidebarCart } from './sidebar-cart';
import { SurveyRequestModal } from './survey-request-modal';
import { UserProfileModal } from './user-profile-modal';
import { SainAiWidget } from '../../sain-ai';

let lastRecordedVisit: { path: string; at: number } | null = null;

function resolveSafeSocialUrl(url: string | undefined, fallback: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fallback to default safe HTTPS URL
  }
  return fallback;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.6V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H7.7v3h2.6v8h3.2z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M19.3 6.9a4.6 4.6 0 0 1-3.3-1.4 4.6 4.6 0 0 1-1.3-3.1h-3.1v13.1a2.7 2.7 0 0 1-2.7 2.6 2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 2.7-2.7c.3 0 .6 0 .8.1V9.6a5.8 5.8 0 0 0-.8-.1 5.8 5.8 0 0 0-5.8 5.8 5.8 5.8 0 0 0 5.8 5.8 5.8 5.8 0 0 0 5.8-5.8V8.8a7.7 7.7 0 0 0 4.6 1.5V6.9z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M9.5 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.6c-.1.1-.1.3 0 .5.4.8 1.2 1.6 2 2 .2.1.4.1.5 0l.6-.5c.2-.2.4-.2.6-.1l1.7.7c.3.1.4.3.4.5v.5c0 .3 0 .5-.4.7-.5.3-1.5.5-2.6.1-1.3-.4-2.8-1.4-4-2.6-1.2-1.2-2.2-2.7-2.6-4-.4-1.1-.2-2.1.1-2.6z" />
    </svg>
  );
}

function AppShellLayout() {
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousLocationRef = useRef<ScrollRouteSnapshot | null>(null);
  const { action: orderBottomAction } = useOrderBottomAction();
  const { adaptiveNav } = useAdaptiveNav();
  const desktopRightSidebar = adaptiveNav?.desktopRightSidebar ?? null;
  const isDesktopSidebarSplit = Boolean(adaptiveNav?.header?.desktopSidebarSplit);
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const autoScrollToTop = usePublicPreferencesStore((state) => state.navigation.autoScrollToTop);
  const showFooter = usePublicPreferencesStore((state) => state.navigation.showFooter);
  const showFooterMobile = usePublicPreferencesStore((state) => state.navigation.showFooterMobile);
  const isMobileViewport = useIsMobileViewport();
  const shouldShowFooter = isMobileViewport ? showFooterMobile : showFooter;
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isOrderRoute = normalizedPath === '/pesanan' || normalizedPath === '/keranjang';

  useEffect(() => {
    const now = Date.now();
    if (
      !lastRecordedVisit ||
      lastRecordedVisit.path !== normalizedPath ||
      now - lastRecordedVisit.at > 1500
    ) {
      lastRecordedVisit = { path: normalizedPath, at: now };
      useAnalyticsStore.getState().recordPageVisit(normalizedPath);
    }
  }, [normalizedPath]);

  useEffect(() => {
    const currentSnapshot: ScrollRouteSnapshot = {
      pathname: location.pathname,
      search: location.search,
    };

    if (
      autoScrollToTop &&
      shouldResetScrollOnLocationChange(previousLocationRef.current, currentSnapshot)
    ) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }

    previousLocationRef.current = currentSnapshot;
  }, [location.pathname, location.search, autoScrollToTop]);

  const footerInner = (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Identitas Studio, Sosial Mobile Icon-Only, & Lokasi */}
        <div
          className={[
            isDesktopSidebarSplit ? 'lg:col-span-6' : 'lg:col-span-5',
            'space-y-3 text-center lg:text-left',
          ].join(' ')}
        >
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-center lg:gap-2.5">
            <img
              src={lightLogoSrc}
              alt=""
              aria-hidden="true"
              className="size-8 lg:size-7 shrink-0 object-contain dark:hidden"
            />
            <img
              src={darkLogoSrc}
              alt=""
              aria-hidden="true"
              className="hidden size-8 lg:size-7 shrink-0 object-contain dark:block"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold text-[var(--text)] truncate">
                {businessConfig.namaMerek}
              </p>
              <p className="text-[11px] font-normal text-[var(--text-muted)] truncate">
                Interior Design &amp; Building
              </p>
            </div>
          </div>

          {!isDesktopSidebarSplit && (
            <nav
              aria-label="Kontak WhatsApp dan media sosial resmi Shansus Dzar Indonesia"
              className="flex lg:hidden items-center justify-center gap-3 pt-0.5"
            >
              <a
                href={buildDynamicWhatsAppUrl(businessConfig)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp resmi ${businessConfig.namaMerek}`}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <WhatsAppIcon />
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlInstagram,
                  BUSINESS_CONFIG.mediaSosial!.urlInstagram
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <InstagramIcon />
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlFacebook,
                  BUSINESS_CONFIG.mediaSosial!.urlFacebook
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <FacebookIcon />
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlTiktok,
                  BUSINESS_CONFIG.mediaSosial!.urlTiktok
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <TikTokIcon />
              </a>
            </nav>
          )}

          <div className="space-y-1 text-xs leading-relaxed max-w-md mx-auto lg:mx-0">
            <p>{businessConfig.alamat.alamatLengkap}</p>
            <p>{operationalInfo.jamOperasional}</p>
          </div>
        </div>

        {/* Informasi & Legal */}
        <div
          className={[
            'lg:col-span-3 space-y-2.5 text-center lg:text-left',
            isDesktopSidebarSplit ? 'hidden lg:block' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Informasi &amp; Legal
          </p>
          <nav
            aria-label="Tautan kepatuhan dan informasi resmi"
            className={
              isDesktopSidebarSplit
                ? 'flex flex-col gap-y-1.5 text-xs items-start'
                : 'grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-1.5 text-xs justify-items-center lg:justify-items-start max-w-sm mx-auto lg:mx-0 lg:max-w-none'
            }
          >
            <Link
              to="/faq"
              className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
            >
              Tanya Kita
            </Link>
            <Link
              to="/kebijakan-privasi"
              className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
            >
              Kebijakan Privasi
            </Link>
            <Link
              to="/syarat-ketentuan"
              className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
            >
              Syarat &amp; Ketentuan
            </Link>
            <Link
              to="/keamanan-kepatuhan"
              className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
            >
              Keamanan &amp; Kepatuhan
            </Link>
          </nav>
        </div>

        {isDesktopSidebarSplit ? (
          <>
            {/* Mobile < lg on split route: Informasi & Legal | Kontak & Sosial bersebelahan dalam format daftar teks bersih tanpa ikon */}
            <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto w-full lg:hidden text-left">
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Informasi &amp; Legal
                </p>
                <nav
                  aria-label="Tautan kepatuhan dan informasi resmi seluler"
                  className="flex flex-col gap-y-1.5 text-xs"
                >
                  <Link
                    to="/faq"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Tanya Kita
                  </Link>
                  <Link
                    to="/kebijakan-privasi"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Kebijakan Privasi
                  </Link>
                  <Link
                    to="/syarat-ketentuan"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Syarat &amp; Ketentuan
                  </Link>
                  <Link
                    to="/keamanan-kepatuhan"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Keamanan &amp; Kepatuhan
                  </Link>
                </nav>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Kontak &amp; Sosial
                </p>
                <nav
                  aria-label="Kontak WhatsApp dan media sosial resmi seluler"
                  className="flex flex-col gap-y-1.5 text-xs"
                >
                  <a
                    href={buildDynamicWhatsAppUrl(businessConfig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={resolveSafeSocialUrl(
                      businessConfig.mediaSosial?.urlInstagram,
                      BUSINESS_CONFIG.mediaSosial!.urlInstagram
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Instagram
                  </a>
                  <a
                    href={resolveSafeSocialUrl(
                      businessConfig.mediaSosial?.urlFacebook,
                      BUSINESS_CONFIG.mediaSosial!.urlFacebook
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    Facebook
                  </a>
                  <a
                    href={resolveSafeSocialUrl(
                      businessConfig.mediaSosial?.urlTiktok,
                      BUSINESS_CONFIG.mediaSosial!.urlTiktok
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                  >
                    TikTok
                  </a>
                </nav>
              </div>
            </div>

            {/* Desktop lg+: Kontak & Sosial daftar teks vertikal polos tanpa ikon di area kiri */}
            <div className="hidden lg:block lg:col-span-3 space-y-2.5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Kontak &amp; Sosial
              </p>
              <nav
                aria-label="Kontak WhatsApp dan media sosial resmi Shansus Dzar Indonesia"
                className="flex flex-col gap-y-1.5 text-xs items-start"
              >
                <a
                  href={buildDynamicWhatsAppUrl(businessConfig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp resmi ${businessConfig.namaMerek}`}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  WhatsApp
                </a>
                <a
                  href={resolveSafeSocialUrl(
                    businessConfig.mediaSosial?.urlInstagram,
                    BUSINESS_CONFIG.mediaSosial!.urlInstagram
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram resmi Shansus Dzar Indonesia"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  Instagram
                </a>
                <a
                  href={resolveSafeSocialUrl(
                    businessConfig.mediaSosial?.urlFacebook,
                    BUSINESS_CONFIG.mediaSosial!.urlFacebook
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook resmi Shansus Dzar Indonesia"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  Facebook
                </a>
                <a
                  href={resolveSafeSocialUrl(
                    businessConfig.mediaSosial?.urlTiktok,
                    BUSINESS_CONFIG.mediaSosial!.urlTiktok
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok resmi Shansus Dzar Indonesia"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  TikTok
                </a>
              </nav>
            </div>
          </>
        ) : (
          /* Kontak & Media Sosial Resmi (Desktop Standar) */
          <div className="hidden lg:block lg:col-span-4 space-y-2.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Kontak &amp; Sosial
            </p>
            <nav
              aria-label="Kontak WhatsApp dan media sosial resmi Shansus Dzar Indonesia"
              className="grid grid-cols-2 gap-2"
            >
              <a
                href={buildDynamicWhatsAppUrl(businessConfig)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp resmi ${businessConfig.namaMerek}`}
                className="inline-flex items-center justify-start gap-2 min-h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors min-w-0"
              >
                <WhatsAppIcon />
                <span className="truncate">WhatsApp</span>
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlInstagram,
                  BUSINESS_CONFIG.mediaSosial!.urlInstagram
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-start gap-2 min-h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors min-w-0"
              >
                <InstagramIcon />
                <span className="truncate">Instagram</span>
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlFacebook,
                  BUSINESS_CONFIG.mediaSosial!.urlFacebook
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-start gap-2 min-h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors min-w-0"
              >
                <FacebookIcon />
                <span className="truncate">Facebook</span>
              </a>

              <a
                href={resolveSafeSocialUrl(
                  businessConfig.mediaSosial?.urlTiktok,
                  BUSINESS_CONFIG.mediaSosial!.urlTiktok
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok resmi Shansus Dzar Indonesia"
                className="inline-flex items-center justify-start gap-2 min-h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors min-w-0"
              >
                <TikTokIcon />
                <span className="truncate">TikTok</span>
              </a>
            </nav>
          </div>
        )}
      </div>

      <div
        className={[
          'pt-4 text-center lg:text-left text-[11px]',
          isDesktopSidebarSplit ? '' : 'border-t border-[var(--border)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p>© {new Date().getFullYear()} {businessConfig.namaMerek}. Seluruh hak dilindungi.</p>
      </div>
    </>
  );

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden print:h-auto print:overflow-visible flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
          document.getElementById('main-content')?.focus({ preventScroll: true });
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-[var(--radius-md)] focus:bg-[var(--surface)] focus:text-[var(--text)] focus:border focus:border-[var(--border-strong)] focus:shadow-[var(--shadow-md)] focus:text-xs focus:font-semibold"
      >
        Langsung ke konten utama
      </a>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          <NavigasiHeader />
          <AppInstallBanner />

          <div
            ref={scrollContainerRef}
            id="app-scroll-container"
            data-app-scroll-container="true"
            className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain print:overflow-visible flex flex-col"
          >
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 flex flex-col py-5 sm:py-9 outline-none"
            >
              {isDesktopSidebarSplit ? (
                <div className="flex-1 flex flex-col w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[calc(3vw+2rem)] lg:pr-[max(2.5rem,env(safe-area-inset-right))] xl:pr-[max(3rem,env(safe-area-inset-right))]">
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Outlet />
                  </Suspense>
                </div>
              ) : (
                <Container className="flex-1 flex flex-col">
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Outlet />
                  </Suspense>
                </Container>
              )}
            </main>

            {shouldShowFooter && (
              <footer
                data-testid="app-footer"
                className={[
                  'shrink-0 print:hidden',
                  isDesktopSidebarSplit
                    ? 'bg-[var(--surface)] lg:bg-[var(--bg)]'
                    : 'border-t border-[var(--border)] bg-[var(--surface)]',
                ].join(' ')}
              >
                {isDesktopSidebarSplit ? (
                  <div className="w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[calc(3vw+2rem)] lg:pr-[max(2.5rem,env(safe-area-inset-right))] xl:pr-[max(3rem,env(safe-area-inset-right))] py-6 sm:py-7 space-y-5 text-xs text-[var(--text-muted)]">
                    {footerInner}
                  </div>
                ) : (
                  <Container className="py-6 sm:py-7 space-y-5 text-xs text-[var(--text-muted)]">
                    {footerInner}
                  </Container>
                )}
              </footer>
            )}
          </div>
        </div>

        {isDesktopSidebarSplit && desktopRightSidebar && (
          <aside
            aria-labelledby="related-news-heading"
            data-testid="berita-related-sidebar"
            className="hidden lg:flex lg:flex-col lg:w-[360px] xl:w-[400px] 2xl:w-[420px] shrink-0 h-full overflow-y-auto app-scroll-region bg-transparent print:hidden"
          >
            {desktopRightSidebar}
          </aside>
        )}
      </div>


      {!isOrderRoute ? (
        <NavigasiBottom />
      ) : (
        orderBottomAction && (
          <div
            role="region"
            aria-label={orderBottomAction.label}
            className="shrink-0 relative z-40 border-t border-[var(--border)] bg-[var(--surface)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden"
          >
            <Container>
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={orderBottomAction.disabled}
                  aria-busy={orderBottomAction.isBusy}
                  onClick={orderBottomAction.onSubmit}
                  className="flex-1"
                >
                  {orderBottomAction.label}
                </Button>
                {orderBottomAction.secondaryAction && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={orderBottomAction.secondaryAction.disabled}
                    aria-busy={orderBottomAction.secondaryAction.isBusy}
                    aria-label={orderBottomAction.secondaryAction.ariaLabel}
                    title={orderBottomAction.secondaryAction.ariaLabel}
                    onClick={orderBottomAction.secondaryAction.onClick}
                    className="!px-0 w-12 shrink-0"
                  >
                    <Printer className="size-5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </Container>
          </div>
        )
      )}
      <SidebarCart />
      <UserProfileModal />
      <SurveyRequestModal />
      <SainAiWidget />
    </div>
  );
}

export function AppShell() {
  return (
    <AdaptiveNavProvider>
      <OrderBottomActionProvider>
        <AppShellLayout />
      </OrderBottomActionProvider>
    </AdaptiveNavProvider>
  );
}

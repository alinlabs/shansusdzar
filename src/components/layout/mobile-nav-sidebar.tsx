import { useEffect, useRef } from 'react';
import {
  Briefcase,
  Compass,
  Download,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  LogIn,
  MessagesSquare,
  Newspaper,
  Ruler,
  Settings,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { useAppInstall } from '../../hooks/use-app-install';
import { shouldShowManualInstallAction } from '../../lib/app-install';
import { useSainAiStore } from '../../sain-ai';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import { IconButton } from '../ui/icon-button';
import { useModalMotionState } from '../ui/modal';

interface MobileNavSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIMARY_LINKS = [
  { to: '/', label: 'Beranda', end: true, icon: Home },
  { to: '/produk', label: 'Produk Furniture', end: true, icon: LayoutGrid },
  { to: '/produk/custom', label: 'Custom Interior', end: false, icon: Ruler },
  { to: '/portofolio', label: 'Portofolio Proyek', end: false, icon: Briefcase },
  { to: '/tentang', label: 'Tentang Studio', end: false, icon: Info },
];

const INFO_LINKS = [
  { to: '/berita', label: 'Berita', badge: 'Terbaru', icon: Newspaper },
  { to: '/tips-interior', label: 'Tips Interior', icon: Compass },
  { to: '/faq', label: 'Tanya Kita', icon: HelpCircle },
];

export function MobileNavSidebar({ isOpen, onClose }: MobileNavSidebarProps) {
  const location = useLocation();
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const openSainAi = useSainAiStore((state) => state.openChat);
  const { isStandalone, triggerInstall } = useAppInstall(location.pathname);
  const canShowInstallButton = shouldShowManualInstallAction({
    isStandalone,
    isAdminRoute: location.pathname.startsWith('/admin'),
  });
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  const { isMounted, motionState } = useModalMotionState(isOpen);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isMounted) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted]);

  if (!isMounted) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
      <div
        aria-hidden="true"
        data-state={motionState}
        onClick={onClose}
        className="fixed inset-0 modal-backdrop-motion"
      />

      <aside
        id="mobile-nav-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi seluler"
        data-state={motionState}
        className="relative z-10 w-[min(78vw,17.5rem)] h-full pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] border-r border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] flex flex-col modal-drawer-left-motion"
      >
        {/* Header Sidebar: Logo & Nama Web */}
        <div className="h-16 shrink-0 px-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
          <Link
            to="/"
            onClick={onClose}
            className="inline-flex items-center gap-2.5 min-w-0 text-[var(--text)]"
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
              <span className="text-[10px] font-light text-[var(--text-muted)] truncate">
                Interior Design &amp; Building
              </span>
            </span>
          </Link>
          <IconButton aria-label="Tutup menu navigasi" variant="ghost" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>

        {/* Konten Navigasi Utama */}
        <div
          data-scroll-side="left"
          className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-4 space-y-6"
        >
          <nav aria-label="Menu utama seluler" className="space-y-1">
            <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
              Menu Utama
            </p>
            {PRIMARY_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onPointerDown={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors',
                      isActive
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                        : 'text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
                    ].join(' ')
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <nav aria-label="Pusat informasi seluler" className="space-y-1 pt-4 border-t border-[var(--border)]">
            <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
              Pusat Informasi
            </p>
            {INFO_LINKS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onPointerDown={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                  onClick={onClose}
                  className={[
                    'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors',
                    isActive
                      ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
                  ].join(' ')}
                >
                  <Icon className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-red-600 text-white text-[10px] font-semibold leading-none shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              data-testid="sidebar-sain-ai-trigger"
              onClick={() => {
                onClose();
                openSainAi();
              }}
              className="w-full flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
            >
              <MessagesSquare className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="flex-1 truncate">Sain Ai</span>
            </button>
          </nav>

          <nav aria-label="Pengaturan seluler" className="space-y-1 pt-4 border-t border-[var(--border)]">
            <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
              Preferensi
            </p>
            <NavLink
              to="/pengaturan"
              onPointerDown={() => prefetchRoute('/pengaturan')}
              onFocus={() => prefetchRoute('/pengaturan')}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
                ].join(' ')
              }
            >
              <Settings className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Pengaturan</span>
            </NavLink>
            {canShowInstallButton && (
              <button
                type="button"
                data-testid="sidebar-install-app"
                onClick={() => {
                  onClose();
                  void triggerInstall();
                }}
                className="w-full flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors text-left cursor-pointer"
              >
                <Download className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="truncate">Install Aplikasi</span>
              </button>
            )}
          </nav>

          {/* Akses Login Panel Admin */}
          <div className="space-y-2 pt-4 border-t border-[var(--border)]">
            <p className="px-3 text-[11px] font-medium text-[var(--text-muted)]">
              Panel Pengelola
            </p>
            <Link
              to="/admin/login"
              onClick={onClose}
              className="flex items-center justify-between gap-3 min-h-12 px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <LogIn className="size-4 shrink-0 text-[var(--text)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)] leading-tight">
                    Masuk Panel Admin
                  </span>
                  <span className="block text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    Login pengelola &amp; staf studio
                  </span>
                </span>
              </span>
            </Link>
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="shrink-0 px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-[var(--border)] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <Link to="/kebijakan-privasi" onClick={onClose} className="hover:text-[var(--text)] hover:underline whitespace-nowrap">
            Privasi
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/syarat-ketentuan" onClick={onClose} className="hover:text-[var(--text)] hover:underline whitespace-nowrap">
            Ketentuan
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/keamanan-kepatuhan" onClick={onClose} className="hover:text-[var(--text)] hover:underline whitespace-nowrap">
            Keamanan
          </Link>
        </div>
      </aside>
    </div>
  );
}

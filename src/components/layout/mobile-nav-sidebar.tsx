import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Compass,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  LogIn,
  Newspaper,
  Ruler,
  Settings,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useSiteContentStore } from '../../store/site-content-store';

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
  { to: '/berita', label: 'Berita', icon: Newspaper },
  { to: '/tips-interior', label: 'Tips Interior', icon: Compass },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
];

const SIDEBAR_ANIMATION_MS = 250;

export function MobileNavSidebar({ isOpen, onClose }: MobileNavSidebarProps) {
  const location = useLocation();
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      let raf1 = 0;
      let raf2 = 0;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
    }, SIDEBAR_ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

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

  const motionState = isVisible ? 'open' : 'closed';

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
        className={[
          'relative z-10 w-[min(74vw,16.5rem)] h-full border-r border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] flex flex-col',
          'transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
          isVisible ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        ].join(' ')}
      >
        {/* Header Sidebar: Logo & Nama Web */}
        <div className="h-16 shrink-0 px-4 border-b border-[var(--border)] flex items-center">
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
                  onClick={onClose}
                  className={[
                    'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors',
                    isActive
                      ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
                  ].join(' ')}
                >
                  <Icon className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <nav aria-label="Pengaturan seluler" className="space-y-1 pt-4 border-t border-[var(--border)]">
            <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
              Preferensi
            </p>
            <NavLink
              to="/pengaturan"
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
          </nav>

          {/* Akses Login Panel Admin */}
          <div className="space-y-2 pt-4 border-t border-[var(--border)]">
            <p className="px-3 text-[11px] font-medium text-[var(--text-muted)]">
              Akun &amp; Pengelola
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

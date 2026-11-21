import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, Compass, HelpCircle, Newspaper, X } from 'lucide-react';
import { Link } from 'react-router';

export interface InformasiMenuItem {
  to: string;
  label: string;
  subtitle: string;
  icon: typeof Newspaper;
}

export const INFORMASI_MENU_ITEMS: InformasiMenuItem[] = [
  {
    to: '/berita',
    label: 'Berita',
    subtitle: 'Publikasi kabar workshop, proyek, dan artikel terbaru Shansusdzar.',
    icon: Newspaper,
  },
  {
    to: '/tips-interior',
    label: 'Tips Interior',
    subtitle: 'Panduan penataan ruangan, perbandingan material papan, dan finishing/laminasi HPL.',
    icon: Compass,
  },
  {
    to: '/faq',
    label: 'FAQ',
    subtitle: 'Tanya jawab seputar survei lapangan, produksi, pembayaran, dan garansi.',
    icon: HelpCircle,
  },
];

export function isInformasiRouteActive(pathname: string): boolean {
  return (
    pathname.startsWith('/berita') ||
    pathname.startsWith('/tips-interior') ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/informasi')
  );
}

interface InformasiPopupContentProps {
  currentPathname: string;
  onSelectItem: () => void;
  variant: 'desktop' | 'mobile';
  onClose: () => void;
}

export function InformasiNavPopup({
  currentPathname,
  onSelectItem,
  variant,
  onClose,
}: InformasiPopupContentProps) {
  if (variant === 'mobile') {
    return (
      <InformasiBottomSheet
        isOpen
        currentPathname={currentPathname}
        onSelectItem={onSelectItem}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      role="menu"
      aria-label="Pilihan halaman informasi"
      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+0.75rem)] w-80 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)] p-2 z-50"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-[var(--border)] mb-1.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text)]">Pusat Informasi</p>
          <p className="text-[11px] text-[var(--text-muted)]">Pilih halaman yang ingin dibuka</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup menu informasi"
          className="inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1">
        {INFORMASI_MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={onSelectItem}
              className={[
                'group flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] transition-colors',
                isActive
                  ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                  : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/70',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border shrink-0 mt-0.5 transition-colors',
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)] group-hover:text-[var(--text)]',
                ].join(' ')}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>

              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold leading-none">{item.label}</span>
                  <ArrowUpRight
                    className="size-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-hidden="true"
                  />
                </span>
                <span className="block mt-1 text-xs text-[var(--text-muted)] leading-snug">
                  {item.subtitle}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 pt-2 px-2.5 border-t border-[var(--border)] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <Link
          to="/kebijakan-privasi"
          onClick={onSelectItem}
          className="hover:text-[var(--text)] hover:underline whitespace-nowrap"
        >
          Kebijakan Privasi
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/syarat-ketentuan"
          onClick={onSelectItem}
          className="hover:text-[var(--text)] hover:underline whitespace-nowrap"
        >
          Syarat &amp; Ketentuan
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/keamanan-kepatuhan"
          onClick={onSelectItem}
          className="hover:text-[var(--text)] hover:underline whitespace-nowrap"
        >
          Keamanan
        </Link>
      </div>
    </div>
  );
}

interface InformasiBottomSheetProps {
  isOpen: boolean;
  currentPathname: string;
  onSelectItem: () => void;
  onClose: () => void;
}

const SHEET_ANIMATION_MS = 250;

export function InformasiBottomSheet({
  isOpen,
  currentPathname,
  onSelectItem,
  onClose,
}: InformasiBottomSheetProps) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
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
    }, SHEET_ANIMATION_MS);

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
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center print:hidden">
      <div
        aria-hidden="true"
        data-state={motionState}
        onClick={onClose}
        className="fixed inset-0 modal-backdrop-motion"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pusat Informasi"
        data-state={motionState}
        className="relative z-10 w-full max-h-[88dvh] flex flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-x border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] modal-panel-motion"
      >
        <div className="shrink-0 px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">
                Pusat Informasi
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pilih panduan atau publikasi studio yang ingin dibuka
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel informasi"
              className="inline-flex items-center justify-center min-h-11 min-w-11 -mr-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer shrink-0"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Daftar Menu Navigasi Utama */}
        <div className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          {INFORMASI_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onSelectItem}
                className={[
                  'flex items-center gap-3.5 min-h-[64px] px-3.5 py-3 rounded-[var(--radius-lg)] border transition-colors',
                  isActive
                    ? 'bg-[var(--surface-muted)] border-[var(--border-strong)] text-[var(--text)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)]/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border shrink-0 transition-colors',
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]',
                  ].join(' ')}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold leading-snug text-[var(--text)]">
                    {item.label}
                  </span>
                  <span className="block mt-0.5 text-xs text-[var(--text-muted)] leading-snug">
                    {item.subtitle}
                  </span>
                </span>

                <ChevronRight
                  className="size-4 text-[var(--text-muted)] shrink-0"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>

        {/* Footer Tautan Regulasi & Keamanan */}
        <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-[var(--border)] bg-[var(--surface-muted)]/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
          <Link
            to="/kebijakan-privasi"
            onClick={onSelectItem}
            className="py-1.5 text-[var(--text)] hover:underline whitespace-nowrap"
          >
            Kebijakan Privasi
          </Link>
          <Link
            to="/syarat-ketentuan"
            onClick={onSelectItem}
            className="py-1.5 text-[var(--text)] hover:underline whitespace-nowrap"
          >
            Syarat &amp; Ketentuan
          </Link>
          <Link
            to="/keamanan-kepatuhan"
            onClick={onSelectItem}
            className="py-1.5 text-[var(--text)] hover:underline whitespace-nowrap"
          >
            Keamanan
          </Link>
        </div>
      </div>
    </div>
  );
}

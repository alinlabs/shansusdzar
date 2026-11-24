import { useEffect, useRef } from 'react';
import { ChevronRight, Compass, HelpCircle, MessagesSquare, Newspaper, X } from 'lucide-react';
import { Link } from 'react-router';
import { useSainAiStore } from '../../sain-ai';
import { IconButton } from '../ui/icon-button';
import { useModalMotionState } from '../ui/modal';

export interface InformasiMenuItem {
  to: string;
  label: string;
  badge?: string;
  subtitle: string;
  icon: typeof Newspaper;
}

export const INFORMASI_MENU_ITEMS: InformasiMenuItem[] = [
  {
    to: '/berita',
    label: 'Berita',
    badge: 'Terbaru',
    subtitle: 'Kabar terbaru workshop, liputan proyek, dan pengumuman resmi studio.',
    icon: Newspaper,
  },
  {
    to: '/tips-interior',
    label: 'Tips Interior',
    subtitle: 'Panduan penataan ruangan, perbandingan material papan 18 mm, dan finishing HPL maupun Cat Duco.',
    icon: Compass,
  },
  {
    to: '/faq',
    label: 'Tanya Kita',
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
      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+0.75rem)] w-56 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)] p-1.5 z-50"
    >
      <div className="space-y-0.5">
        {INFORMASI_MENU_ITEMS.map((item) => {
          const isActive = currentPathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={onSelectItem}
              className={[
                'flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-[var(--surface-muted)] font-semibold text-[var(--text)]'
                  : 'font-normal text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]/70',
              ].join(' ')}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-red-600 text-white text-[10px] font-semibold leading-none shrink-0">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-[var(--border)]">
        <button
          type="button"
          role="menuitem"
          data-testid="desktop-info-sain-ai-trigger"
          onClick={() => {
            onSelectItem();
            useSainAiStore.getState().openChat();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors whitespace-nowrap text-left cursor-pointer"
        >
          <MessagesSquare className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span>Sain Ai</span>
        </button>
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

export function InformasiBottomSheet({
  isOpen,
  currentPathname,
  onSelectItem,
  onClose,
}: InformasiBottomSheetProps) {
  const { isMounted, motionState } = useModalMotionState(isOpen);
  const sheetRef = useRef<HTMLDivElement>(null);
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
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center pt-[env(safe-area-inset-top)] print:hidden">
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
        className="relative z-10 w-full max-h-[92dvh] flex flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-x border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] modal-panel-motion"
      >
        <div className="shrink-0 px-5 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)] truncate">
              Pusat Informasi
            </h2>
            <IconButton
              aria-label="Tutup panel informasi"
              variant="ghost"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        {/* Daftar Menu Navigasi Utama */}
        <div className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2">
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
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-[var(--text)] truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-red-600 text-white text-[10px] font-semibold leading-none shrink-0">
                        {item.badge}
                      </span>
                    )}
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

          <button
            type="button"
            data-testid="bottomsheet-sain-ai-trigger"
            onClick={() => {
              onClose();
              useSainAiStore.getState().openChat();
            }}
            className="w-full flex items-center gap-3.5 min-h-[64px] px-3.5 py-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]/60 transition-colors text-left cursor-pointer"
          >
            <span className="inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)] shrink-0">
              <MessagesSquare className="size-4.5" aria-hidden="true" />
            </span>

            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold leading-snug text-[var(--text)] truncate">
                Sain Ai
              </span>
              <span className="block mt-0.5 text-xs text-[var(--text-muted)] leading-snug">
                Sahabat Interior — Asisten data untuk tanya harga ukuran, perbandingan bahan 18 mm, dan jadwal survei.
              </span>
            </span>

            <ChevronRight
              className="size-4 text-[var(--text-muted)] shrink-0"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

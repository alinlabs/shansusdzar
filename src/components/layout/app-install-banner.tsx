import { Clock, Download, EyeOff, Smartphone, X } from 'lucide-react';
import { useLocation } from 'react-router';
import { useAppInstall } from '../../hooks/use-app-install';
import { buildInstallGuideSteps } from '../../lib/app-install';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useSiteContentStore } from '../../store/site-content-store';
import { Button } from '../ui/button';
import { Container } from './container';
import { Modal } from '../ui/modal';

export function AppInstallBanner() {
  const location = useLocation();
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const {
    showBanner,
    isIOS,
    openDismissOptions,
    dismissTemporarily,
    dismissPermanently,
    triggerInstall,
    isDismissChoiceOpen,
    setIsDismissChoiceOpen,
    isGuideOpen,
    setIsGuideOpen,
  } = useAppInstall(location.pathname);

  const iconSrc = useCachedMediaSrc('/pwa-192x192.png') ?? '/pwa-192x192.png';
  const guide = buildInstallGuideSteps(isIOS);

  return (
    <>
      {/* Floating menempel persis di bawah header (top-16) dengan tinggi ringkas agar tidak menutupi konten */}
      <div
        aria-live="polite"
        className="fixed inset-x-0 top-16 z-[35] overflow-hidden pointer-events-none print:hidden"
      >
        <aside
          aria-label="Ajakan install aplikasi"
          aria-hidden={!showBanner}
          className={[
            'border-b border-[var(--border-strong)] bg-[var(--surface-elevated)]/95 backdrop-blur-md shadow-[var(--shadow-sm)]',
            'transition-all duration-300 ease-[var(--ease-studio)]',
            showBanner
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-full opacity-0 pointer-events-none invisible',
          ].join(' ')}
        >
          <Container className="py-1.5 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                tabIndex={showBanner ? 0 : -1}
                onClick={openDismissOptions}
                aria-label="Tutup atau atur pengingat install aplikasi"
                className="inline-flex items-center justify-center size-7 -ml-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>

              <p className="text-xs leading-tight truncate min-w-0">
                <span className="font-semibold text-[var(--text)]">
                  Install Aplikasi {shortBrandName}
                </span>
                <span className="hidden sm:inline text-[var(--text-muted)]">
                  {' '}
                  — akses cepat langsung dari layar utama
                </span>
              </p>
            </div>

            <button
              type="button"
              tabIndex={showBanner ? 0 : -1}
              onClick={() => void triggerInstall()}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] text-xs font-semibold leading-none transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="size-3 shrink-0" aria-hidden="true" />
              <span>Install</span>
            </button>
          </Container>
        </aside>
      </div>

      {/* Modal (Desktop) / Bottom Sheet (Mobile) saat tombol X ditekan */}
      <Modal
        isOpen={isDismissChoiceOpen}
        onClose={() => setIsDismissChoiceOpen(false)}
        title="Install Aplikasi"
        description={`Pasang pintasan ${shortBrandName} ke layar utama atau atur kemunculan pemberitahuan ini.`}
        size="sm"
        headerLeading={
          <span className="inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent)] dark:bg-[#494641] overflow-hidden">
            <img
              src={iconSrc}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              className="size-full object-cover select-none"
            />
          </span>
        }
      >
        <div className="space-y-2.5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => void triggerInstall()}
            className="gap-2"
          >
            <Download className="size-4 shrink-0" aria-hidden="true" />
            <span>Install Sekarang</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={dismissTemporarily}
            className="gap-2"
          >
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            <span>Tutup Sementara</span>
          </Button>

          <button
            type="button"
            onClick={dismissPermanently}
            className="w-full min-h-11 px-4 py-2.5 rounded-[var(--radius-md)] border border-transparent text-xs sm:text-sm font-medium text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <EyeOff className="size-4 shrink-0" aria-hidden="true" />
            <span>Tutup, Jangan Tampilkan Lagi</span>
          </button>
        </div>
      </Modal>

      {/* Panduan langkah manual (Safari iOS atau peramban tanpa dialog otomatis) */}
      <Modal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={guide.title}
        description={guide.description}
        size="sm"
        headerLeading={
          <span className="inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]">
            <Smartphone className="size-4.5" aria-hidden="true" />
          </span>
        }
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="md" onClick={() => setIsGuideOpen(false)}>
              Mengerti
            </Button>
          </div>
        }
      >
        <ol className="space-y-3">
          {guide.steps.map((step, index) => (
            <li
              key={index}
              className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/40 text-sm text-[var(--text)] leading-relaxed"
            >
              <span className="inline-flex items-center justify-center size-6 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold tabular-nums shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}

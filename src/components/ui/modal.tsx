import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './icon-button';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'md:max-w-md',
  md: 'md:max-w-xl',
  lg: 'md:max-w-3xl',
  xl: 'md:max-w-4xl',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface ModalCustomHeaderProps {
  titleId: string;
  onClose: () => void;
  closeLabel: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  closeLabel?: string;
  headerLeading?: ReactNode;
  customHeader?: (props: ModalCustomHeaderProps) => ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  headerTone?: 'default' | 'brand';
}

export const MODAL_ANIMATION_MS = 250;

export function useModalMotionState(isOpen: boolean, durationMs = MODAL_ANIMATION_MS) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

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
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, durationMs]);

  return {
    isMounted,
    isVisible,
    motionState: (isVisible ? 'open' : 'closed') as 'open' | 'closed',
  };
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  closeLabel = 'Tutup dialog',
  headerLeading,
  customHeader,
  children,
  footer,
  panelClassName,
  headerTone = 'default',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { isMounted, motionState } = useModalMotionState(isOpen);

  const snapshotRef = useRef({
    title,
    description,
    size,
    closeLabel,
    headerLeading,
    customHeader,
    children,
    footer,
    panelClassName,
    headerTone,
  });

  if (isOpen) {
    snapshotRef.current = {
      title,
      description,
      size,
      closeLabel,
      headerLeading,
      customHeader,
      children,
      footer,
      panelClassName,
      headerTone,
    };
  }

  useEffect(() => {
    if (!isMounted) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        panel.focus();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.querySelector('[role="dialog"][aria-modal="false"]')) {
          return;
        }
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !panel.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isMounted]);

  if (!isMounted) return null;

  const active = snapshotRef.current;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pt-[env(safe-area-inset-top)] md:p-6">
      <div
        aria-hidden="true"
        data-state={motionState}
        onClick={onClose}
        className="fixed inset-0 modal-backdrop-motion"
      />

      {/* Desktop: centered dialog scaling 0<->1 (250ms). Mobile: bottom sheet sliding from/to bottom (250ms). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={active.description && !active.customHeader ? descriptionId : undefined}
        tabIndex={-1}
        data-state={motionState}
        className={[
          'relative z-10 w-full max-h-[92dvh] md:max-h-[88dvh] flex flex-col overflow-hidden',
          active.panelClassName ?? 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]',
          'border-t border-x border-b-0 md:border shadow-[var(--shadow-md)]',
          'rounded-t-[var(--radius-lg)] md:rounded-[var(--radius-lg)]',
          'modal-panel-motion',
          SIZE_CLASSES[active.size],
        ].join(' ')}
      >
        {active.customHeader ? (
          active.customHeader({
            titleId,
            onClose,
            closeLabel: active.closeLabel,
          })
        ) : (
          <div
            className={[
              'shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6 border-b',
              active.headerTone === 'brand'
                ? 'bg-[var(--accent)] border-[var(--accent-hover)] dark:bg-transparent dark:border-[var(--border)]'
                : 'border-[var(--border)]',
            ].join(' ')}
          >
            <div className="flex items-center gap-3 min-w-0">
              {active.headerLeading && <div className="shrink-0">{active.headerLeading}</div>}
              <div className="space-y-0.5 min-w-0">
                <h2
                  id={titleId}
                  className={[
                    'text-base font-semibold leading-snug',
                    active.headerTone === 'brand'
                      ? 'text-white dark:text-[var(--text)]'
                      : 'text-[var(--text)]',
                  ].join(' ')}
                >
                  {active.title}
                </h2>
                {active.description && (
                  <p
                    id={descriptionId}
                    className={[
                      'text-xs sm:text-sm',
                      active.headerTone === 'brand'
                        ? 'text-white/75 dark:text-[var(--text-muted)]'
                        : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {active.description}
                  </p>
                )}
              </div>
            </div>
            <IconButton
              aria-label={active.closeLabel}
              variant="ghost"
              onClick={onClose}
              className={
                active.headerTone === 'brand'
                  ? '!text-white hover:!bg-white/15 dark:!text-[var(--text)] dark:hover:!bg-[var(--surface-muted)]'
                  : ''
              }
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}

        <div
          className={[
            'app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 py-4 sm:px-6',
            active.footer ? '' : 'pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {active.children}
        </div>

        {active.footer && (
          <div className="px-5 py-4 sm:px-6 border-t border-[var(--border)] bg-[var(--surface)] pb-[max(1rem,env(safe-area-inset-bottom))]">
            {active.footer}
          </div>
        )}
      </div>
    </div>
  );
}

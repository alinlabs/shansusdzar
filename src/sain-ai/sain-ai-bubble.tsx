import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useAdaptiveNav } from '../components/layout/adaptive-nav-context';
import { useIsMobileViewport } from '../hooks/use-mobile-viewport';
import { usePublicPreferencesStore } from '../store/public-preferences-store';
import {
  resolveInitialBubbleVisibility,
  resolveNextBubbleTextTimer,
} from './bubble-scheduler';
import { useSainAiStore } from './sain-ai-store';

interface SainAiBubbleProps {
  isOpen: boolean;
  onOpen: () => void;
}

export function SainAiBubble({ isOpen, onOpen }: SainAiBubbleProps) {
  const location = useLocation();
  const { adaptiveNav } = useAdaptiveNav();
  const isMobileViewport = useIsMobileViewport();
  const showBottomNav = usePublicPreferencesStore((state) => state.navigation.showBottomNav);
  const isFloatingBubbleEnabled = useSainAiStore(
    (state) => state.isFloatingBubbleEnabled
  );
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isSettingsRoute =
    normalizedPath === '/pengaturan' || normalizedPath.startsWith('/pengaturan/');
  const isProductDetailBottom = adaptiveNav?.bottom?.type === 'product-detail';
  const hasBottomNavBar =
    Boolean(adaptiveNav?.bottom) || (showBottomNav && !isSettingsRoute);
  const isVisible = resolveInitialBubbleVisibility({
    isOpen,
    isMobileViewport,
    isBubbleEnabled: isFloatingBubbleEnabled,
  });

  const [isTextExpanded, setIsTextExpanded] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsTextExpanded(true);
      setIsPaused(false);
      return;
    }

    const decision = resolveNextBubbleTextTimer({
      isOpen,
      isBubbleEnabled: isFloatingBubbleEnabled,
      isTextExpanded,
      isPausedByPointerOrFocus: isPaused,
    });

    if (decision.delayMs === null) return;

    const timer = window.setTimeout(() => {
      setIsTextExpanded(decision.nextExpanded);
    }, decision.delayMs);

    return () => window.clearTimeout(timer);
  }, [isVisible, isOpen, isFloatingBubbleEnabled, isTextExpanded, isPaused]);

  if (!isVisible) return null;

  return (
    <div
      data-testid="sain-ai-floating-wrapper"
      data-bubble-visible="true"
      data-text-expanded={isTextExpanded ? 'true' : 'false'}
      data-viewport-mode={isMobileViewport ? 'mobile' : 'desktop'}
      className={[
        'fixed right-0 md:bottom-6 z-40 print:hidden',
        isProductDetailBottom
          ? 'bottom-[calc(8.25rem+env(safe-area-inset-bottom))]'
          : hasBottomNavBar
            ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))]',
      ].join(' ')}
    >
      <button
        type="button"
        data-testid="sain-ai-floating-trigger"
        aria-label="Yuk Tanya Sain Ai — Sahabat Interior"
        title="Yuk Tanya Sain Ai — Sahabat Interior"
        onClick={onOpen}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        className={[
          'group relative inline-flex items-center overflow-hidden',
          'pl-2 pr-2 py-1.5 md:pl-2.5 md:pr-2.5 md:py-2',
          'rounded-l-2xl rounded-r-none',
          'border border-r-0 border-[var(--border-strong)] bg-[var(--surface-elevated)]/95 backdrop-blur-md shadow-[var(--shadow-md)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          'transition-[transform,opacity,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'hover:border-[var(--text-subtle)] active:scale-[0.98] cursor-pointer select-none',
        ].join(' ')}
      >
        <img
          src="/maskot.webp"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="relative z-10 size-10 md:size-12 shrink-0 object-contain pointer-events-none select-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.22)]"
        />

        <span
          data-testid="sain-ai-floating-label"
          aria-hidden={!isTextExpanded}
          className={[
            'flex flex-col items-start text-left leading-none whitespace-nowrap overflow-hidden',
            'transition-[max-width,opacity,transform,margin,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            isTextExpanded
              ? 'max-w-[140px] opacity-100 translate-x-0 ml-2 md:ml-2.5 pr-1.5 md:pr-2'
              : 'max-w-0 opacity-0 translate-x-6 ml-0 pr-0',
          ].join(' ')}
        >
          <span className="text-[10px] md:text-[11px] font-light tracking-wide text-[var(--text-muted)] leading-none">
            Yuk Tanya
          </span>
          <span className="text-[15px] md:text-[17px] font-extrabold tracking-tight text-[var(--text)] leading-none mt-1">
            Sain Ai
          </span>
        </span>
      </button>
    </div>
  );
}

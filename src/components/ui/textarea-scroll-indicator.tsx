import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  computeFloatingThumbMetrics,
  computeScrollTopFromTrackY,
  type FloatingThumbMetrics,
} from '../../lib/floating-scrollbar';

export interface TextareaScrollIndicatorProps {
  targetRef: RefObject<HTMLTextAreaElement | null>;
  value?: unknown;
  isFocused?: boolean;
  topInsetClass?: string;
  bottomInsetClass?: string;
  rightInsetClass?: string;
  minThumbHeight?: number;
  edgeInset?: number;
  onScrollableChange?: (scrollable: boolean) => void;
}

const INITIAL_METRICS: FloatingThumbMetrics = {
  scrollable: false,
  thumbHeight: 0,
  thumbOffset: 0,
  progress: 0,
};

export function TextareaScrollIndicator({
  targetRef,
  value,
  isFocused = false,
  topInsetClass = 'top-2',
  bottomInsetClass = 'bottom-3.5',
  rightInsetClass = 'right-1.5',
  minThumbHeight = 24,
  edgeInset = 2,
  onScrollableChange,
}: TextareaScrollIndicatorProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const grabOffsetRatioRef = useRef(0.5);
  const lastScrollableRef = useRef(false);

  const [metrics, setMetrics] = useState<FloatingThumbMetrics>(INITIAL_METRICS);
  const [isDragging, setIsDragging] = useState(false);
  const [isRailHovered, setIsRailHovered] = useState(false);

  const syncMetrics = useCallback(() => {
    const target = targetRef.current;
    const rail = railRef.current;

    if (!target) {
      if (lastScrollableRef.current) {
        lastScrollableRef.current = false;
        onScrollableChange?.(false);
      }
      setMetrics(INITIAL_METRICS);
      return;
    }

    const railHeight = rail ? rail.getBoundingClientRect().height : Math.max(0, target.clientHeight - 20);
    const next = computeFloatingThumbMetrics({
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight,
      trackHeight: railHeight,
      minThumbHeight,
      edgeInset,
    });

    if (next.scrollable !== lastScrollableRef.current) {
      lastScrollableRef.current = next.scrollable;
      onScrollableChange?.(next.scrollable);
    }

    setMetrics((prev) => {
      if (
        prev.scrollable === next.scrollable &&
        prev.thumbHeight === next.thumbHeight &&
        Math.abs(prev.thumbOffset - next.thumbOffset) < 0.25
      ) {
        return prev;
      }
      return next;
    });
  }, [edgeInset, minThumbHeight, onScrollableChange, targetRef]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(syncMetrics);
    return () => window.cancelAnimationFrame(rafId);
  }, [syncMetrics, value]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const handleScroll = () => syncMetrics();
    target.addEventListener('scroll', handleScroll, { passive: true });
    target.addEventListener('input', handleScroll, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => syncMetrics());
      observer.observe(target);
      if (railRef.current) {
        observer.observe(railRef.current);
      }
    }

    return () => {
      target.removeEventListener('scroll', handleScroll);
      target.removeEventListener('input', handleScroll);
      observer?.disconnect();
    };
  }, [syncMetrics, targetRef]);

  const handleRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = targetRef.current;
    const rail = railRef.current;
    if (!target || !rail || !metrics.scrollable) return;

    event.preventDefault();
    const railRect = rail.getBoundingClientRect();
    const thumbRect = thumbRef.current?.getBoundingClientRect();

    if (
      thumbRect &&
      event.clientY >= thumbRect.top &&
      event.clientY <= thumbRect.bottom
    ) {
      grabOffsetRatioRef.current =
        (event.clientY - thumbRect.top) / Math.max(1, thumbRect.height);
    } else {
      grabOffsetRatioRef.current = 0.5;
      target.scrollTop = computeScrollTopFromTrackY({
        pointerY: event.clientY,
        trackTop: railRect.top,
        trackHeight: railRect.height,
        thumbHeight: metrics.thumbHeight,
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        grabOffsetRatio: 0.5,
        edgeInset,
      });
      syncMetrics();
    }

    draggingRef.current = true;
    setIsDragging(true);

    const handleDragMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const currentTarget = targetRef.current;
      const currentRail = railRef.current;
      if (!currentTarget || !currentRail) return;

      const latestRailRect = currentRail.getBoundingClientRect();
      const currentMetrics = computeFloatingThumbMetrics({
        scrollTop: currentTarget.scrollTop,
        scrollHeight: currentTarget.scrollHeight,
        clientHeight: currentTarget.clientHeight,
        trackHeight: latestRailRect.height,
        minThumbHeight,
        edgeInset,
      });

      currentTarget.scrollTop = computeScrollTopFromTrackY({
        pointerY: moveEvent.clientY,
        trackTop: latestRailRect.top,
        trackHeight: latestRailRect.height,
        thumbHeight: currentMetrics.thumbHeight,
        scrollHeight: currentTarget.scrollHeight,
        clientHeight: currentTarget.clientHeight,
        grabOffsetRatio: grabOffsetRatioRef.current,
        edgeInset,
      });
      syncMetrics();
    };

    const finishDrag = () => {
      draggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  const emphasized = isDragging || isRailHovered || isFocused;

  return (
    <div
      ref={railRef}
      aria-hidden="true"
      data-scrollable={metrics.scrollable ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      onPointerEnter={() => setIsRailHovered(true)}
      onPointerLeave={() => setIsRailHovered(false)}
      onPointerDown={handleRailPointerDown}
      className={[
        'absolute z-10 w-3 flex justify-center select-none touch-none transition-opacity duration-150',
        topInsetClass,
        bottomInsetClass,
        rightInsetClass,
        metrics.scrollable ? 'opacity-100 pointer-events-auto cursor-pointer' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <div
        className={[
          'h-full rounded-full transition-colors duration-150',
          emphasized ? 'w-[2px] bg-[var(--border-strong)]/90' : 'w-[1.5px] bg-[var(--border)]/80',
        ].join(' ')}
      />
      {metrics.scrollable && (
        <div
          ref={thumbRef}
          style={{
            height: `${metrics.thumbHeight}px`,
            transform: `translate3d(0, ${metrics.thumbOffset.toFixed(1)}px, 0)`,
          }}
          className={[
            'absolute top-0 rounded-full transition-[width,background-color] duration-150',
            isDragging
              ? 'w-[5px] bg-[var(--accent)] cursor-grabbing'
              : isRailHovered
                ? 'w-[5px] bg-[var(--accent)] cursor-grab'
                : isFocused
                  ? 'w-[4px] bg-[var(--text-muted)] cursor-grab'
                  : 'w-[3.5px] bg-[var(--text-subtle)]/80 cursor-grab',
          ].join(' ')}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import {
  computeFloatingThumbMetrics,
  computeScrollTopFromTrackY,
} from '../../lib/floating-scrollbar';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';

const RAIL_WIDTH_PX = 16;
const EDGE_HOVER_PROXIMITY_PX = 26;
const IDLE_HIDE_DELAY_MS = 950;
const EDGE_INSET_PX = 6;
const MIN_THUMB_HEIGHT_PX = 36;

type ScrollbarSide = 'left' | 'right';

function getScrollSide(el: HTMLElement): ScrollbarSide {
  return el.dataset.scrollSide === 'left' ? 'left' : 'right';
}

function isEligibleScrollElement(node: EventTarget | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  if (node.tagName === 'TEXTAREA') return false;
  if (!node.classList.contains('app-scroll-region')) return false;
  if (!node.isConnected) return false;
  if (node.closest('[data-state="closed"]') !== null) return false;
  if (node.closest('[aria-hidden="true"]') !== null) return false;
  if (node.scrollHeight <= node.clientHeight + 2) return false;
  if (node.getClientRects().length === 0) return false;

  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 24) return false;
  if (rect.right <= 8 || rect.left >= window.innerWidth - 8) return false;
  if (rect.bottom <= 8 || rect.top >= window.innerHeight - 8) return false;

  return true;
}

function getTopmostModalDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  for (let i = dialogs.length - 1; i >= 0; i -= 1) {
    const dialog = dialogs[i];
    if (dialog.getAttribute('data-state') === 'closed') continue;
    const rect = dialog.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.right > 8 && rect.left < window.innerWidth - 8) {
      return dialog;
    }
  }
  return null;
}

function isPointNearScrollEdge(
  el: HTMLElement,
  clientX: number,
  clientY: number
): boolean {
  const rect = el.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return false;
  const side = getScrollSide(el);
  if (side === 'left') {
    return clientX >= rect.left - 6 && clientX <= rect.left + EDGE_HOVER_PROXIMITY_PX;
  }
  return clientX >= rect.right - EDGE_HOVER_PROXIMITY_PX && clientX <= rect.right + 6;
}

function findEdgeHoveredScrollElement(
  clientX: number,
  clientY: number,
  eventTarget: EventTarget | null
): HTMLElement | null {
  const topDialog = getTopmostModalDialog();

  const targetEl = eventTarget instanceof Element ? eventTarget.closest('.app-scroll-region') : null;
  if (isEligibleScrollElement(targetEl)) {
    if ((!topDialog || topDialog.contains(targetEl)) && isPointNearScrollEdge(targetEl, clientX, clientY)) {
      return targetEl;
    }
  }

  const candidates = document.querySelectorAll<HTMLElement>('.app-scroll-region');
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const el = candidates[i];
    if (el === targetEl) continue;
    if (!isEligibleScrollElement(el)) continue;
    if (topDialog && !topDialog.contains(el)) continue;
    if (isPointNearScrollEdge(el, clientX, clientY)) {
      return el;
    }
  }

  return null;
}

export function FloatingScrollbarOverlay() {
  const location = useLocation();
  const showFloatingScrollbar = usePublicPreferencesStore(
    (state) => state.navigation.showFloatingScrollbar
  );
  const railRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const observedTargetRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const syncRafIdRef = useRef<number | null>(null);
  const pointerMoveRafIdRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const hoveringRailRef = useRef(false);
  const draggingRef = useRef(false);
  const grabOffsetRatioRef = useRef(0.5);
  const lastMetricsRef = useRef({ thumbHeight: MIN_THUMB_HEIGHT_PX, trackTop: 0, trackHeight: 0 });

  const disconnectTargetObserver = useCallback(() => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    observedTargetRef.current = null;
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hideIndicator = useCallback(
    (instant = false) => {
      clearHideTimer();
      disconnectTargetObserver();
      hoveringRailRef.current = false;
      draggingRef.current = false;
      const rail = railRef.current;
      if (!rail) return;
      rail.setAttribute('data-dragging', 'false');
      rail.setAttribute('data-instant-hide', instant ? 'true' : 'false');
      rail.setAttribute('data-visible', 'false');
      if (instant) {
        activeTargetRef.current = null;
      }
    },
    [clearHideTimer, disconnectTargetObserver]
  );

  const scheduleIdleHide = useCallback(() => {
    clearHideTimer();
    if (hoveringRailRef.current || draggingRef.current) return;
    hideTimerRef.current = window.setTimeout(() => {
      if (!hoveringRailRef.current && !draggingRef.current) {
        const rail = railRef.current;
        if (!rail) return;
        rail.setAttribute('data-instant-hide', 'false');
        rail.setAttribute('data-visible', 'false');
        disconnectTargetObserver();
      }
    }, IDLE_HIDE_DELAY_MS);
  }, [clearHideTimer, disconnectTargetObserver]);

  const syncGeometryNow = useCallback((): boolean => {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    const target = activeTargetRef.current;

    if (!rail || !thumb || !isEligibleScrollElement(target)) {
      if (!draggingRef.current) {
        hideIndicator(true);
      }
      return false;
    }

    const rect = target.getBoundingClientRect();
    const metrics = computeFloatingThumbMetrics({
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight,
      trackHeight: rect.height,
      minThumbHeight: MIN_THUMB_HEIGHT_PX,
      edgeInset: EDGE_INSET_PX,
    });

    if (!metrics.scrollable) {
      hideIndicator(true);
      return false;
    }

    const side = getScrollSide(target);
    rail.setAttribute('data-side', side);

    if (side === 'left') {
      const clampedLeft = Math.max(0, Math.min(window.innerWidth - RAIL_WIDTH_PX, rect.left));
      rail.style.left = `${Math.round(clampedLeft)}px`;
    } else {
      const clampedRight = Math.min(window.innerWidth, Math.max(RAIL_WIDTH_PX, rect.right));
      rail.style.left = `${Math.round(clampedRight - RAIL_WIDTH_PX)}px`;
    }

    rail.style.top = `${Math.round(rect.top)}px`;
    rail.style.height = `${Math.round(rect.height)}px`;

    thumb.style.height = `${metrics.thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${metrics.thumbOffset.toFixed(1)}px, 0)`;

    lastMetricsRef.current = {
      thumbHeight: metrics.thumbHeight,
      trackTop: rect.top,
      trackHeight: rect.height,
    };

    return true;
  }, [hideIndicator]);

  const scheduleSync = useCallback(() => {
    if (syncRafIdRef.current !== null) return;
    syncRafIdRef.current = window.requestAnimationFrame(() => {
      syncRafIdRef.current = null;
      syncGeometryNow();
    });
  }, [syncGeometryNow]);

  const observeTargetResize = useCallback(
    (target: HTMLElement) => {
      if (typeof ResizeObserver === 'undefined') return;
      if (observedTargetRef.current === target && resizeObserverRef.current) return;

      disconnectTargetObserver();
      observedTargetRef.current = target;
      const observer = new ResizeObserver(() => {
        if (railRef.current?.getAttribute('data-visible') === 'true') {
          scheduleSync();
        }
      });
      observer.observe(target);
      resizeObserverRef.current = observer;
    },
    [disconnectTargetObserver, scheduleSync]
  );

  const revealForTarget = useCallback(
    (target: HTMLElement) => {
      activeTargetRef.current = target;
      if (syncRafIdRef.current !== null) {
        window.cancelAnimationFrame(syncRafIdRef.current);
      }
      syncRafIdRef.current = window.requestAnimationFrame(() => {
        syncRafIdRef.current = null;
        const ok = syncGeometryNow();
        if (ok) {
          railRef.current?.setAttribute('data-instant-hide', 'false');
          railRef.current?.setAttribute('data-visible', 'true');
          observeTargetResize(target);
          scheduleIdleHide();
        }
      });
    },
    [observeTargetResize, scheduleIdleHide, syncGeometryNow]
  );

  // Immediately clear any visible indicator on route change or when disabled
  useEffect(() => {
    hideIndicator(true);
  }, [location.pathname, location.search, showFloatingScrollbar, hideIndicator]);

  useEffect(() => {
    if (!showFloatingScrollbar) return;
    const handleCaptureScroll = (event: Event) => {
      if (!isEligibleScrollElement(event.target)) return;
      revealForTarget(event.target);
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      const startNode = event.target instanceof HTMLElement ? event.target : null;
      const region = startNode?.closest('.app-scroll-region') ?? null;
      if (isEligibleScrollElement(region)) {
        revealForTarget(region);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingRef.current) return;
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

      pendingPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
      };
      if (pointerMoveRafIdRef.current !== null) return;

      pointerMoveRafIdRef.current = window.requestAnimationFrame(() => {
        pointerMoveRafIdRef.current = null;
        const sample = pendingPointerRef.current;
        pendingPointerRef.current = null;
        if (!sample || draggingRef.current) return;

        const edgeTarget = findEdgeHoveredScrollElement(sample.x, sample.y, sample.target);
        if (edgeTarget) {
          revealForTarget(edgeTarget);
        }
      });
    };

    const handleResize = () => {
      if (railRef.current?.getAttribute('data-visible') === 'true') {
        scheduleSync();
      }
    };

    document.addEventListener('scroll', handleCaptureScroll, { capture: true, passive: true });
    document.addEventListener('wheel', handleWheel, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      document.removeEventListener('scroll', handleCaptureScroll, { capture: true });
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      clearHideTimer();
      disconnectTargetObserver();
      if (syncRafIdRef.current !== null) {
        window.cancelAnimationFrame(syncRafIdRef.current);
        syncRafIdRef.current = null;
      }
      if (pointerMoveRafIdRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveRafIdRef.current);
        pointerMoveRafIdRef.current = null;
      }
    };
  }, [
    showFloatingScrollbar,
    clearHideTimer,
    disconnectTargetObserver,
    revealForTarget,
    scheduleSync,
  ]);

  const handleRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = activeTargetRef.current;
    if (!isEligibleScrollElement(target)) return;

    event.preventDefault();
    syncGeometryNow();

    const { thumbHeight, trackTop, trackHeight } = lastMetricsRef.current;
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
        trackTop,
        trackHeight,
        thumbHeight,
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        grabOffsetRatio: 0.5,
        edgeInset: EDGE_INSET_PX,
      });
      syncGeometryNow();
    }

    draggingRef.current = true;
    clearHideTimer();
    railRef.current?.setAttribute('data-instant-hide', 'false');
    railRef.current?.setAttribute('data-dragging', 'true');
    railRef.current?.setAttribute('data-visible', 'true');
    observeTargetResize(target);

    const handleDragMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const currentTarget = activeTargetRef.current;
      if (!isEligibleScrollElement(currentTarget)) {
        hideIndicator(true);
        return;
      }

      const latestRect = currentTarget.getBoundingClientRect();
      const currentMetrics = computeFloatingThumbMetrics({
        scrollTop: currentTarget.scrollTop,
        scrollHeight: currentTarget.scrollHeight,
        clientHeight: currentTarget.clientHeight,
        trackHeight: latestRect.height,
        minThumbHeight: MIN_THUMB_HEIGHT_PX,
        edgeInset: EDGE_INSET_PX,
      });

      currentTarget.scrollTop = computeScrollTopFromTrackY({
        pointerY: moveEvent.clientY,
        trackTop: latestRect.top,
        trackHeight: latestRect.height,
        thumbHeight: currentMetrics.thumbHeight,
        scrollHeight: currentTarget.scrollHeight,
        clientHeight: currentTarget.clientHeight,
        grabOffsetRatio: grabOffsetRatioRef.current,
        edgeInset: EDGE_INSET_PX,
      });
      syncGeometryNow();
    };

    const finishDrag = () => {
      draggingRef.current = false;
      railRef.current?.setAttribute('data-dragging', 'false');
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      scheduleIdleHide();
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  if (!showFloatingScrollbar) return null;

  return (
    <div
      ref={railRef}
      aria-hidden="true"
      data-visible="false"
      data-dragging="false"
      data-side="right"
      data-instant-hide="false"
      className="floating-vscroll-rail"
      onPointerEnter={() => {
        hoveringRailRef.current = true;
        clearHideTimer();
        if (activeTargetRef.current && isEligibleScrollElement(activeTargetRef.current)) {
          syncGeometryNow();
          railRef.current?.setAttribute('data-instant-hide', 'false');
          railRef.current?.setAttribute('data-visible', 'true');
          observeTargetResize(activeTargetRef.current);
        }
      }}
      onPointerLeave={() => {
        hoveringRailRef.current = false;
        scheduleIdleHide();
      }}
      onPointerDown={handleRailPointerDown}
    >
      <div ref={thumbRef} className="floating-vscroll-thumb" />
    </div>
  );
}

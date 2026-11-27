import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  PULL_ACTIVATION_DEADZONE_PX,
  PULL_MAX_DISTANCE_PX,
  PULL_TRIGGER_THRESHOLD_PX,
  canStartPullToRefresh,
  computePullDistance,
  resolvePullPhase,
  type PullToRefreshPhase,
} from '../lib/pull-to-refresh-logic';

interface UsePullToRefreshOptions {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<unknown> | void;
  enabled?: boolean;
}

export interface PullToRefreshState {
  pullDistance: number;
  isRefreshing: boolean;
  phase: PullToRefreshPhase;
  progress: number;
}

function isProtectedTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'canvas, input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-pull-refresh="true"]'
    )
  );
}

function hasBlockingModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [aria-modal="true"]'));
}

export function usePullToRefresh({
  scrollRef,
  onRefresh,
  enabled = true,
}: UsePullToRefreshOptions): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const isRefreshingRef = useRef(false);
  isRefreshingRef.current = isRefreshing;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !enabled || typeof window === 'undefined') {
      setPullDistance(0);
      return;
    }

    let isTracking = false;
    let isPullEngaged = false;
    let startX = 0;
    let startY = 0;
    let currentPull = 0;

    const resetGesture = () => {
      isTracking = false;
      isPullEngaged = false;
      currentPull = 0;
      setPullDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }

      const eligible = canStartPullToRefresh({
        scrollTop: container.scrollTop,
        hasOpenModal: hasBlockingModalOpen(),
        hasProtectedTarget: isProtectedTouchTarget(event.target),
      });

      if (!eligible) {
        isTracking = false;
        return;
      }

      isTracking = true;
      isPullEngaged = false;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      currentPull = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTracking || isRefreshingRef.current) return;
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }

      if (container.scrollTop > 1) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isPullEngaged && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
        resetGesture();
        return;
      }

      if (deltaY <= 0) {
        if (currentPull > 0) {
          currentPull = 0;
          setPullDistance(0);
        }
        return;
      }

      if (!isPullEngaged && deltaY <= PULL_ACTIVATION_DEADZONE_PX) {
        return;
      }

      isPullEngaged = true;
      currentPull = computePullDistance(deltaY, PULL_MAX_DISTANCE_PX, PULL_ACTIVATION_DEADZONE_PX);
      if (currentPull > 0 && event.cancelable) {
        event.preventDefault();
      }
      setPullDistance(currentPull);
    };

    const finishGesture = () => {
      if (!isTracking) return;
      const committedPull = currentPull;
      isTracking = false;
      isPullEngaged = false;
      currentPull = 0;

      if (committedPull >= PULL_TRIGGER_THRESHOLD_PX && !isRefreshingRef.current) {
        setIsRefreshing(true);
        setPullDistance(0);
        Promise.resolve(onRefreshRef.current())
          .catch(() => {})
          .finally(() => {
            setIsRefreshing(false);
          });
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', finishGesture, { passive: true });
    container.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', finishGesture);
      container.removeEventListener('touchcancel', resetGesture);
    };
  }, [scrollRef, enabled]);

  const phase = resolvePullPhase({
    isRefreshing,
    pullDistance,
    threshold: PULL_TRIGGER_THRESHOLD_PX,
  });

  const progress = isRefreshing
    ? 1
    : Math.min(1, Math.max(0, pullDistance / PULL_TRIGGER_THRESHOLD_PX));

  return {
    pullDistance,
    isRefreshing,
    phase,
    progress,
  };
}

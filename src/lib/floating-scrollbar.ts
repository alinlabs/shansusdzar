export interface FloatingThumbMetricsInput {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  trackHeight: number;
  minThumbHeight?: number;
  edgeInset?: number;
}

export interface FloatingThumbMetrics {
  scrollable: boolean;
  thumbHeight: number;
  thumbOffset: number;
  progress: number;
}

export function computeFloatingThumbMetrics({
  scrollTop,
  scrollHeight,
  clientHeight,
  trackHeight,
  minThumbHeight = 36,
  edgeInset = 6,
}: FloatingThumbMetricsInput): FloatingThumbMetrics {
  if (
    !Number.isFinite(scrollHeight) ||
    !Number.isFinite(clientHeight) ||
    !Number.isFinite(trackHeight) ||
    scrollHeight <= clientHeight + 1 ||
    clientHeight <= 0 ||
    trackHeight <= edgeInset * 2 + 8
  ) {
    return {
      scrollable: false,
      thumbHeight: 0,
      thumbOffset: 0,
      progress: 0,
    };
  }

  const usableTrack = Math.max(1, trackHeight - edgeInset * 2);
  const rawThumbHeight = (clientHeight / scrollHeight) * usableTrack;
  const effectiveMinThumb = Math.min(usableTrack, Math.max(16, minThumbHeight));
  const thumbHeight = Math.min(usableTrack, Math.max(effectiveMinThumb, Math.round(rawThumbHeight)));

  const maxScroll = Math.max(1, scrollHeight - clientHeight);
  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  const progress = Math.min(1, Math.max(0, safeScrollTop / maxScroll));

  const maxTravel = Math.max(0, usableTrack - thumbHeight);
  const thumbOffset = edgeInset + progress * maxTravel;

  return {
    scrollable: true,
    thumbHeight,
    thumbOffset,
    progress,
  };
}

export interface ScrollFromPointerInput {
  pointerY: number;
  trackTop: number;
  trackHeight: number;
  thumbHeight: number;
  scrollHeight: number;
  clientHeight: number;
  grabOffsetRatio?: number;
  edgeInset?: number;
}

export function computeScrollTopFromTrackY({
  pointerY,
  trackTop,
  trackHeight,
  thumbHeight,
  scrollHeight,
  clientHeight,
  grabOffsetRatio = 0.5,
  edgeInset = 6,
}: ScrollFromPointerInput): number {
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  if (maxScroll <= 0 || trackHeight <= edgeInset * 2) {
    return 0;
  }

  const usableTrack = Math.max(1, trackHeight - edgeInset * 2);
  const maxTravel = Math.max(0, usableTrack - thumbHeight);
  if (maxTravel <= 0) {
    return 0;
  }

  const clampedRatio = Math.min(1, Math.max(0, grabOffsetRatio));
  const thumbTopWithinUsable = Math.min(
    maxTravel,
    Math.max(0, pointerY - trackTop - edgeInset - thumbHeight * clampedRatio)
  );
  const ratio = thumbTopWithinUsable / maxTravel;
  return Math.round(ratio * maxScroll);
}

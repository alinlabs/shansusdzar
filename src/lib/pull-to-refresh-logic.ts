import { stripBypassParamsFromPath } from './admin-bypass';

export const PULL_ACTIVATION_DEADZONE_PX = 14;
export const PULL_TRIGGER_THRESHOLD_PX = 56;
export const PULL_MAX_DISTANCE_PX = 96;
export const ADMIN_PENDING_ROUTE_STORAGE_KEY = 'shansusdzar-admin-pending-route';

export type PullToRefreshPhase = 'idle' | 'pulling' | 'ready' | 'refreshing';

export function computePullDistance(
  rawDeltaY: number,
  maxDistance = PULL_MAX_DISTANCE_PX,
  deadzone = PULL_ACTIVATION_DEADZONE_PX
): number {
  if (!Number.isFinite(rawDeltaY) || rawDeltaY <= deadzone) {
    return 0;
  }
  const effective = rawDeltaY - deadzone;
  const damped = (effective * maxDistance) / (effective + maxDistance * 1.15);
  return Math.min(maxDistance, Math.max(0, Math.round(damped * 10) / 10));
}

export function resolvePullPhase(options: {
  isRefreshing: boolean;
  pullDistance: number;
  threshold?: number;
}): PullToRefreshPhase {
  const { isRefreshing, pullDistance, threshold = PULL_TRIGGER_THRESHOLD_PX } = options;
  if (isRefreshing) return 'refreshing';
  if (pullDistance <= 0) return 'idle';
  if (pullDistance >= threshold) return 'ready';
  return 'pulling';
}

export function canStartPullToRefresh(options: {
  scrollTop: number;
  hasOpenModal: boolean;
  hasProtectedTarget: boolean;
}): boolean {
  const { scrollTop, hasOpenModal, hasProtectedTarget } = options;
  if (!Number.isFinite(scrollTop) || scrollTop > 1) return false;
  if (hasOpenModal || hasProtectedTarget) return false;
  return true;
}

export function buildLocationFullPath(loc: {
  pathname: string;
  search?: string;
  hash?: string;
}): string {
  const pathname = loc.pathname || '/';
  const search = loc.search || '';
  const hash = loc.hash || '';
  return `${pathname}${search}${hash}`;
}

export function sanitizeAdminReturnRoute(candidate: string | null | undefined): string {
  if (!candidate || typeof candidate !== 'string') return '/admin';
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/admin') || trimmed.startsWith('//')) {
    return '/admin';
  }
  const cleaned = stripBypassParamsFromPath(trimmed);
  const pathOnly = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/admin';
  if (pathOnly === '/admin/login') {
    return '/admin';
  }
  return cleaned;
}

export interface DetailSearchRedirectState {
  openSearch: true;
  returnTo: string;
}

const SAFE_INTERNAL_PATH_RE = /^\/(?!\/)/;

let activeDetailSearchSessionReturnTo: string | null = null;

export function normalizeSafeInternalReturnPath(rawPath: unknown): string | null {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed || !SAFE_INTERNAL_PATH_RE.test(trimmed)) return null;
  if (/[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export function buildDetailSearchRedirectState(
  pathname: string,
  search = '',
  hash = ''
): DetailSearchRedirectState {
  const safePath = normalizeSafeInternalReturnPath(`${pathname}${search}${hash}`) ?? '/';
  return {
    openSearch: true,
    returnTo: safePath,
  };
}

export function parseDetailSearchRedirectState(
  state: unknown
): { openSearch: boolean; returnTo: string | null } | null {
  if (!state || typeof state !== 'object') return null;
  const candidate = state as { openSearch?: unknown; returnTo?: unknown };
  if (candidate.openSearch !== true) return null;
  return {
    openSearch: true,
    returnTo: normalizeSafeInternalReturnPath(candidate.returnTo),
  };
}

export function resolveDetailSearchCloseTarget(
  currentPathname: string,
  state: unknown
): string | null {
  const parsed = parseDetailSearchRedirectState(state);
  if (!parsed?.returnTo) return null;
  const normalizedCurrent = currentPathname.replace(/\/+$/, '') || '/';
  const targetPathname = (parsed.returnTo.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  if (targetPathname === normalizedCurrent) return null;
  return parsed.returnTo;
}

export function markDetailSearchSessionStarted(returnTo: string): void {
  activeDetailSearchSessionReturnTo = normalizeSafeInternalReturnPath(returnTo);
}

export function clearDetailSearchSession(): void {
  activeDetailSearchSessionReturnTo = null;
}

export function consumeDetailSearchSessionHistoryBack(returnTo: string): boolean {
  const normalized = normalizeSafeInternalReturnPath(returnTo);
  if (!normalized || activeDetailSearchSessionReturnTo !== normalized) {
    activeDetailSearchSessionReturnTo = null;
    return false;
  }
  activeDetailSearchSessionReturnTo = null;
  return true;
}

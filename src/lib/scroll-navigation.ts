export interface ScrollRouteSnapshot {
  pathname: string;
  search: string;
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function extractCatalogMode(search: string): 'furniture' | 'custom' {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'custom' ? 'custom' : 'furniture';
}

/**
 * Determines whether the app scroll container should reset to the top
 * when the router location changes.
 *
 * - Resets when navigating to a different pathname.
 * - Resets when switching between Furniture and Custom Interior modes on /produk.
 * - Preserves scroll position when opening or closing query-driven overlays (e.g. ?produk=...).
 */
export function shouldResetScrollOnLocationChange(
  previous: ScrollRouteSnapshot | null,
  next: ScrollRouteSnapshot
): boolean {
  if (!previous) return false;

  const prevPath = normalizePathname(previous.pathname);
  const nextPath = normalizePathname(next.pathname);

  if (prevPath !== nextPath) {
    return true;
  }

  if (nextPath === '/produk' || nextPath === '/katalog') {
    return extractCatalogMode(previous.search) !== extractCatalogMode(next.search);
  }

  return false;
}

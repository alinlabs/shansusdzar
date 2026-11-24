const FALLBACK_SITE_ORIGIN = 'https://shansusdzar.vercel.app';

export function normalizeSiteOrigin(raw?: string | null): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return FALLBACK_SITE_ORIGIN;
  }
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return FALLBACK_SITE_ORIGIN;
  }
}

export const DEFAULT_SITE_ORIGIN: string = FALLBACK_SITE_ORIGIN;

export function getRuntimeSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeSiteOrigin(window.location.origin);
  }
  return DEFAULT_SITE_ORIGIN;
}

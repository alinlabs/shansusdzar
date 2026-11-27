export const ADMIN_CREDENTIAL_COOKIE_NAME = 'sdi_admin_credentials';
export const ADMIN_CREDENTIAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SavedAdminCredentials {
  email: string;
  password: string;
}

export function serializeAdminCredentialCookieValue(credentials: SavedAdminCredentials): string {
  const payload = {
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  };
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseAdminCredentialCookieHeader(
  cookieHeader: string,
  cookieName = ADMIN_CREDENTIAL_COOKIE_NAME
): SavedAdminCredentials | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const segments = cookieHeader.split(';');
  const prefix = `${cookieName}=`;

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(prefix)) continue;

    const rawValue = trimmed.slice(prefix.length);
    if (!rawValue) return null;

    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(rawValue));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      const record = parsed as Record<string, unknown>;
      const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
      const password = typeof record.password === 'string' ? record.password : '';
      if (!email || !password) return null;
      return { email, password };
    } catch {
      return null;
    }
  }

  return null;
}

export function buildAdminCredentialCookieString(
  credentials: SavedAdminCredentials,
  options?: { isSecure?: boolean; maxAgeSeconds?: number }
): string {
  const maxAge = options?.maxAgeSeconds ?? ADMIN_CREDENTIAL_COOKIE_MAX_AGE_SECONDS;
  const encoded = serializeAdminCredentialCookieValue(credentials);
  const parts = [
    `${ADMIN_CREDENTIAL_COOKIE_NAME}=${encoded}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (options?.isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function saveAdminCredentialsCookie(email: string, password: string): void {
  if (typeof document === 'undefined') return;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return;

  const isSecure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:';
  document.cookie = buildAdminCredentialCookieString(
    { email: cleanEmail, password },
    { isSecure }
  );
}

export function readAdminCredentialsCookie(): SavedAdminCredentials | null {
  if (typeof document === 'undefined') return null;
  return parseAdminCredentialCookieHeader(document.cookie);
}

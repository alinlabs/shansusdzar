import { validateAdminLogin } from './rbac';
import type { AdminUserAccount } from '../types/cms';

export interface ParsedAdminBypassParams {
  hasBypass: boolean;
  email: string;
  password: string;
  cleanedSearch: string;
}

export type AdminBypassAttemptResult =
  | { active: false }
  | { active: true; ok: true; user: AdminUserAccount; cleanTargetPath: string }
  | { active: true; ok: false; message: string; cleanTargetPath: string };

const EXPLICIT_PASSWORD_PARAM_KEYS = new Set(['password', 'pass', 'pwd']);

function decodeQuerySegment(raw: string): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parseAdminBypassParams(search: string): ParsedAdminBypassParams {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) {
    return { hasBypass: false, email: '', password: '', cleanedSearch: '' };
  }

  const segments = raw.split('&').filter((segment) => segment.length > 0);
  const remainingSegments: string[] = [];

  let hasBypass = false;
  let email = '';
  let password = '';
  let capturedPrimaryBypass = false;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const eqIndex = segment.indexOf('=');
    const rawKey = eqIndex === -1 ? segment : segment.slice(0, eqIndex);
    const key = decodeQuerySegment(rawKey).trim().toLowerCase();

    if (key === 'bypass') {
      hasBypass = true;
      if (!capturedPrimaryBypass) {
        capturedPrimaryBypass = true;
        email = eqIndex === -1 ? '' : decodeQuerySegment(segment.slice(eqIndex + 1)).trim();

        const nextSegment = segments[i + 1];
        if (nextSegment !== undefined) {
          const nextEqIndex = nextSegment.indexOf('=');
          if (nextEqIndex === -1) {
            password = decodeQuerySegment(nextSegment);
            i += 1;
          } else {
            const nextKey = decodeQuerySegment(nextSegment.slice(0, nextEqIndex))
              .trim()
              .toLowerCase();
            if (EXPLICIT_PASSWORD_PARAM_KEYS.has(nextKey)) {
              password = decodeQuerySegment(nextSegment.slice(nextEqIndex + 1));
              i += 1;
            }
          }
        }
      }
      continue;
    }

    remainingSegments.push(segment);
  }

  return {
    hasBypass,
    email,
    password,
    cleanedSearch: remainingSegments.length > 0 ? `?${remainingSegments.join('&')}` : '',
  };
}

export function stripBypassParamsFromPath(fullPath: string): string {
  const hashIndex = fullPath.indexOf('#');
  const hash = hashIndex === -1 ? '' : fullPath.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? fullPath : fullPath.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex === -1) return fullPath;

  const pathname = beforeHash.slice(0, queryIndex) || '/admin';
  const search = beforeHash.slice(queryIndex);
  const { hasBypass, cleanedSearch } = parseAdminBypassParams(search);
  if (!hasBypass) return fullPath;

  return `${pathname}${cleanedSearch}${hash}`;
}

export function evaluateAdminBypassAttempt(
  users: readonly AdminUserAccount[],
  location: { pathname: string; search?: string; hash?: string }
): AdminBypassAttemptResult {
  const search = location.search ?? '';
  const hash = location.hash ?? '';
  const parsed = parseAdminBypassParams(search);

  if (!parsed.hasBypass) {
    return { active: false };
  }

  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/admin';
  const targetPathname = normalizedPathname === '/admin/login' ? '/admin' : location.pathname || '/admin';
  const cleanTargetPath = `${targetPathname}${parsed.cleanedSearch}${hash}`;

  const loginResult = validateAdminLogin(users, parsed.email, parsed.password);
  if (!loginResult.ok) {
    return {
      active: true,
      ok: false,
      message: 'Kredensial tautan bypass tidak valid atau tidak terdaftar.',
      cleanTargetPath,
    };
  }

  return {
    active: true,
    ok: true,
    user: loginResult.user,
    cleanTargetPath,
  };
}

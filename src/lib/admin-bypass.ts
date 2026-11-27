import type { AdminUserAccount } from '../types/cms';

export interface ParsedAdminBypassParams {
  hasBypass: boolean;
  page: string;
  cleanedSearch: string;
}

export type AdminBypassAttemptResult =
  | { active: false }
  | { active: true; ok: true; user: AdminUserAccount; cleanTargetPath: string }
  | { active: true; ok: false; message: string; cleanTargetPath: string };

const ADMIN_BYPASS_PAGE_ALIASES: Record<string, string> = {
  '': '/admin',
  admin: '/admin',
  dashboard: '/admin',
  beranda: '/admin',
  login: '/admin',
  proyek: '/admin/proyek',
  project: '/admin/proyek',
  projects: '/admin/proyek',
  keuangan: '/admin/keuangan',
  finance: '/admin/keuangan',
  kas: '/admin/keuangan',
  'buku-kas': '/admin/keuangan',
  produk: '/admin/produk',
  product: '/admin/produk',
  products: '/admin/produk',
  katalog: '/admin/produk',
  portofolio: '/admin/portofolio',
  portfolio: '/admin/portofolio',
  informasi: '/admin/informasi/berita',
  berita: '/admin/informasi/berita',
  artikel: '/admin/informasi/berita',
  news: '/admin/informasi/berita',
  material: '/admin/informasi/material',
  materials: '/admin/informasi/material',
  faq: '/admin/informasi/faq',
  tentang: '/admin/tentang',
  profil: '/admin/tentang',
  'profil-usaha': '/admin/tentang',
  usaha: '/admin/tentang',
  akses: '/admin/akses',
  pengguna: '/admin/akses',
  user: '/admin/akses',
  users: '/admin/akses',
  akun: '/admin/akses',
  marketing: '/admin/marketing/database',
  database: '/admin/marketing/database',
  campaign: '/admin/marketing/campaign',
  'content-plan': '/admin/marketing/content-plan',
  sosmed: '/admin/marketing/content-plan',
  seo: '/admin/seo',
};

function decodeQuerySegment(raw: string): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

function isTruthyBypassValue(rawValue: string | null): boolean {
  if (rawValue === null) return true;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function resolveAdminBypassTargetPathname(
  rawPage: string,
  currentPathname = '/admin'
): string {
  const normalizedCurrent = currentPathname.replace(/\/+$/, '') || '/admin';
  const defaultPathname =
    normalizedCurrent === '/admin/login' || !normalizedCurrent.startsWith('/admin')
      ? '/admin'
      : normalizedCurrent;

  const trimmedPage = rawPage.trim();
  if (!trimmedPage) {
    return defaultPathname;
  }

  if (
    trimmedPage.includes('\\') ||
    trimmedPage.includes('..') ||
    trimmedPage.includes('//') ||
    /^[a-z]+:/i.test(trimmedPage)
  ) {
    return '/admin';
  }

  const pathPart = trimmedPage.split(/[?#]/)[0] ?? '';
  let stripped = pathPart.replace(/^\/+|\/+$/g, '');

  if (stripped.toLowerCase() === 'admin') {
    return '/admin';
  }
  if (stripped.toLowerCase().startsWith('admin/')) {
    stripped = stripped.slice('admin/'.length).replace(/^\/+|\/+$/g, '');
  }

  if (!stripped) {
    return '/admin';
  }

  const lower = stripped.toLowerCase();
  if (lower in ADMIN_BYPASS_PAGE_ALIASES) {
    return ADMIN_BYPASS_PAGE_ALIASES[lower];
  }

  const [firstSegment, ...restSegments] = stripped.split('/').filter(Boolean);
  if (!firstSegment) {
    return '/admin';
  }

  const firstLower = firstSegment.toLowerCase();
  if (firstLower === 'berita' || firstLower === 'artikel') {
    return `/admin/informasi/berita/${restSegments.join('/')}`.replace(/\/+$/, '');
  }
  if (firstLower === 'material') {
    return `/admin/informasi/material/${restSegments.join('/')}`.replace(/\/+$/, '');
  }
  if (firstLower === 'faq') {
    return `/admin/informasi/faq/${restSegments.join('/')}`.replace(/\/+$/, '');
  }
  if (firstLower === 'katalog') {
    return `/admin/produk/${restSegments.join('/')}`.replace(/\/+$/, '');
  }

  const candidate = `/admin/${[firstSegment, ...restSegments].join('/')}`.replace(/\/+$/, '');
  if (candidate === '/admin/login') {
    return '/admin';
  }
  return candidate;
}

export function resolveBypassOwnerAccount(
  users: readonly AdminUserAccount[]
): AdminUserAccount | null {
  return users.find((u) => u.isOwner) ?? users[0] ?? null;
}

export function parseAdminBypassParams(search: string): ParsedAdminBypassParams {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) {
    return { hasBypass: false, page: '', cleanedSearch: '' };
  }

  const segments = raw.split('&').filter((segment) => segment.length > 0);
  const nonBypassSegments: string[] = [];
  const otherSegmentsWithoutPage: string[] = [];

  let hasBypass = false;
  let page = '';

  for (const segment of segments) {
    const eqIndex = segment.indexOf('=');
    const rawKey = eqIndex === -1 ? segment : segment.slice(0, eqIndex);
    const key = decodeQuerySegment(rawKey).trim().toLowerCase();

    if (key === 'bypass') {
      const rawValue = eqIndex === -1 ? null : decodeQuerySegment(segment.slice(eqIndex + 1));
      if (isTruthyBypassValue(rawValue)) {
        hasBypass = true;
      }
      continue;
    }

    if (key === 'page') {
      if (!page && eqIndex !== -1) {
        page = decodeQuerySegment(segment.slice(eqIndex + 1)).trim();
      }
      nonBypassSegments.push(segment);
      continue;
    }

    nonBypassSegments.push(segment);
    otherSegmentsWithoutPage.push(segment);
  }

  if (!hasBypass) {
    return {
      hasBypass: false,
      page: '',
      cleanedSearch: nonBypassSegments.length > 0 ? `?${nonBypassSegments.join('&')}` : '',
    };
  }

  return {
    hasBypass: true,
    page,
    cleanedSearch:
      otherSegmentsWithoutPage.length > 0 ? `?${otherSegmentsWithoutPage.join('&')}` : '',
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
  const parsed = parseAdminBypassParams(search);
  if (!parsed.hasBypass) return fullPath;

  const targetPathname = resolveAdminBypassTargetPathname(parsed.page, pathname);
  return `${targetPathname}${parsed.cleanedSearch}${hash}`;
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

  const targetPathname = resolveAdminBypassTargetPathname(parsed.page, location.pathname);
  const cleanTargetPath = `${targetPathname}${parsed.cleanedSearch}${hash}`;
  const ownerUser = resolveBypassOwnerAccount(users);

  if (!ownerUser) {
    return {
      active: true,
      ok: false,
      message: 'Akun pengelola tidak tersedia untuk akses bypass.',
      cleanTargetPath,
    };
  }

  return {
    active: true,
    ok: true,
    user: ownerUser,
    cleanTargetPath,
  };
}

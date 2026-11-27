import type {
  AdminAccessLevel,
  AdminAccessPageKey,
  AdminPageAccessRule,
  AdminUserAccount,
} from '../types/cms';

export interface AdminAccessPageMetadata {
  halaman: AdminAccessPageKey;
  label: string;
  deskripsi: string;
}

export const ACCESS_PAGE_CATALOG: AdminAccessPageMetadata[] = [
  {
    halaman: 'proyek',
    label: 'Proyek',
    deskripsi: 'Daftar proyek, detail proyek, dokumen kerja, dan transaksi proyek.',
  },
  {
    halaman: 'keuangan',
    label: 'Keuangan',
    deskripsi: 'Ringkasan arus kas, buku kas umum, dan skema pembayaran termin.',
  },
  {
    halaman: 'produk',
    label: 'Produk',
    deskripsi: 'Daftar produk furniture, harga dasar, material, dan variasi opsi.',
  },
  {
    halaman: 'portofolio',
    label: 'Portofolio',
    deskripsi: 'Studi kasus proyek selesai, galeri dokumentasi, dan ulasan klien.',
  },
  {
    halaman: 'berita',
    label: 'Berita',
    deskripsi: 'Artikel berita, tips interior, dan konten publikasi studio.',
  },
  {
    halaman: 'material',
    label: 'Material',
    deskripsi: 'Spesifikasi bahan papan, finishing laminasi, dan panduan perawatan.',
  },
  {
    halaman: 'faq',
    label: 'FAQ',
    deskripsi: 'Pertanyaan yang sering diajukan dan jawaban layanan klien.',
  },
  {
    halaman: 'profil-usaha',
    label: 'Profil Usaha',
    deskripsi: 'Identitas bisnis, beranda, profil pemilik, tim, dan info operasional.',
  },
  {
    halaman: 'pengguna',
    label: 'Pengguna',
    deskripsi: 'Daftar akun admin pengelola dan pengaturan hak akses halaman.',
  },
];

export const ALL_ADMIN_ACCESS_PAGES: AdminAccessPageKey[] = ACCESS_PAGE_CATALOG.map(
  (item) => item.halaman
);

export const ACCESS_LEVEL_OPTIONS: ReadonlyArray<{
  value: AdminAccessLevel;
  label: string;
}> = [
  { value: 'hide', label: 'Hide' },
  { value: 'view', label: 'View' },
  { value: 'editor', label: 'Editor' },
];

const VALID_PAGE_SET = new Set<string>(ALL_ADMIN_ACCESS_PAGES);
const VALID_LEVEL_SET = new Set<string>(['hide', 'view', 'editor']);

const LEVEL_RANK: Record<AdminAccessLevel, number> = {
  hide: 0,
  view: 1,
  editor: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildUniformPageAccess(level: AdminAccessLevel): AdminPageAccessRule[] {
  return ALL_ADMIN_ACCESS_PAGES.map((halaman) => ({
    halaman,
    krendensial: level,
  }));
}

export function sanitizePageAccessList(rawAkses: unknown): AdminPageAccessRule[] {
  const byPage = new Map<AdminAccessPageKey, AdminAccessLevel>();

  if (Array.isArray(rawAkses)) {
    for (const item of rawAkses) {
      if (!isRecord(item)) continue;
      const rawPage = typeof item.halaman === 'string' ? item.halaman.trim() : '';
      const rawLevel =
        typeof item.krendensial === 'string'
          ? item.krendensial.trim()
          : typeof item.kredensial === 'string'
            ? item.kredensial.trim()
            : '';

      if (VALID_PAGE_SET.has(rawPage) && VALID_LEVEL_SET.has(rawLevel)) {
        byPage.set(rawPage as AdminAccessPageKey, rawLevel as AdminAccessLevel);
      }
    }
  }

  return ALL_ADMIN_ACCESS_PAGES.map((halaman) => ({
    halaman,
    krendensial: byPage.get(halaman) ?? 'hide',
  }));
}

export function migrateLegacyPermissionsToAccess(
  rawPermissions: readonly string[] | undefined
): AdminPageAccessRule[] {
  const permSet = new Set(Array.isArray(rawPermissions) ? rawPermissions : []);

  const pick = (viewCodes: string[], editCodes: string[]): AdminAccessLevel => {
    if (editCodes.some((code) => permSet.has(code))) return 'editor';
    if (viewCodes.some((code) => permSet.has(code))) return 'view';
    return 'hide';
  };

  const levelMap: Record<AdminAccessPageKey, AdminAccessLevel> = {
    proyek: pick(['keuangan.view'], ['keuangan.edit', 'keuangan.delete']),
    keuangan: pick(['keuangan.view'], ['keuangan.edit', 'keuangan.delete']),
    produk: pick(['katalog.view'], ['katalog.edit', 'katalog.delete']),
    portofolio: pick(['portofolio.view'], ['portofolio.edit', 'portofolio.delete']),
    berita: pick(['informasi.view'], ['informasi.edit']),
    material: pick(['informasi.view'], ['informasi.edit']),
    faq: pick(['informasi.view'], ['informasi.edit']),
    'profil-usaha': pick(['tentang.view', 'informasi.view'], ['tentang.edit', 'bisnis.edit']),
    pengguna: pick(['akses.view'], ['akses.manage']),
  };

  return ALL_ADMIN_ACCESS_PAGES.map((halaman) => ({
    halaman,
    krendensial: levelMap[halaman],
  }));
}

export function isOwnerUser(user: AdminUserAccount | null | undefined): boolean {
  return Boolean(user?.isOwner);
}

export function getPageAccess(
  user: AdminUserAccount | null | undefined,
  page: AdminAccessPageKey
): AdminAccessLevel {
  if (!user) return 'hide';
  if (user.isOwner) return 'editor';
  if (!Array.isArray(user.akses)) return 'hide';

  for (const rule of user.akses) {
    if (!rule || rule.halaman !== page) continue;
    const rawLevel =
      (rule as { krendensial?: string; kredensial?: string }).krendensial ??
      (rule as { krendensial?: string; kredensial?: string }).kredensial;
    if (rawLevel && VALID_LEVEL_SET.has(rawLevel)) {
      return rawLevel as AdminAccessLevel;
    }
  }
  return 'hide';
}

export function getEffectivePageAccessMap(
  user: AdminUserAccount | null | undefined
): Record<AdminAccessPageKey, AdminAccessLevel> {
  const map = {} as Record<AdminAccessPageKey, AdminAccessLevel>;
  for (const page of ALL_ADMIN_ACCESS_PAGES) {
    map[page] = getPageAccess(user, page);
  }
  return map;
}

export function hasPageAccess(
  user: AdminUserAccount | null | undefined,
  page: AdminAccessPageKey,
  minLevel: Exclude<AdminAccessLevel, 'hide'> = 'view'
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  return LEVEL_RANK[getPageAccess(user, page)] >= LEVEL_RANK[minLevel];
}

export function canViewPage(
  user: AdminUserAccount | null | undefined,
  page: AdminAccessPageKey
): boolean {
  return hasPageAccess(user, page, 'view');
}

export function canEditPage(
  user: AdminUserAccount | null | undefined,
  page: AdminAccessPageKey
): boolean {
  return hasPageAccess(user, page, 'editor');
}

export function hasAnyPageAccess(
  user: AdminUserAccount | null | undefined,
  pages: readonly AdminAccessPageKey[],
  minLevel: Exclude<AdminAccessLevel, 'hide'> = 'view'
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  return pages.some((page) => hasPageAccess(user, page, minLevel));
}

export function getUserActorLabel(user: AdminUserAccount | null | undefined): string {
  if (!user) return 'Sistem';
  if (user.isOwner) return 'Owner';
  return user.divisi?.trim() || 'Pengguna';
}

export function formatUserAccessSummary(user: AdminUserAccount): string {
  if (user.isOwner) return 'Owner · Akses Penuh';
  const normalized = sanitizePageAccessList(user.akses);
  const editorCount = normalized.filter((item) => item.krendensial === 'editor').length;
  const viewCount = normalized.filter((item) => item.krendensial === 'view').length;
  const totalPages = ALL_ADMIN_ACCESS_PAGES.length;

  if (editorCount === 0 && viewCount === 0) return 'Semua Hide';
  if (editorCount === totalPages) return `Semua Editor (${totalPages}/${totalPages})`;
  if (viewCount === totalPages) return `Semua View (${totalPages}/${totalPages})`;

  const parts: string[] = [];
  if (editorCount > 0) parts.push(`${editorCount} Editor`);
  if (viewCount > 0) parts.push(`${viewCount} View`);
  return parts.join(' · ');
}

export function formatUserSearchableAccessText(user: AdminUserAccount): string {
  const summary = formatUserAccessSummary(user);
  if (user.isOwner) {
    return summary;
  }
  const normalized = sanitizePageAccessList(user.akses);
  const activePages = normalized
    .filter((item) => item.krendensial !== 'hide')
    .map((item) => {
      const meta = ACCESS_PAGE_CATALOG.find((p) => p.halaman === item.halaman);
      return `${meta?.label ?? item.halaman} ${item.krendensial}`;
    })
    .join(' ');
  return `${summary} ${activePages}`.trim();
}

export type LoginValidationResult =
  | { ok: true; user: AdminUserAccount }
  | { ok: false; message: string };

export function validateAdminLogin(
  users: readonly AdminUserAccount[],
  email: string,
  password: string
): LoginValidationResult {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, message: 'Email dan kata sandi wajib diisi.' };
  }

  const matched = users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
  if (!matched || matched.kataSandi !== password) {
    return { ok: false, message: 'Email atau kata sandi tidak sesuai.' };
  }

  return { ok: true, user: matched };
}

export function countAccessManagers(users: readonly AdminUserAccount[]): number {
  return users.filter(
    (u) => Boolean(u.isOwner) || getPageAccess(u, 'pengguna') === 'editor'
  ).length;
}

export function canAssignPageLevel(
  actorUser: AdminUserAccount | null | undefined,
  page: AdminAccessPageKey,
  level: AdminAccessLevel
): boolean {
  if (!actorUser) return false;
  if (actorUser.isOwner) return true;
  if (!canEditPage(actorUser, 'pengguna')) return false;
  if (page === 'pengguna' && level === 'editor') return false;
  return true;
}

export function canEditTargetUser(
  actorUser: AdminUserAccount | null | undefined,
  targetUser: AdminUserAccount | null | undefined
): { allowed: boolean; reason?: string } {
  if (!actorUser) {
    return { allowed: false, reason: 'Sesi pengguna tidak aktif.' };
  }
  if (!actorUser.isOwner && !canEditPage(actorUser, 'pengguna')) {
    return { allowed: false, reason: 'Anda tidak memiliki izin mengelola pengguna.' };
  }
  if (!targetUser) return { allowed: true };
  if (
    !actorUser.isOwner &&
    (targetUser.isOwner || getPageAccess(targetUser, 'pengguna') === 'editor')
  ) {
    return {
      allowed: false,
      reason: 'Hanya akun Owner yang dapat mengubah akun Owner atau editor pengguna.',
    };
  }
  return { allowed: true };
}

export function canDeleteUser(
  targetUser: AdminUserAccount,
  currentSessionUserId: string | null,
  users: readonly AdminUserAccount[],
  actorUser?: AdminUserAccount | null
): { allowed: boolean; reason?: string } {
  if (targetUser.id === currentSessionUserId) {
    return {
      allowed: false,
      reason: 'Tidak dapat menghapus akun yang sedang aktif masuk.',
    };
  }

  if (targetUser.isOwner) {
    return {
      allowed: false,
      reason: 'Akun Owner utama tidak dapat dihapus.',
    };
  }

  if (
    actorUser &&
    !actorUser.isOwner &&
    getPageAccess(targetUser, 'pengguna') === 'editor'
  ) {
    return {
      allowed: false,
      reason: 'Hanya Owner yang dapat menghapus akun editor pengguna.',
    };
  }

  const isTargetAccessManager = Boolean(
    targetUser.isOwner || getPageAccess(targetUser, 'pengguna') === 'editor'
  );

  if (isTargetAccessManager) {
    const managerCount = countAccessManagers(users);
    if (managerCount <= 1) {
      return {
        allowed: false,
        reason: 'Minimal harus terdapat satu akun dengan hak editor pengguna.',
      };
    }
  }

  return { allowed: true };
}

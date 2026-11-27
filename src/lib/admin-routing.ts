import type { AdminAccessPageKey } from '../types/cms';

export interface AdminNavChildDef {
  to: string;
  label: string;
  end?: boolean;
  page?: AdminAccessPageKey;
}

export interface AdminNavItemDef {
  to: string;
  label: string;
  end: boolean;
  iconKey:
    | 'dashboard'
    | 'proyek'
    | 'keuangan'
    | 'produk'
    | 'portofolio'
    | 'informasi'
    | 'tentang'
    | 'akses'
    | 'marketing'
    | 'seo';
  page?: AdminAccessPageKey;
  isAddon?: boolean;
  children?: AdminNavChildDef[];
}

export const ADMIN_NAV_DEFINITIONS: AdminNavItemDef[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    iconKey: 'dashboard',
  },
  {
    to: '/admin/proyek',
    label: 'Proyek',
    end: false,
    iconKey: 'proyek',
    page: 'proyek',
  },
  {
    to: '/admin/keuangan',
    label: 'Keuangan',
    end: false,
    iconKey: 'keuangan',
    page: 'keuangan',
  },
  {
    to: '/admin/produk',
    label: 'Daftar Produk',
    end: false,
    iconKey: 'produk',
    page: 'produk',
  },
  {
    to: '/admin/portofolio',
    label: 'Portofolio',
    end: false,
    iconKey: 'portofolio',
    page: 'portofolio',
  },
  {
    to: '/admin/informasi',
    label: 'Informasi',
    end: false,
    iconKey: 'informasi',
    children: [
      { to: '/admin/informasi/berita', label: 'Berita & Artikel', page: 'berita' },
      { to: '/admin/informasi/material', label: 'Material', page: 'material' },
      { to: '/admin/informasi/faq', label: 'FAQ', page: 'faq' },
    ],
  },
  {
    to: '/admin/tentang',
    label: 'Profil Usaha',
    end: false,
    iconKey: 'tentang',
    page: 'profil-usaha',
  },
  {
    to: '/admin/akses',
    label: 'Pengguna',
    end: false,
    iconKey: 'akses',
    page: 'pengguna',
  },
  {
    to: '/admin/marketing',
    label: 'Marketing',
    end: false,
    iconKey: 'marketing',
    isAddon: true,
    page: 'profil-usaha',
    children: [
      { to: '/admin/marketing/database', label: 'Database', page: 'profil-usaha' },
      { to: '/admin/marketing/campaign', label: 'Campaign', page: 'profil-usaha' },
      { to: '/admin/marketing/content-plan', label: 'Content Plan', page: 'profil-usaha' },
    ],
  },
  {
    to: '/admin/seo',
    label: 'SEO',
    end: false,
    iconKey: 'seo',
    isAddon: true,
    page: 'profil-usaha',
  },
];

export interface AdminBackMeta {
  backTo: string;
  backLabel: string;
}

export interface AdminAddonLockInfo {
  id: 'marketing' | 'seo';
  title: string;
  description: string;
}

export interface ProjectFormBackParams {
  isEditMode: boolean;
  projectId?: string | null;
  existingProjectId?: string | null;
}

function normalizePathname(rawPath: string): string {
  const withoutQueryOrHash = rawPath.split(/[?#]/)[0] ?? '';
  const trimmed = withoutQueryOrHash.replace(/\/+$/, '');
  return trimmed || '/admin';
}

export function resolveLockedAdminAddon(pathname: string): AdminAddonLockInfo | null {
  const clean = normalizePathname(pathname);
  if (clean === '/admin/marketing' || clean.startsWith('/admin/marketing/')) {
    return {
      id: 'marketing',
      title: 'Modul Marketing Belum Aktif',
      description:
        'Fitur Database Kontak, Campaign, dan Content Plan merupakan modul tambahan berbayar terpisah dan saat ini belum diaktifkan.',
    };
  }
  if (clean === '/admin/seo' || clean.startsWith('/admin/seo/')) {
    return {
      id: 'seo',
      title: 'Modul SEO Belum Aktif',
      description:
        'Pengaturan SEO & visibilitas pencarian merupakan modul tambahan berbayar terpisah dan saat ini belum diaktifkan.',
    };
  }
  return null;
}

export function shouldShowMobileAdminHamburger(hasBackTo: boolean): boolean {
  return !hasBackTo;
}

export function resolveProjectFormBackPath({
  isEditMode,
  existingProjectId,
}: ProjectFormBackParams): AdminBackMeta {
  if (isEditMode && existingProjectId && existingProjectId.trim().length > 0) {
    return {
      backTo: `/admin/proyek/${existingProjectId.trim()}`,
      backLabel: 'Kembali ke Detail Proyek',
    };
  }

  return {
    backTo: '/admin/proyek',
    backLabel: 'Kembali ke Daftar Proyek',
  };
}

export function resolveAdminHeaderBackMeta(pathname: string): AdminBackMeta | null {
  const clean = normalizePathname(pathname);

  // Produk (daftar: /admin/produk, sub: /admin/produk/baru, /admin/produk/:id, /admin/produk/:id/edit)
  if (clean === '/admin/produk/baru' || /^\/admin\/produk\/[^/]+(?:\/edit)?$/.test(clean)) {
    if (clean === '/admin/produk/custom' || clean === '/admin/produk/skema-pembayaran') {
      return null;
    }
    return { backTo: '/admin/produk', backLabel: 'Kembali ke Produk' };
  }

  // Proyek
  if (clean === '/admin/proyek/baru') {
    return { backTo: '/admin/proyek', backLabel: 'Kembali ke Daftar Proyek' };
  }

  const projectEditMatch = clean.match(/^\/admin\/proyek\/([^/]+)\/edit$/);
  if (projectEditMatch) {
    const projectId = projectEditMatch[1];
    return {
      backTo: `/admin/proyek/${projectId}`,
      backLabel: 'Kembali ke Detail Proyek',
    };
  }

  const projectFinanceMatch = clean.match(/^\/admin\/proyek\/([^/]+)\/keuangan(?:\/.*)?$/);
  if (projectFinanceMatch) {
    const projectId = projectFinanceMatch[1];
    return {
      backTo: `/admin/proyek/${projectId}?tab=keuangan`,
      backLabel: 'Kembali ke Proyek',
    };
  }

  const projectDocumentMatch = clean.match(/^\/admin\/proyek\/([^/]+)\/dokumen(?:\/.*)?$/);
  if (projectDocumentMatch) {
    const projectId = projectDocumentMatch[1];
    return {
      backTo: `/admin/proyek/${projectId}?tab=dokumen`,
      backLabel: 'Kembali ke Proyek',
    };
  }

  const projectDetailMatch = clean.match(/^\/admin\/proyek\/([^/]+)$/);
  if (projectDetailMatch && projectDetailMatch[1] !== 'kas') {
    return {
      backTo: '/admin/proyek',
      backLabel: 'Kembali ke Daftar Proyek',
    };
  }

  // Portofolio
  if (clean === '/admin/portofolio/baru' || /^\/admin\/portofolio\/[^/]+\/edit$/.test(clean)) {
    return { backTo: '/admin/portofolio', backLabel: 'Kembali ke Portofolio' };
  }

  // Marketing
  if (
    clean === '/admin/marketing/database/baru' ||
    /^\/admin\/marketing\/database\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/marketing/database', backLabel: 'Kembali ke Database' };
  }

  if (
    clean === '/admin/marketing/campaign/baru' ||
    /^\/admin\/marketing\/campaign\/[^/]+\/(?:edit|kirim)$/.test(clean)
  ) {
    return { backTo: '/admin/marketing/campaign', backLabel: 'Kembali ke Daftar Campaign' };
  }

  if (
    clean === '/admin/marketing/content-plan/baru' ||
    /^\/admin\/marketing\/content-plan\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/marketing/content-plan', backLabel: 'Kembali ke Content Plan' };
  }

  // Informasi
  if (
    clean === '/admin/informasi/berita/baru' ||
    /^\/admin\/informasi\/berita\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/informasi/berita', backLabel: 'Kembali ke Berita' };
  }

  if (
    clean === '/admin/informasi/material/baru' ||
    /^\/admin\/informasi\/material\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/informasi/material', backLabel: 'Kembali ke Material' };
  }

  if (
    clean === '/admin/informasi/faq/baru' ||
    /^\/admin\/informasi\/faq\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/informasi/faq', backLabel: 'Kembali ke FAQ' };
  }

  // Keuangan
  if (clean === '/admin/keuangan/baru' || /^\/admin\/keuangan\/[^/]+\/edit$/.test(clean)) {
    return { backTo: '/admin/keuangan', backLabel: 'Kembali ke Keuangan' };
  }

  // Hak Akses Pengguna
  if (
    clean === '/admin/akses/pengguna/baru' ||
    /^\/admin\/akses\/pengguna\/[^/]+\/edit$/.test(clean)
  ) {
    return { backTo: '/admin/akses', backLabel: 'Kembali ke Pengguna' };
  }

  return null;
}

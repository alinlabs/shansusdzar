import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import adminRouteTitlesData from '../../data/judul-rute-admin.json';
import { ThemeToggle } from '../../components/layout/theme-provider';
import { hasAnyPermission, hasPermission } from '../../lib/rbac';
import { useAdminAuthStore } from '../../store/admin-auth-store';
import { useSiteContentStore } from '../../store/site-content-store';
import type { AdminPermission } from '../../types/cms';

interface AdminNavChild {
  to: string;
  label: string;
  end?: boolean;
}

interface AdminNavItem {
  to: string;
  label: string;
  end: boolean;
  icon: typeof LayoutDashboard;
  requiredAnyPermissions: AdminPermission[];
  children?: AdminNavChild[];
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    icon: LayoutDashboard,
    requiredAnyPermissions: ['dashboard.view'],
  },
  {
    to: '/admin/produk',
    label: 'Produk',
    end: false,
    icon: LayoutGrid,
    requiredAnyPermissions: ['katalog.view', 'katalog.edit'],
    children: [
      { to: '/admin/produk', label: 'Daftar Produk', end: true },
      { to: '/admin/produk/custom', label: 'Custom Interior (/m²)' },
    ],
  },
  {
    to: '/admin/portofolio',
    label: 'Portofolio',
    end: false,
    icon: Briefcase,
    requiredAnyPermissions: ['portofolio.view', 'portofolio.edit'],
  },
  {
    to: '/admin/marketing',
    label: 'Marketing',
    end: false,
    icon: Megaphone,
    requiredAnyPermissions: ['marketing.view', 'marketing.edit', 'tentang.view', 'tentang.edit', 'bisnis.edit'],
    children: [
      { to: '/admin/marketing/database', label: 'Database' },
      { to: '/admin/marketing/campaign', label: 'Campaign' },
      { to: '/admin/marketing/content-plan', label: 'Content Plan' },
    ],
  },
  {
    to: '/admin/informasi',
    label: 'Informasi & FAQ',
    end: false,
    icon: BookOpen,
    requiredAnyPermissions: ['informasi.view', 'informasi.edit'],
    children: [
      { to: '/admin/informasi/berita', label: 'Berita & Artikel SEO' },
      { to: '/admin/informasi/material', label: 'Matriks Material' },
      { to: '/admin/informasi/faq', label: 'Pusat FAQ' },
    ],
  },
  {
    to: '/admin/tentang',
    label: 'Tentang & Situs',
    end: false,
    icon: FileText,
    requiredAnyPermissions: ['tentang.view', 'tentang.edit', 'bisnis.edit', 'informasi.view', 'informasi.edit'],
    children: [
      { to: '/admin/tentang', label: 'Tentang Perusahaan', end: true },
      { to: '/admin/tentang/tim', label: 'Tim & Pemilik' },
      { to: '/admin/tentang/beranda', label: 'Beranda' },
      { to: '/admin/tentang/operasional', label: 'Operasional & Kebijakan' },
    ],
  },
  {
    to: '/admin/seo',
    label: 'SEO & Visibilitas',
    end: false,
    icon: Globe,
    requiredAnyPermissions: ['tentang.view', 'tentang.edit', 'bisnis.edit'],
  },
  {
    to: '/admin/dokumen',
    label: 'Dokumen',
    end: false,
    icon: FileCheck2,
    requiredAnyPermissions: ['keuangan.view', 'keuangan.edit'],
    children: [
      { to: '/admin/dokumen/spk', label: 'Surat Perintah Kerja' },
      { to: '/admin/dokumen/spks', label: 'Surat Perjanjian Kerja Sama' },
      { to: '/admin/dokumen/bast', label: 'Berita Acara Serah Terima' },
      { to: '/admin/dokumen/invoice', label: 'Invoice & Termin' },
    ],
  },
  {
    to: '/admin/keuangan',
    label: 'Keuangan',
    end: false,
    icon: Wallet,
    requiredAnyPermissions: ['keuangan.view', 'keuangan.edit'],
    children: [
      { to: '/admin/keuangan', label: 'Daftar Project', end: true },
      { to: '/admin/keuangan/pembelian', label: 'Pembelian' },
      { to: '/admin/keuangan/arus-kas', label: 'Arus Kas & Analisis' },
      { to: '/admin/keuangan/buku-kas', label: 'Buku Kas Transaksi' },
    ],
  },
  {
    to: '/admin/akses',
    label: 'Hak Akses',
    end: false,
    icon: Shield,
    requiredAnyPermissions: ['akses.view', 'akses.manage'],
    children: [
      { to: '/admin/akses', label: 'Pengguna & Staf', end: true },
      { to: '/admin/akses/peran', label: 'Matriks Izin Peran' },
      { to: '/admin/akses/cadangan', label: 'Cadangan & Reset Situs' },
    ],
  },
];

const ROUTE_TITLES: Record<string, string> = adminRouteTitlesData;

interface AdminHeaderMetaState {
  ownerId: string;
  title: string;
  description?: string;
}

interface AdminHeaderContextValue {
  actionsHost: HTMLDivElement | null;
  setHeaderMeta: (ownerId: string, title: string, description?: string) => void;
  clearHeaderMeta: (ownerId: string) => void;
}

const AdminHeaderContext = createContext<AdminHeaderContextValue | null>(null);

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  const ctx = useContext(AdminHeaderContext);
  const ownerId = useId();

  useEffect(() => {
    if (!ctx) return;
    ctx.setHeaderMeta(ownerId, title, description);
  }, [ctx, ownerId, title, description]);

  useEffect(() => {
    if (!ctx) return;
    return () => {
      ctx.clearHeaderMeta(ownerId);
    };
  }, [ctx, ownerId]);

  return actions && ctx?.actionsHost ? createPortal(actions, ctx.actionsHost) : null;
}

export function RequireAdminPermission({
  permission,
  children,
}: {
  permission: AdminPermission | AdminPermission[];
  children: ReactNode;
}) {
  const roles = useAdminAuthStore((state) => state.roles);
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  const currentUser = users.find((u) => u.id === sessionUserId && u.status === 'aktif') ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;

  const allowed = Array.isArray(permission)
    ? hasAnyPermission(currentRole, permission)
    : hasPermission(currentRole, permission);

  if (!allowed) {
    return (
      <div className="p-8 border border-[var(--danger-border)] bg-[var(--danger-surface)] rounded-[var(--radius-lg)] space-y-3 max-w-xl">
        <AdminPageHeader
          title="Akses Modul Dibatasi"
          description="Peran akun Anda tidak memiliki izin untuk membuka halaman ini."
        />
        <p className="text-sm text-[var(--text)] leading-relaxed">
          Peran Anda saat ini (<strong>{currentRole?.nama ?? 'Tidak diketahui'}</strong>) tidak
          memiliki izin untuk membuka halaman ini. Hubungi Super Admin atau ganti ke peran yang
          memiliki otorisasi melalui halaman login.
        </p>
        <div className="pt-2">
          <Link
            to="/admin"
            className="inline-flex items-center px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getInitialExpandedGroups(pathname: string): Record<string, boolean> {
  const clean = pathname.replace(/\/+$/, '') || '/admin';
  const initial: Record<string, boolean> = {};
  for (const item of ADMIN_NAV_ITEMS) {
    if (item.children) {
      initial[item.to] = clean === item.to || clean.startsWith(`${item.to}/`);
    }
  }
  return initial;
}

export function AdminShell() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    getInitialExpandedGroups(location.pathname)
  );
  const [headerMeta, setHeaderMetaState] = useState<AdminHeaderMetaState | null>(null);
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const logout = useAdminAuthStore((state) => state.logout);

  const currentUser = users.find((u) => u.id === sessionUserId && u.status === 'aktif') ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;

  const setHeaderMeta = useCallback((ownerId: string, title: string, description?: string) => {
    setHeaderMetaState((prev) => {
      if (
        prev &&
        prev.ownerId === ownerId &&
        prev.title === title &&
        prev.description === description
      ) {
        return prev;
      }
      return { ownerId, title, description };
    });
  }, []);

  const clearHeaderMeta = useCallback((ownerId: string) => {
    setHeaderMetaState((prev) => (prev && prev.ownerId === ownerId ? null : prev));
  }, []);

  const headerContextValue = useMemo<AdminHeaderContextValue>(
    () => ({
      actionsHost,
      setHeaderMeta,
      clearHeaderMeta,
    }),
    [actionsHost, setHeaderMeta, clearHeaderMeta]
  );

  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
  }, [location.pathname]);

  useEffect(() => {
    const clean = location.pathname.replace(/\/+$/, '') || '/admin';
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of ADMIN_NAV_ITEMS) {
        if (item.children && (clean === item.to || clean.startsWith(`${item.to}/`))) {
          if (!next[item.to]) {
            next[item.to] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [location.pathname]);

  if (!currentUser) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/admin';
  const resolvedHeaderTitle = headerMeta?.title || ROUTE_TITLES[normalizedPath] || 'Panel Admin';
  const resolvedHeaderDescription = headerMeta?.description;

  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) =>
    hasAnyPermission(currentRole, item.requiredAnyPermissions)
  );

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const sidebarBrandHeader = (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs text-[var(--text-muted)]">Panel Pengelola</p>
      <p className="text-base font-bold tracking-tight text-[var(--text)] truncate">
        {shortBrandName}
      </p>
    </div>
  );

  const sidebarBody = (
    <div className="flex-1 min-h-0 flex flex-col justify-between">
      <nav
        aria-label="Navigasi panel admin"
        data-scroll-side="left"
        className="app-scroll-region app-scroll-region-slim flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4 space-y-1"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          if (item.children && item.children.length > 0) {
            const isGroupRouteActive =
              normalizedPath === item.to || normalizedPath.startsWith(`${item.to}/`);
            const isExpanded = Boolean(expandedGroups[item.to]);
            const submenuId = `admin-submenu-${item.to.replace(/[^a-z0-9]+/gi, '-')}`;

            return (
              <div key={item.to} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  onClick={() => toggleGroup(item.to)}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors cursor-pointer whitespace-nowrap',
                    isGroupRouteActive
                      ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown
                    className={[
                      'size-4 shrink-0 transition-transform duration-200',
                      isExpanded ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </button>

                {isExpanded && (
                  <div
                    id={submenuId}
                    className="ml-4 pl-3 border-l border-[var(--border)] space-y-1 py-0.5"
                  >
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          [
                            'block px-3 py-2 rounded-[var(--radius-md)] text-xs transition-colors whitespace-nowrap truncate',
                            isActive
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                          ].join(' ')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] font-medium',
                ].join(' ')
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 pb-4 shrink-0">
        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-2 px-1.5">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-[var(--text)] truncate">{currentUser.nama}</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {currentRole?.nama ?? 'Admin'} · {currentUser.divisi}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Keluar Sesi"
              aria-label="Keluar Sesi"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between gap-2 min-h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/50 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors whitespace-nowrap"
            >
              <span>Web Publik</span>
              <ExternalLink className="size-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
            </Link>
            <ThemeToggle showLabel className="text-xs" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AdminHeaderContext.Provider value={headerContextValue}>
      <div className="h-dvh overflow-hidden flex bg-[var(--bg)] text-[var(--text)]">
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]">
          <div className="h-16 shrink-0 border-b border-[var(--border)] px-6 flex items-center">
            {sidebarBrandHeader}
          </div>
          {sidebarBody}
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />
            <aside className="relative z-10 w-72 max-w-[85vw] h-full flex flex-col border-r border-[var(--border)] bg-[var(--surface)]">
              <div className="h-16 shrink-0 px-5 border-b border-[var(--border)] flex items-center justify-between gap-3">
                {sidebarBrandHeader}
                <button
                  type="button"
                  aria-label="Tutup menu admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer shrink-0"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              {sidebarBody}
            </aside>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="shrink-0 bg-[var(--surface)]">
            <div className="min-h-16 lg:h-16 border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 py-2 lg:py-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  aria-label="Buka menu navigasi admin"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer shrink-0"
                >
                  <Menu className="size-4" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[var(--text)] truncate">
                    {resolvedHeaderTitle}
                  </h1>
                  {resolvedHeaderDescription && (
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {resolvedHeaderDescription}
                    </p>
                  )}
                </div>
              </div>

              <div
                ref={setActionsHost}
                className="empty:hidden flex flex-wrap items-center justify-end gap-2 shrink-0"
              />
            </div>
          </header>

          <main className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminHeaderContext.Provider>
  );
}

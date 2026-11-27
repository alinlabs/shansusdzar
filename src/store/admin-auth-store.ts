import { create } from 'zustand';
import {
  DEFAULT_ACTIVITY_LOGS,
  DEFAULT_ADMIN_USERS,
  OWNER_DEFAULT_ACCESS,
} from '../lib/cms-defaults';
import { saveAdminCredentialsCookie } from '../lib/admin-auth-cookie';
import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import {
  getPageAccess,
  getUserActorLabel,
  migrateLegacyPermissionsToAccess,
  sanitizePageAccessList,
  validateAdminLogin,
} from '../lib/rbac';
import type {
  AdminActivityLogItem,
  AdminPageAccessRule,
  AdminUserAccount,
} from '../types/cms';

export const ADMIN_AUTH_STORAGE_KEY = 'shansusdzar-admin-auth-v1';

interface PersistedAdminAuthPayload {
  schemaVersion: number;
  sessionUserId: string | null;
  users: AdminUserAccount[];
  activityLogs: AdminActivityLogItem[];
}

const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  'role-super-admin': [
    'dashboard.view',
    'katalog.view',
    'katalog.edit',
    'katalog.delete',
    'portofolio.view',
    'portofolio.edit',
    'portofolio.delete',
    'informasi.view',
    'informasi.edit',
    'tentang.view',
    'tentang.edit',
    'bisnis.edit',
    'keuangan.view',
    'keuangan.edit',
    'keuangan.delete',
    'marketing.view',
    'marketing.edit',
    'akses.view',
    'akses.manage',
  ],
  'role-catalog-editor': [
    'dashboard.view',
    'katalog.view',
    'katalog.edit',
    'katalog.delete',
    'portofolio.view',
  ],
  'role-content-manager': [
    'dashboard.view',
    'katalog.view',
    'portofolio.view',
    'portofolio.edit',
    'informasi.view',
    'informasi.edit',
    'tentang.view',
    'tentang.edit',
    'marketing.view',
    'marketing.edit',
  ],
  'role-viewer': [
    'dashboard.view',
    'katalog.view',
    'portofolio.view',
    'informasi.view',
    'tentang.view',
    'keuangan.view',
    'marketing.view',
    'akses.view',
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUserRecord(
  raw: Record<string, unknown>,
  legacyRoleMap?: Map<string, string[]>
): AdminUserAccount | null {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  const nama = typeof raw.nama === 'string' ? raw.nama.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const kataSandi = typeof raw.kataSandi === 'string' ? raw.kataSandi : '';
  if (!id || !nama || !email) return null;

  const legacyRoleId = typeof raw.idPeran === 'string' ? raw.idPeran : '';
  const isOwner =
    Boolean(raw.isOwner) ||
    id === 'usr-hilman' ||
    legacyRoleId === 'role-super-admin';

  let akses: AdminPageAccessRule[];
  if (isOwner) {
    akses = structuredClone(OWNER_DEFAULT_ACCESS);
  } else if (Array.isArray(raw.akses)) {
    akses = sanitizePageAccessList(raw.akses);
  } else {
    const rawPerms = Array.isArray(raw.daftarIzin)
      ? (raw.daftarIzin as string[])
      : legacyRoleMap?.get(legacyRoleId) ?? LEGACY_ROLE_PERMISSIONS[legacyRoleId] ?? [];
    akses = migrateLegacyPermissionsToAccess(rawPerms);
  }

  return {
    id,
    nama,
    email,
    kataSandi,
    isOwner,
    divisi:
      typeof raw.divisi === 'string' && raw.divisi.trim()
        ? raw.divisi.trim()
        : isOwner
          ? 'Pimpinan Studio'
          : 'Tim Studio',
    akses,
    loginTerakhir: typeof raw.loginTerakhir === 'string' ? raw.loginTerakhir : null,
  };
}

function ensureAtLeastOneOwner(users: AdminUserAccount[]): AdminUserAccount[] {
  if (users.length === 0) return structuredClone(DEFAULT_ADMIN_USERS);
  const hasOwner = users.some((u) => u.isOwner);
  if (hasOwner) return users;
  const [first, ...rest] = users;
  return [
    {
      ...first,
      isOwner: true,
      akses: structuredClone(OWNER_DEFAULT_ACCESS),
    },
    ...rest,
  ];
}

const CURRENT_ADMIN_AUTH_SCHEMA_VERSION = 6;

const LEGACY_SEED_USER_BY_EMAIL: Record<string, AdminUserAccount> = {
  'admin@shansusdzar.id': DEFAULT_ADMIN_USERS[0],
  'katalog@shansusdzar.id': DEFAULT_ADMIN_USERS[1],
  'konten@shansusdzar.id': DEFAULT_ADMIN_USERS[2],
  'audit@shansusdzar.id': DEFAULT_ADMIN_USERS[3],
  'user1@shansusdzar.com': DEFAULT_ADMIN_USERS[0],
  'user2@shansusdzar.com': DEFAULT_ADMIN_USERS[1],
  'user3@shansusdzar.com': DEFAULT_ADMIN_USERS[2],
  'user4@shansusdzar.com': DEFAULT_ADMIN_USERS[3],
};

function migrateLegacySeedUserCredentials(user: AdminUserAccount): AdminUserAccount {
  const defaultById = DEFAULT_ADMIN_USERS.find((item) => item.id === user.id);
  const defaultByLegacyEmail = LEGACY_SEED_USER_BY_EMAIL[user.email.trim().toLowerCase()];
  const matchedDefault = defaultById ?? defaultByLegacyEmail;
  if (!matchedDefault) return user;

  return {
    ...user,
    email: matchedDefault.email,
    kataSandi: matchedDefault.kataSandi,
  };
}

function loadAdminAuthState(): PersistedAdminAuthPayload {
  const fallback: PersistedAdminAuthPayload = {
    schemaVersion: CURRENT_ADMIN_AUTH_SCHEMA_VERSION,
    sessionUserId: null,
    users: structuredClone(DEFAULT_ADMIN_USERS),
    activityLogs: structuredClone(DEFAULT_ACTIVITY_LOGS),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    if (
      parsed.schemaVersion !== 2 &&
      parsed.schemaVersion !== 3 &&
      parsed.schemaVersion !== 4 &&
      parsed.schemaVersion !== 5 &&
      parsed.schemaVersion !== CURRENT_ADMIN_AUTH_SCHEMA_VERSION
    ) {
      return fallback;
    }

    const legacyRoleMap = new Map<string, string[]>();
    if (parsed.schemaVersion === 2 && Array.isArray(parsed.roles)) {
      for (const roleItem of parsed.roles) {
        if (isRecord(roleItem) && typeof roleItem.id === 'string') {
          const perms = Array.isArray(roleItem.daftarIzin)
            ? (roleItem.daftarIzin as string[])
            : [];
          legacyRoleMap.set(roleItem.id, perms);
        }
      }
    }

    const normalizedUsers: AdminUserAccount[] = Array.isArray(parsed.users)
      ? parsed.users
          .filter(isRecord)
          .map((item) => normalizeUserRecord(item, legacyRoleMap))
          .filter((item): item is AdminUserAccount => item !== null)
      : fallback.users;

    const migratedUsers =
      parsed.schemaVersion < CURRENT_ADMIN_AUTH_SCHEMA_VERSION
        ? normalizedUsers.map(migrateLegacySeedUserCredentials)
        : normalizedUsers;

    const users = ensureAtLeastOneOwner(
      migratedUsers.length > 0 ? migratedUsers : fallback.users
    );

    const activityLogs = Array.isArray(parsed.activityLogs)
      ? (parsed.activityLogs as AdminActivityLogItem[])
      : fallback.activityLogs;
    const sessionUserId =
      typeof parsed.sessionUserId === 'string' &&
      users.some((u) => u.id === parsed.sessionUserId)
        ? parsed.sessionUserId
        : null;

    const result: PersistedAdminAuthPayload = {
      schemaVersion: CURRENT_ADMIN_AUTH_SCHEMA_VERSION,
      sessionUserId,
      users,
      activityLogs,
    };

    if (parsed.schemaVersion !== CURRENT_ADMIN_AUTH_SCHEMA_VERSION) {
      saveAdminAuthState(result);
    }

    return result;
  } catch {
    return fallback;
  }
}

function saveAdminAuthState(payload: PersistedAdminAuthPayload): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization failures
  }
}

interface AdminAuthStoreState extends PersistedAdminAuthPayload {
  login: (email: string, password: string) => { ok: boolean; message?: string };
  loginAsDemoUser: (userId: string) => { ok: boolean; message?: string };
  logout: () => void;

  getCurrentUser: () => AdminUserAccount | null;

  upsertUser: (user: AdminUserAccount) => void;
  deleteUser: (userId: string) => void;

  recordActivity: (action: string, targetModule: string, targetLabel: string) => void;
  reloadFromStorage: () => void;
  resetAccessDefaults: () => void;
}

function persistFromState(state: AdminAuthStoreState): void {
  saveAdminAuthState({
    schemaVersion: CURRENT_ADMIN_AUTH_SCHEMA_VERSION,
    sessionUserId: state.sessionUserId,
    users: state.users,
    activityLogs: state.activityLogs,
  });
}

const initialAuth = loadAdminAuthState();

export const useAdminAuthStore = create<AdminAuthStoreState>((set, get) => ({
  ...initialAuth,

  login: (email, password) => {
    const state = get();
    const res = validateAdminLogin(state.users, email, password);
    if (!res.ok) {
      return { ok: false, message: res.message };
    }

    const now = new Date().toISOString();
    const nextUsers = state.users.map((u) =>
      u.id === res.user.id ? { ...u, loginTerakhir: now } : u
    );
    const logEntry: AdminActivityLogItem = {
      id: `log-${Date.now()}`,
      namaAktor: res.user.nama,
      peranAktor: getUserActorLabel(res.user),
      aksi: 'Masuk ke panel admin',
      modulTarget: 'Autentikasi',
      labelTarget: res.user.email,
      waktu: now,
    };

    const nextLogs = [logEntry, ...state.activityLogs].slice(0, 40);
    set({
      sessionUserId: res.user.id,
      users: nextUsers,
      activityLogs: nextLogs,
    });
    saveAdminCredentialsCookie(res.user.email, res.user.kataSandi);
    persistFromState(get());
    return { ok: true };
  },

  loginAsDemoUser: (userId) => {
    const state = get();
    const target = state.users.find((u) => u.id === userId);
    if (!target) {
      return { ok: false, message: 'Akun demo tidak ditemukan.' };
    }
    return get().login(target.email, target.kataSandi);
  },

  logout: () => {
    const user = get().getCurrentUser();
    if (user) {
      const logEntry: AdminActivityLogItem = {
        id: `log-${Date.now()}`,
        namaAktor: user.nama,
        peranAktor: getUserActorLabel(user),
        aksi: 'Keluar dari sesi admin',
        modulTarget: 'Autentikasi',
        labelTarget: user.email,
        waktu: new Date().toISOString(),
      };
      set({
        sessionUserId: null,
        activityLogs: [logEntry, ...get().activityLogs].slice(0, 40),
      });
    } else {
      set({ sessionUserId: null });
    }
    persistFromState(get());
  },

  getCurrentUser: () => {
    const state = get();
    if (!state.sessionUserId) return null;
    return state.users.find((u) => u.id === state.sessionUserId) ?? null;
  },

  upsertUser: (user) => {
    const state = get();
    const existing = state.users.find((u) => u.id === user.id);
    const actor = state.getCurrentUser();
    const preserveOwner = Boolean(existing?.isOwner);

    if (actor && !actor.isOwner && preserveOwner) {
      return;
    }

    if (
      actor &&
      !actor.isOwner &&
      existing &&
      getPageAccess(existing, 'pengguna') === 'editor'
    ) {
      return;
    }

    let normalizedAkses = preserveOwner
      ? structuredClone(OWNER_DEFAULT_ACCESS)
      : sanitizePageAccessList(user.akses);

    if (!preserveOwner && actor && !actor.isOwner) {
      normalizedAkses = normalizedAkses.map((rule) =>
        rule.halaman === 'pengguna' && rule.krendensial === 'editor'
          ? { ...rule, krendensial: 'view' }
          : rule
      );
    }

    const safeUser: AdminUserAccount = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      kataSandi: user.kataSandi,
      isOwner: preserveOwner,
      divisi: user.divisi,
      akses: normalizedAkses,
      loginTerakhir: user.loginTerakhir ?? existing?.loginTerakhir ?? null,
    };

    const nextUsers = existing
      ? state.users.map((u) => (u.id === safeUser.id ? safeUser : u))
      : [...state.users, safeUser];
    set({ users: nextUsers });
    if (safeUser.id === state.sessionUserId) {
      saveAdminCredentialsCookie(safeUser.email, safeUser.kataSandi);
    }
    persistFromState(get());
  },

  deleteUser: (userId) => {
    const state = get();
    const target = state.users.find((u) => u.id === userId);
    if (!target || target.isOwner || target.id === state.sessionUserId) {
      return;
    }
    set({ users: state.users.filter((u) => u.id !== userId) });
    persistFromState(get());
  },

  recordActivity: (action, targetModule, targetLabel) => {
    const user = get().getCurrentUser();
    const entry: AdminActivityLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      namaAktor: user?.nama ?? 'Sistem',
      peranAktor: getUserActorLabel(user),
      aksi: action,
      modulTarget: targetModule,
      labelTarget: targetLabel,
      waktu: new Date().toISOString(),
    };
    set({ activityLogs: [entry, ...get().activityLogs].slice(0, 40) });
    persistFromState(get());
  },

  reloadFromStorage: () => {
    set(loadAdminAuthState());
  },

  resetAccessDefaults: () => {
    const currentId = get().sessionUserId;
    const defaultUsers = structuredClone(DEFAULT_ADMIN_USERS);
    const keptSession =
      currentId && defaultUsers.some((u) => u.id === currentId) ? currentId : defaultUsers[0].id;
    set({
      sessionUserId: keptSession,
      users: defaultUsers,
      activityLogs: structuredClone(DEFAULT_ACTIVITY_LOGS),
    });
    persistFromState(get());
  },
}));

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(ADMIN_AUTH_STORAGE_KEY, () => {
    useAdminAuthStore.setState(loadAdminAuthState());
  });
}

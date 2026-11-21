import { create } from 'zustand';
import {
  ALL_ADMIN_PERMISSIONS,
  DEFAULT_ACTIVITY_LOGS,
  DEFAULT_ADMIN_ROLES,
  DEFAULT_ADMIN_USERS,
} from '../lib/cms-defaults';
import { resolveUserRole, validateAdminLogin } from '../lib/rbac';
import type {
  AdminActivityLogItem,
  AdminPermission,
  AdminRoleDefinition,
  AdminUserAccount,
} from '../types/cms';

export const ADMIN_AUTH_STORAGE_KEY = 'shansusdzar-admin-auth-v1';

interface PersistedAdminAuthPayload {
  schemaVersion: number;
  sessionUserId: string | null;
  users: AdminUserAccount[];
  roles: AdminRoleDefinition[];
  activityLogs: AdminActivityLogItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadAdminAuthState(): PersistedAdminAuthPayload {
  const fallback: PersistedAdminAuthPayload = {
    schemaVersion: 2,
    sessionUserId: null,
    users: structuredClone(DEFAULT_ADMIN_USERS),
    roles: structuredClone(DEFAULT_ADMIN_ROLES),
    activityLogs: structuredClone(DEFAULT_ACTIVITY_LOGS),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return fallback;

    const users = Array.isArray(parsed.users)
      ? (parsed.users as AdminUserAccount[])
      : fallback.users;
    const rawRoles = Array.isArray(parsed.roles)
      ? (parsed.roles as AdminRoleDefinition[])
      : fallback.roles;
    const roles = rawRoles.map((role) =>
      role.peranSistem || role.id === 'role-super-admin'
        ? {
            ...role,
            daftarIzin: Array.from(new Set([...role.daftarIzin, ...ALL_ADMIN_PERMISSIONS])),
          }
        : role
    );
    const activityLogs = Array.isArray(parsed.activityLogs)
      ? (parsed.activityLogs as AdminActivityLogItem[])
      : fallback.activityLogs;
    const sessionUserId =
      typeof parsed.sessionUserId === 'string' &&
      users.some((u) => u.id === parsed.sessionUserId && u.status === 'aktif')
        ? parsed.sessionUserId
        : null;

    return {
      schemaVersion: 2,
      sessionUserId,
      users,
      roles,
      activityLogs,
    };
  } catch {
    return fallback;
  }
}

function saveAdminAuthState(payload: PersistedAdminAuthPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota failures
  }
}

interface AdminAuthStoreState extends PersistedAdminAuthPayload {
  login: (email: string, password: string) => { ok: boolean; message?: string };
  loginAsDemoUser: (userId: string) => { ok: boolean; message?: string };
  logout: () => void;

  getCurrentUser: () => AdminUserAccount | null;
  getCurrentRole: () => AdminRoleDefinition | null;

  upsertUser: (user: AdminUserAccount) => void;
  deleteUser: (userId: string) => void;

  upsertRole: (role: AdminRoleDefinition) => void;
  updateRolePermissions: (roleId: string, permissions: AdminPermission[]) => void;
  deleteRole: (roleId: string) => void;

  recordActivity: (action: string, targetModule: string, targetLabel: string) => void;
  resetAccessDefaults: () => void;
}

function persistFromState(state: AdminAuthStoreState): void {
  saveAdminAuthState({
    schemaVersion: 2,
    sessionUserId: state.sessionUserId,
    users: state.users,
    roles: state.roles,
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
    const role = state.roles.find((r) => r.id === res.user.idPeran);
    const logEntry: AdminActivityLogItem = {
      id: `log-${Date.now()}`,
      namaAktor: res.user.nama,
      peranAktor: role?.nama ?? 'Admin',
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
    persistFromState(get());
    return { ok: true };
  },

  loginAsDemoUser: (userId) => {
    const state = get();
    const target = state.users.find((u) => u.id === userId);
    if (!target) {
      return { ok: false, message: 'Akun demo tidak ditemukan.' };
    }
    if (target.status !== 'aktif') {
      return { ok: false, message: 'Akun ini sedang dinonaktifkan.' };
    }
    return get().login(target.email, target.kataSandi);
  },

  logout: () => {
    const user = get().getCurrentUser();
    const role = get().getCurrentRole();
    if (user) {
      const logEntry: AdminActivityLogItem = {
        id: `log-${Date.now()}`,
        namaAktor: user.nama,
        peranAktor: role?.nama ?? 'Admin',
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
    return state.users.find((u) => u.id === state.sessionUserId && u.status === 'aktif') ?? null;
  },

  getCurrentRole: () => {
    const state = get();
    const user = state.getCurrentUser();
    return resolveUserRole(user, state.roles);
  },

  upsertUser: (user) => {
    const state = get();
    const exists = state.users.some((u) => u.id === user.id);
    const nextUsers = exists
      ? state.users.map((u) => (u.id === user.id ? user : u))
      : [...state.users, user];
    set({ users: nextUsers });
    persistFromState(get());
  },

  deleteUser: (userId) => {
    set({ users: get().users.filter((u) => u.id !== userId) });
    persistFromState(get());
  },

  upsertRole: (role) => {
    const state = get();
    const exists = state.roles.some((r) => r.id === role.id);
    const nextRoles = exists
      ? state.roles.map((r) => (r.id === role.id ? role : r))
      : [...state.roles, role];
    set({ roles: nextRoles });
    persistFromState(get());
  },

  updateRolePermissions: (roleId, permissions) => {
    const nextRoles = get().roles.map((r) =>
      r.id === roleId ? { ...r, daftarIzin: Array.from(new Set(permissions)) } : r
    );
    set({ roles: nextRoles });
    persistFromState(get());
  },

  deleteRole: (roleId) => {
    set({ roles: get().roles.filter((r) => r.id !== roleId) });
    persistFromState(get());
  },

  recordActivity: (action, targetModule, targetLabel) => {
    const user = get().getCurrentUser();
    const role = get().getCurrentRole();
    const entry: AdminActivityLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      namaAktor: user?.nama ?? 'Sistem',
      peranAktor: role?.nama ?? 'Admin',
      aksi: action,
      modulTarget: targetModule,
      labelTarget: targetLabel,
      waktu: new Date().toISOString(),
    };
    set({ activityLogs: [entry, ...get().activityLogs].slice(0, 40) });
    persistFromState(get());
  },

  resetAccessDefaults: () => {
    const currentId = get().sessionUserId;
    const defaultUsers = structuredClone(DEFAULT_ADMIN_USERS);
    const keptSession =
      currentId && defaultUsers.some((u) => u.id === currentId) ? currentId : defaultUsers[0].id;
    set({
      sessionUserId: keptSession,
      users: defaultUsers,
      roles: structuredClone(DEFAULT_ADMIN_ROLES),
      activityLogs: structuredClone(DEFAULT_ACTIVITY_LOGS),
    });
    persistFromState(get());
  },
}));

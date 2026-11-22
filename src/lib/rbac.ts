import rbacPermissionsData from '../data/daftar-izin-akses.json';
import type { AdminPermission, AdminRoleDefinition, AdminUserAccount } from '../types/cms';

export interface PermissionMetadata {
  kodeIzin: AdminPermission;
  modul: string;
  label: string;
  deskripsi: string;
}

export const PERMISSION_CATALOG: PermissionMetadata[] =
  rbacPermissionsData as PermissionMetadata[];

export function resolveUserRole(
  user: AdminUserAccount | null,
  roles: readonly AdminRoleDefinition[]
): AdminRoleDefinition | null {
  if (!user) return null;
  return roles.find((r) => r.id === user.idPeran) ?? null;
}

export function hasPermission(
  role: AdminRoleDefinition | null | undefined,
  permission: AdminPermission
): boolean {
  if (!role) return false;
  return role.daftarIzin.includes(permission);
}

export function hasAnyPermission(
  role: AdminRoleDefinition | null | undefined,
  permissions: readonly AdminPermission[]
): boolean {
  if (!role) return false;
  return permissions.some((perm) => role.daftarIzin.includes(perm));
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

  if (matched.status !== 'aktif') {
    return {
      ok: false,
      message: 'Akun ini sedang dinonaktifkan. Hubungi Super Admin untuk mengaktifkan kembali.',
    };
  }

  return { ok: true, user: matched };
}

export function countActiveSuperAdmins(
  users: readonly AdminUserAccount[],
  roles: readonly AdminRoleDefinition[]
): number {
  const superRoleIds = new Set(
    roles.filter((r) => r.daftarIzin.includes('akses.manage')).map((r) => r.id)
  );
  return users.filter((u) => u.status === 'aktif' && superRoleIds.has(u.idPeran)).length;
}

export function canDeactivateOrDeleteUser(
  targetUser: AdminUserAccount,
  currentSessionUserId: string | null,
  users: readonly AdminUserAccount[],
  roles: readonly AdminRoleDefinition[]
): { allowed: boolean; reason?: string } {
  if (targetUser.id === currentSessionUserId) {
    return {
      allowed: false,
      reason: 'Tidak dapat menonaktifkan atau menghapus akun yang sedang aktif masuk.',
    };
  }

  const targetRole = roles.find((r) => r.id === targetUser.idPeran);
  const isTargetSuper = Boolean(targetRole?.daftarIzin.includes('akses.manage'));

  if (isTargetSuper && targetUser.status === 'aktif') {
    const activeSuperCount = countActiveSuperAdmins(users, roles);
    if (activeSuperCount <= 1) {
      return {
        allowed: false,
        reason: 'Minimal harus terdapat satu pengelola aktif dengan hak kelola akses.',
      };
    }
  }

  return { allowed: true };
}

export function canDeleteRole(
  role: AdminRoleDefinition,
  users: readonly AdminUserAccount[]
): { allowed: boolean; reason?: string } {
  if (role.peranSistem) {
    return {
      allowed: false,
      reason: 'Peran sistem bawaan tidak dapat dihapus.',
    };
  }
  const assignedCount = users.filter((u) => u.idPeran === role.id).length;
  if (assignedCount > 0) {
    return {
      allowed: false,
      reason: `Masih ada ${assignedCount} pengguna yang memakai peran ini.`,
    };
  }
  return { allowed: true };
}

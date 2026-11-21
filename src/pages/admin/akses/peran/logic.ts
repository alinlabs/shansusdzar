import { PERMISSION_CATALOG } from '../../../../lib/rbac';
import type { AdminRoleDefinition } from '../../../../types/cms';

export interface RoleValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyRole(): AdminRoleDefinition {
  return {
    id: `role-${Date.now()}`,
    nama: '',
    deskripsi: '',
    peranSistem: false,
    daftarIzin: ['dashboard.view'],
  };
}

export function validateRoleDraft(role: AdminRoleDefinition): RoleValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!role.nama.trim()) {
    fieldErrors.nama = 'Nama peran wajib diisi.';
  }
  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Periksa kolom peran RBAC.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeRolePayload(role: AdminRoleDefinition): AdminRoleDefinition {
  return {
    ...role,
    nama: role.nama.trim(),
    deskripsi: role.deskripsi.trim(),
    daftarIzin: role.peranSistem
      ? Array.from(new Set([...role.daftarIzin, 'akses.manage']))
      : role.daftarIzin,
  };
}

export function groupPermissionCatalog() {
  return PERMISSION_CATALOG.reduce<Record<string, typeof PERMISSION_CATALOG>>((acc, item) => {
    if (!acc[item.modul]) acc[item.modul] = [];
    acc[item.modul].push(item);
    return acc;
  }, {});
}

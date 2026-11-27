import { buildUniformPageAccess, sanitizePageAccessList } from '../../../../lib/rbac';
import type { AdminUserAccount } from '../../../../types/cms';

export interface UserValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyUser(): AdminUserAccount {
  return {
    id: `usr-${Date.now()}`,
    nama: '',
    email: '',
    kataSandi: 'admin123',
    isOwner: false,
    divisi: 'Tim Studio',
    akses: buildUniformPageAccess('hide'),
    loginTerakhir: null,
  };
}

export function validateUserDraft(
  user: AdminUserAccount,
  existingUsers: readonly AdminUserAccount[]
): UserValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!user.nama.trim()) {
    fieldErrors.nama = 'Nama lengkap pengguna wajib diisi.';
  }
  const normalizedEmail = user.email.trim().toLowerCase();
  if (!normalizedEmail) {
    fieldErrors.email = 'Email login wajib diisi.';
  } else if (existingUsers.some((u) => u.email.toLowerCase() === normalizedEmail && u.id !== user.id)) {
    fieldErrors.email = 'Email ini sudah digunakan oleh pengguna lain.';
  }
  if (!user.kataSandi.trim()) {
    fieldErrors.kataSandi = 'Kata sandi wajib diisi.';
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Periksa data pengguna.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeUserPayload(user: AdminUserAccount): AdminUserAccount {
  const isOwner = Boolean(user.isOwner);
  return {
    ...user,
    nama: user.nama.trim(),
    email: user.email.trim().toLowerCase(),
    kataSandi: user.kataSandi.trim(),
    divisi: user.divisi.trim() || 'Tim Studio',
    isOwner,
    akses: isOwner ? buildUniformPageAccess('editor') : sanitizePageAccessList(user.akses),
  };
}

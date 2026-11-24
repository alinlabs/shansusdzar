import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminForm, type AdminFormSectionConfig } from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { AdminUserAccount } from '../../../../types/cms';
import { createEmptyUser, normalizeUserPayload, validateUserDraft } from './logic';

const BACK_PATH = '/admin/akses';

export default function AdminAksesPenggunaFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const upsertUser = useAdminAuthStore((state) => state.upsertUser);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canManage = hasPermission(currentRole, 'akses.manage');

  const isEditMode = Boolean(id);
  const existingUser = useMemo(
    () => (id ? users.find((u) => u.id === id) ?? null : null),
    [id, users]
  );

  const [values, setValues] = useState<AdminUserAccount>(() =>
    existingUser ? structuredClone(existingUser) : createEmptyUser(roles)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Akun Staf Admin' : 'Tambah Staf Pengelola Admin'} | Hak Akses Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<AdminUserAccount>[]>(
    () => [
      {
        id: 'akun-staf',
        title: 'Identitas Staf',
        columns: 2,
        fields: [
          {
            name: 'nama',
            label: 'Nama Lengkap',
            type: 'text',
            required: true,
          },
          {
            name: 'email',
            label: 'Email Login',
            type: 'email',
            required: true,
          },
          {
            name: 'kataSandi',
            label: 'Kata Sandi',
            type: 'text',
            required: true,
          },
          {
            name: 'divisi',
            label: 'Divisi / Bagian',
            type: 'text',
          },
          {
            name: 'idPeran',
            label: 'Peran RBAC',
            type: 'select',
            required: true,
            options: roles.map((r) => ({ value: r.id, label: r.nama })),
          },
          {
            name: 'status',
            label: 'Status Akun',
            type: 'select',
            options: [
              { value: 'aktif', label: 'Aktif' },
              { value: 'ditangguhkan', label: 'Nonaktif' },
            ],
          },
        ],
      },
    ],
    [roles]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    const validation = validateUserDraft(values, users);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeUserPayload(values);
    upsertUser(payload);
    recordActivity(
      isEditMode ? 'Memperbarui akun staf admin' : 'Menambahkan akun staf admin',
      'Hak Akses',
      payload.email
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Data pengguna "${payload.nama}" disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna'}
      backTo={BACK_PATH}
      backLabel="Kembali ke Pengguna"
      submitLabel="Simpan Pengguna"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canManage}
      notFoundState={
        isEditMode && !existingUser
          ? {
              title: 'Pengguna Tidak Ditemukan',
              message: 'Data akun staf tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
    />
  );
}

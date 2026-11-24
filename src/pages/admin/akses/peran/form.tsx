import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminForm, type AdminFormSectionConfig } from '../../../../components/admin/admin-form';
import { Checkbox } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { AdminPermission, AdminRoleDefinition } from '../../../../types/cms';
import {
  createEmptyRole,
  groupPermissionCatalog,
  normalizeRolePayload,
  validateRoleDraft,
} from './logic';

const BACK_PATH = '/admin/akses/peran';

export default function AdminAksesPeranFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const upsertRole = useAdminAuthStore((state) => state.upsertRole);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canManage = hasPermission(currentRole, 'akses.manage');

  const isEditMode = Boolean(id);
  const existingRole = useMemo(
    () => (id ? roles.find((r) => r.id === id) ?? null : null),
    [id, roles]
  );

  const [values, setValues] = useState<AdminRoleDefinition>(() =>
    existingRole ? structuredClone(existingRole) : createEmptyRole()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Ubah Peran RBAC' : 'Buat Peran RBAC Baru'} | Hak Akses Admin ${shortBrandName}`
  );

  const groupedPermissions = useMemo(() => groupPermissionCatalog(), []);

  const sections = useMemo<AdminFormSectionConfig<AdminRoleDefinition>[]>(
    () => [
      {
        id: 'identitas-peran',
        title: 'Identitas Peran',
        columns: 1,
        fields: [
          {
            name: 'nama',
            label: 'Nama Peran',
            type: 'text',
            required: true,
            placeholder: 'Kepala Produksi',
          },
          {
            name: 'deskripsi',
            label: 'Deskripsi',
            type: 'textarea',
            rows: 2,
          },
        ],
      },
      {
        id: 'izin-peran',
        title: 'Matriks Izin',
        renderContent: (ctx) => (
          <div className="space-y-5">
            {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
              <div key={moduleName} className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text)]">{moduleName}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {perms.map((meta) => {
                    const checked = ctx.values.daftarIzin.includes(meta.kodeIzin);
                    const locked = ctx.values.peranSistem && meta.kodeIzin === 'akses.manage';
                    return (
                      <div
                        key={meta.kodeIzin}
                        className="px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/40"
                      >
                        <Checkbox
                          label={meta.label}
                          description={meta.deskripsi}
                          disabled={ctx.readOnly || locked}
                          checked={checked}
                          onChange={() => {
                            if (locked) return;
                            const nextPermissions: AdminPermission[] = checked
                              ? ctx.values.daftarIzin.filter((p) => p !== meta.kodeIzin)
                              : [...ctx.values.daftarIzin, meta.kodeIzin];
                            ctx.setFieldValue('daftarIzin', nextPermissions);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ),
      },
    ],
    [groupedPermissions]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    const validation = validateRoleDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeRolePayload(values);
    upsertRole(payload);
    recordActivity(
      isEditMode ? 'Memperbarui definisi peran RBAC' : 'Menyimpan definisi peran baru',
      'Hak Akses',
      payload.nama
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Peran "${payload.nama}" disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Peran' : 'Buat Peran'}
      backTo={BACK_PATH}
      backLabel="Kembali ke Peran"
      submitLabel="Simpan Peran"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canManage}
      notFoundState={
        isEditMode && !existingRole
          ? {
              title: 'Peran Tidak Ditemukan',
              message: 'Data peran tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
    />
  );
}

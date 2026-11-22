import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Checkbox } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canDeleteRole, hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { AdminPermission } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';
import { groupPermissionCatalog } from './logic';

export default function AdminAksesPeranPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const updateRolePermissions = useAdminAuthStore((state) => state.updateRolePermissions);
  const deleteRole = useAdminAuthStore((state) => state.deleteRole);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Matriks Izin Peran | Hak Akses Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canManage = hasPermission(currentRole, 'akses.manage');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id ?? 'role-super-admin');

  const selectedMatrixRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const groupedPermissions = groupPermissionCatalog();

  const handleTogglePermission = (perm: AdminPermission) => {
    if (!canManage || !selectedMatrixRole) return;
    if (selectedMatrixRole.peranSistem && perm === 'akses.manage') {
      setFeedback({
        type: 'err',
        text: 'Izin kelola akses pada peran sistem Super Admin tidak dapat dicabut.',
      });
      return;
    }
    const exists = selectedMatrixRole.daftarIzin.includes(perm);
    const nextPermissions = exists
      ? selectedMatrixRole.daftarIzin.filter((p) => p !== perm)
      : [...selectedMatrixRole.daftarIzin, perm];

    updateRolePermissions(selectedMatrixRole.id, nextPermissions);
    recordActivity('Mengubah izin peran RBAC', 'Hak Akses', `${selectedMatrixRole.nama}: ${perm}`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Matriks Izin Peran (RBAC)"
        description="Atur hak baca, ubah, dan hapus per modul untuk setiap peran staf internal."
        actions={
          canManage ? (
            <Link
              to="/admin/akses/peran/baru"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Peran Baru
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Daftar Peran ({roles.length})</h2>
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)] overflow-hidden">
            {roles.map((role) => {
              const selected = role.id === selectedMatrixRole?.id;
              const roleDeleteCheck = canDeleteRole(role, users);
              return (
                <div
                  key={role.id}
                  className={[
                    'p-4 transition-colors',
                    selected ? 'bg-[var(--surface-muted)]' : 'hover:bg-[var(--surface-elevated)]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-[var(--text)]">{role.nama}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                        {role.daftarIzin.length} izin aktif
                        {role.peranSistem ? ' · Sistem' : ''}
                      </p>
                    </button>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={`/admin/akses/peran/${role.id}/edit`}
                          aria-label={`Edit detail peran ${role.nama}`}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Link>
                        {!role.peranSistem && (
                          <button
                            type="button"
                            aria-label={`Hapus peran ${role.nama}`}
                            disabled={!roleDeleteCheck.allowed}
                            title={roleDeleteCheck.reason ?? 'Hapus peran'}
                            onClick={() => {
                              if (!roleDeleteCheck.allowed) return;
                              deleteRole(role.id);
                              recordActivity('Menghapus peran RBAC', 'Hak Akses', role.nama);
                              setFeedback({
                                type: 'ok',
                                text: `Peran "${role.nama}" telah dihapus.`,
                              });
                            }}
                            className="p-1.5 rounded text-[var(--danger)] hover:bg-[var(--danger-surface)] disabled:opacity-35 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-5">
          {selectedMatrixRole && (
            <>
              <div className="pb-4 border-b border-[var(--border)] flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    Matriks Izin: {selectedMatrixRole.nama}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedMatrixRole.deskripsi}
                  </p>
                </div>
                {canManage && (
                  <Link
                    to={`/admin/akses/peran/${selectedMatrixRole.id}/edit`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Ubah Info &amp; Izin
                  </Link>
                )}
              </div>

              <div className="space-y-5">
                {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
                  <div key={moduleName} className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text)]">{moduleName}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {perms.map((meta) => {
                        const checked = selectedMatrixRole.daftarIzin.includes(meta.kodeIzin);
                        return (
                          <div
                            key={meta.kodeIzin}
                            className="px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/40"
                          >
                            <Checkbox
                              label={meta.label}
                              description={meta.deskripsi}
                              disabled={!canManage}
                              checked={checked}
                              onChange={() => handleTogglePermission(meta.kodeIzin)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

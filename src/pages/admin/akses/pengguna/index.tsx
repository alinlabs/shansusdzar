import { Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canDeactivateOrDeleteUser, hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { AdminUserAccount } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminAksesPenggunaPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const upsertUser = useAdminAuthStore((state) => state.upsertUser);
  const deleteUser = useAdminAuthStore((state) => state.deleteUser);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pengguna & Staf | Hak Akses Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canManage = hasPermission(currentRole, 'akses.manage');

  const [feedback, setFeedback] = useAdminFeedbackState();

  const handleToggleUserStatus = (user: AdminUserAccount) => {
    if (!canManage) return;
    if (user.status === 'aktif') {
      const guard = canDeactivateOrDeleteUser(user, sessionUserId, users, roles);
      if (!guard.allowed) {
        setFeedback({ type: 'err', text: guard.reason ?? 'Aksi tidak diizinkan.' });
        return;
      }
    }
    const nextStatus = user.status === 'aktif' ? 'ditangguhkan' : 'aktif';
    upsertUser({ ...user, status: nextStatus });
    recordActivity(
      nextStatus === 'aktif' ? 'Mengaktifkan akun staf' : 'Menonaktifkan akun staf',
      'Hak Akses',
      user.email
    );
    setFeedback({
      type: 'ok',
      text: `Status akun ${user.nama} diubah menjadi ${nextStatus === 'aktif' ? 'Aktif' : 'Nonaktif'}.`,
    });
  };

  const handleDeleteUser = (user: AdminUserAccount) => {
    if (!canManage) return;
    const guard = canDeactivateOrDeleteUser(user, sessionUserId, users, roles);
    if (!guard.allowed) {
      setFeedback({ type: 'err', text: guard.reason ?? 'Tidak dapat menghapus pengguna.' });
      return;
    }
    deleteUser(user.id);
    recordActivity('Menghapus akun staf', 'Hak Akses', user.email);
    setFeedback({ type: 'ok', text: `Pengguna "${user.nama}" telah dihapus.` });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Pengguna"
        actions={
          canManage ? (
            <AdminActionLink
              to="/admin/akses/pengguna/baru"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              label="Tambah Staf Admin"
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="md:hidden space-y-2.5">
        {users.map((user) => {
          const role = roles.find((r) => r.id === user.idPeran);
          const isSelf = user.id === sessionUserId;
          const isActive = user.status === 'aktif';
          return (
            <div
              key={user.id}
              className="p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {user.nama}
                    {isSelf && (
                      <span className="ml-1.5 text-[11px] font-normal text-[var(--text-muted)]">
                        (Anda)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
                <span
                  className={
                    isActive
                      ? 'text-[11px] text-[var(--success)] font-medium shrink-0'
                      : 'text-[11px] text-[var(--danger)] font-medium shrink-0'
                  }
                >
                  {isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {role?.nama ?? user.idPeran} · {user.divisi}
                </p>
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AdminActionButton
                      icon={isActive ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                      label={isActive ? `Nonaktifkan ${user.nama}` : `Aktifkan ${user.nama}`}
                      iconOnly
                      onClick={() => handleToggleUserStatus(user)}
                    />
                    <AdminActionLink
                      to={`/admin/akses/pengguna/${user.id}/edit`}
                      icon={<Pencil className="size-3.5" />}
                      label={`Edit pengguna ${user.nama}`}
                      iconOnly
                    />
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus pengguna ${user.nama}`}
                      iconOnly
                      onClick={() => handleDeleteUser(user)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                <th className="py-3 px-4 font-medium">Nama &amp; Email</th>
                <th className="py-3 px-4 font-medium">Peran</th>
                <th className="py-3 px-4 font-medium">Divisi</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((user) => {
                const role = roles.find((r) => r.id === user.idPeran);
                const isSelf = user.id === sessionUserId;
                const isActive = user.status === 'aktif';
                return (
                  <tr key={user.id} className="hover:bg-[var(--surface-elevated)]">
                    <td className="py-3 px-4">
                      <p className="font-medium text-[var(--text)]">
                        {user.nama}
                        {isSelf && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">(Sesi Anda)</span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-[var(--text)]">
                      {role?.nama ?? user.idPeran}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{user.divisi}</td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={
                          isActive
                            ? 'text-[var(--success)] font-medium'
                            : 'text-[var(--danger)] font-medium'
                        }
                      >
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <AdminActionButton
                              icon={isActive ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                              label={isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              onClick={() => handleToggleUserStatus(user)}
                            />
                            <AdminActionLink
                              to={`/admin/akses/pengguna/${user.id}/edit`}
                              icon={<Pencil className="size-3.5" />}
                              label={`Edit pengguna ${user.nama}`}
                              iconOnly
                            />
                            <AdminActionButton
                              variant="danger"
                              icon={<Trash2 className="size-3.5" />}
                              label={`Hapus pengguna ${user.nama}`}
                              iconOnly
                              onClick={() => handleDeleteUser(user)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


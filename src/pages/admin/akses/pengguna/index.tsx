import { useMemo, useState } from 'react';
import { Lock, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { filterAdminUsers } from '../../../../lib/admin-header-search';
import {
  canDeleteUser,
  canEditPage,
  canEditTargetUser,
  formatUserAccessSummary,
} from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { AdminUserAccount } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminAksesPenggunaPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const deleteUser = useAdminAuthStore((state) => state.deleteUser);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pengguna | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canManage = canEditPage(currentUser, 'pengguna');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(
    () => filterAdminUsers(users, searchQuery),
    [users, searchQuery]
  );

  const hasSearchQuery = searchQuery.trim() !== '';

  const handleDeleteUser = (user: AdminUserAccount) => {
    if (!canManage) return;
    const guard = canDeleteUser(user, sessionUserId, users, currentUser);
    if (!guard.allowed) {
      setFeedback({ type: 'err', text: guard.reason ?? 'Tidak dapat menghapus pengguna.' });
      return;
    }
    deleteUser(user.id);
    recordActivity('Menghapus akun pengguna', 'Pengguna', user.email);
    setFeedback({ type: 'ok', text: `Pengguna "${user.nama}" telah dihapus.` });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Pengguna"
        description="Kelola akun pengelola admin dan atur hak akses halaman setiap pengguna."
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari nama, email, keterangan, atau hak akses...',
          ariaLabel: 'Cari pengguna admin',
          onResetAll: () => setSearchQuery(''),
        }}
        actions={
          canManage ? (
            <AdminActionLink
              to="/admin/akses/pengguna/baru"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              label="Tambah Pengguna"
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {filteredUsers.length === 0 ? (
        <div className="p-8 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-center space-y-3">
          <Users className="size-8 text-[var(--text-muted)] mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--text)]">
              Tidak ada pengguna yang cocok
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Ubah kata kunci pencarian untuk melihat daftar pengguna.
            </p>
          </div>
          {hasSearchQuery && (
            <AdminActionButton
              variant="ghost"
              icon={<RotateCcw className="size-3.5" />}
              label="Reset Pencarian"
              hideLabelOnMobile={false}
              onClick={() => setSearchQuery('')}
            />
          )}
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2.5">
            {filteredUsers.map((user) => {
              const isSelf = user.id === sessionUserId;
              const editGuard = canEditTargetUser(currentUser, user);
              const deleteGuard = canDeleteUser(user, sessionUserId, users, currentUser);
              const accessSummary = formatUserAccessSummary(user);

              return (
                <div
                  key={user.id}
                  className="p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2.5"
                >
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

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {accessSummary} · {user.divisi}
                    </p>
                    {canManage && editGuard.allowed ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <AdminActionLink
                          to={`/admin/akses/pengguna/${user.id}/edit`}
                          icon={<Pencil className="size-3.5" />}
                          label={`Edit pengguna ${user.nama}`}
                          iconOnly
                        />
                        {deleteGuard.allowed && (
                          <AdminActionButton
                            variant="danger"
                            icon={<Trash2 className="size-3.5" />}
                            label={`Hapus pengguna ${user.nama}`}
                            iconOnly
                            onClick={() => handleDeleteUser(user)}
                          />
                        )}
                      </div>
                    ) : user.isOwner ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] shrink-0">
                        <Lock className="size-3" aria-hidden="true" />
                        Akun Utama
                      </span>
                    ) : null}
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
                    <th className="py-3 px-4 font-medium">Keterangan</th>
                    <th className="py-3 px-4 font-medium">Hak Akses</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((user) => {
                    const isSelf = user.id === sessionUserId;
                    const editGuard = canEditTargetUser(currentUser, user);
                    const deleteGuard = canDeleteUser(user, sessionUserId, users, currentUser);
                    const accessSummary = formatUserAccessSummary(user);

                    return (
                      <tr key={user.id} className="hover:bg-[var(--surface-elevated)]">
                        <td className="py-3 px-4">
                          <p className="font-medium text-[var(--text)]">
                            {user.nama}
                            {isSelf && (
                              <span className="ml-2 text-xs text-[var(--text-muted)]">
                                (Sesi Anda)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{user.divisi}</td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={
                              user.isOwner
                                ? 'inline-flex items-center gap-1.5 font-semibold text-[var(--text)]'
                                : 'font-medium text-[var(--text)]'
                            }
                          >
                            {accessSummary}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManage && editGuard.allowed ? (
                              <>
                                <AdminActionLink
                                  to={`/admin/akses/pengguna/${user.id}/edit`}
                                  icon={<Pencil className="size-3.5" />}
                                  label={`Edit pengguna ${user.nama}`}
                                  iconOnly
                                />
                                {deleteGuard.allowed && (
                                  <AdminActionButton
                                    variant="danger"
                                    icon={<Trash2 className="size-3.5" />}
                                    label={`Hapus pengguna ${user.nama}`}
                                    iconOnly
                                    onClick={() => handleDeleteUser(user)}
                                  />
                                )}
                              </>
                            ) : user.isOwner ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <Lock className="size-3.5" aria-hidden="true" />
                                Akun Utama
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

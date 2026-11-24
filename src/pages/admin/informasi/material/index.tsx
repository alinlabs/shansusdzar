import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminMaterialPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const materials = useSiteContentStore((state) => state.materials);
  const deleteMaterial = useSiteContentStore((state) => state.deleteMaterial);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Matriks Material | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'informasi.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Matriks Spesifikasi Material"
        description="Kelola daftar material utama (Blockboard, Multipleks, PVC Board) dan finishing/laminasi (HPL, Cat Duco)."
        actions={
          canEdit ? (
            <Link
              to="/admin/informasi/material/baru"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Material
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
        {materials.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada data spesifikasi material terdaftar.
          </div>
        ) : (
          materials.map((mat) => (
            <div
              key={mat.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">
                  {mat.kategori === 'papan' ? 'Material Utama' : 'Finishing/Laminasi'} · Lembap{' '}
                  {mat.ketahananLembap} · Struktur {mat.peringkatKeawetan} · Keterjangkauan{' '}
                  {mat.keterjangkauan}
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">{mat.nama}</p>
                <p className="text-xs text-[var(--text-muted)]">{mat.ringkasan}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    to={`/admin/informasi/material/${mat.id}/edit`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    aria-label={`Hapus material ${mat.nama}`}
                    onClick={() => {
                      deleteMaterial(mat.id);
                      recordActivity('Menghapus spesifikasi material', 'Informasi', mat.nama);
                      setFeedback({
                        type: 'ok',
                        text: `Material "${mat.nama}" telah dihapus.`,
                      });
                    }}
                    className="p-2 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] cursor-pointer"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

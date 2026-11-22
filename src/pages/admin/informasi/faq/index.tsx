import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminFaqPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const faqs = useSiteContentStore((state) => state.faqs);
  const deleteFaq = useSiteContentStore((state) => state.deleteFaq);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pusat FAQ | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'informasi.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pusat Tanya Jawab (FAQ)"
        description="Kelola pertanyaan yang sering diajukan calon klien mengenai survei, material, dan garansi."
        actions={
          canEdit ? (
            <Link
              to="/admin/informasi/faq/baru"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Pertanyaan FAQ
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <p className="text-[var(--text-muted)] leading-relaxed">
          Rincian tahapan DP &amp; termin di halaman publik <strong className="text-[var(--text)]">/faq</strong>{' '}
          (termasuk item pembayaran) otomatis tersinkronisasi dari pengaturan{' '}
          <strong className="text-[var(--text)]">Skema Pembayaran</strong> resmi workshop.
        </p>
        <Link
          to="/admin/produk/skema-pembayaran"
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap shrink-0"
        >
          Kelola Skema Pembayaran
        </Link>
      </div>

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
        {faqs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada entri FAQ terdaftar.
          </div>
        ) : (
          faqs.map((faq) => (
            <div
              key={faq.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]">
                  #{faq.urutan} · {faq.kategori} · {faq.terbit ? 'Terbit' : 'Draft'}
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">{faq.pertanyaan}</p>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">{faq.jawaban}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    to={`/admin/informasi/faq/${faq.id}/edit`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    aria-label={`Hapus FAQ ${faq.pertanyaan}`}
                    onClick={() => {
                      deleteFaq(faq.id);
                      recordActivity('Menghapus entri FAQ', 'Informasi', faq.pertanyaan.slice(0, 40));
                      setFeedback({
                        type: 'ok',
                        text: 'Pertanyaan FAQ telah dihapus.',
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

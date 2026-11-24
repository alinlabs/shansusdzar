import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminBeritaPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const deleteNewsArticle = useSiteContentStore((state) => state.deleteNewsArticle);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Berita & Artikel SEO | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'informasi.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Berita & Artikel SEO"
        description="Kelola publikasi berita & artikel SEO Google agar workshop mudah ditemukan calon klien."
        actions={
          canEdit ? (
            <Link
              to="/admin/informasi/berita/baru"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tulis Berita Baru
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
        {newsArticles.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada berita atau artikel SEO yang diterbitkan.
          </div>
        ) : (
          newsArticles.map((article) => (
            <div
              key={article.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-20 shrink-0">
                  <ImageFallback
                    src={article.gambarSampul}
                    alt={article.teksAltSampul || article.judul}
                    aspectRatio="4/3"
                    className="rounded-[var(--radius-sm)]"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    {article.kategori} · {article.tanggalTerbit} ·{' '}
                    {article.terbit ? 'Terbit' : 'Draft'}
                    {article.unggulan ? ' · Berita Utama' : ''}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {article.judul}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    /berita/{article.slug} · {article.kataKunciSeo.length} kata kunci SEO
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {article.terbit && (
                  <Link
                    to={`/berita/${article.slug}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    Lihat
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                )}
                {canEdit && (
                  <>
                    <Link
                      to={`/admin/informasi/berita/${article.id}/edit`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      aria-label={`Hapus berita ${article.judul}`}
                      onClick={() => {
                        deleteNewsArticle(article.id);
                        recordActivity('Menghapus berita', 'Berita & Informasi', article.judul);
                        setFeedback({
                          type: 'ok',
                          text: `Artikel "${article.judul}" telah dihapus.`,
                        });
                      }}
                      className="p-2 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

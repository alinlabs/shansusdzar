import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
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
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Berita & Artikel"
        actions={
          canEdit ? (
            <AdminActionLink
              to="/admin/informasi/berita/baru"
              variant="primary"
              label="Tulis Berita"
              icon={<Plus className="size-3.5" />}
            />
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
              className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                <div className="w-18 sm:w-20 shrink-0">
                  <ImageFallback
                    src={article.gambarSampul}
                    alt={article.teksAltSampul || article.judul}
                    aspectRatio="4/3"
                    className="rounded-[var(--radius-sm)]"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[var(--text-muted)] tabular-nums">
                    {article.kategori} · {article.tanggalTerbit} ·{' '}
                    {article.terbit ? 'Terbit' : 'Draft'}
                    {article.unggulan ? ' · Utama' : ''}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                    {article.judul}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    /berita/{article.slug} · {article.kataKunciSeo.length} kata kunci SEO
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 shrink-0">
                {article.terbit && (
                  <AdminActionLink
                    to={`/berita/${article.slug}`}
                    label="Lihat"
                    icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
                  />
                )}
                {canEdit && (
                  <>
                    <AdminActionLink
                      to={`/admin/informasi/berita/${article.id}/edit`}
                      aria-label={`Edit berita ${article.judul}`}
                      label="Edit"
                      icon={<Pencil className="size-3.5" />}
                    />
                    <AdminActionButton
                      variant="danger"
                      iconOnly
                      label={`Hapus berita ${article.judul}`}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => {
                        deleteNewsArticle(article.id);
                        recordActivity('Menghapus berita', 'Berita & Informasi', article.judul);
                        setFeedback({
                          type: 'ok',
                          text: `Artikel "${article.judul}" telah dihapus.`,
                        });
                      }}
                    />
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

import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Select } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { filterAdminNewsArticles } from '../../../../lib/admin-header-search';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

function formatBeritaCardDate(isoDate: string): string {
  try {
    const parsed = new Date(`${isoDate.trim()}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .format(parsed)
      .replace(/\./g, '');
  } catch {
    return isoDate;
  }
}

export default function AdminBeritaPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const deleteNewsArticle = useSiteContentStore((state) => state.deleteNewsArticle);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Berita & Artikel SEO | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'berita');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');

  const categories = useMemo(() => {
    const set = new Set(newsArticles.map((a) => a.kategori).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [newsArticles]);

  const filteredArticles = useMemo(
    () =>
      filterAdminNewsArticles(newsArticles, {
        search: searchQuery,
        category: categoryFilter,
      }),
    [newsArticles, searchQuery, categoryFilter]
  );

  const hasCustomFilter = categoryFilter !== 'Semua';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('Semua');
  };

  const handleDeleteArticle = (articleId: string, articleTitle: string) => {
    deleteNewsArticle(articleId);
    recordActivity('Menghapus berita', 'Berita & Informasi', articleTitle);
    setFeedback({
      type: 'ok',
      text: `Artikel "${articleTitle}" telah dihapus.`,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Berita & Artikel"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari judul artikel, kategori, slug, atau kata kunci...',
          ariaLabel: 'Cari berita dan artikel',
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter berita dan artikel',
          filterTitle: 'Filter Berita & Artikel',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter Artikel
                </p>
                <div className="space-y-2">
                  <Select
                    aria-label="Filter kategori berita"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'Semua' ? 'Semua Kategori' : cat}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilter}
                  onClick={() => {
                    setCategoryFilter('Semua');
                  }}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Setelan
                </button>
                <button
                  type="button"
                  onClick={closeFilter}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </>
          ),
        }}
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

      {filteredArticles.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-8 text-center space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            {newsArticles.length === 0
              ? 'Belum ada berita atau artikel SEO yang diterbitkan.'
              : 'Tidak ada berita atau artikel yang cocok dengan pencarian.'}
          </p>
          {hasAnyFilter && (
            <AdminActionButton
              variant="ghost"
              icon={<RotateCcw className="size-3.5" />}
              label="Reset Filter"
              hideLabelOnMobile={false}
              onClick={handleResetFilters}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3" data-testid="admin-berita-list">
          {filteredArticles.map((article) => {
            const editPath = `/admin/informasi/berita/${article.id}/edit`;
            const metaLine = article.unggulan
              ? `${article.kategori} · Utama`
              : article.kategori;
            const dateLine = formatBeritaCardDate(article.tanggalTerbit);

            return (
              <div
                key={article.id}
                data-testid={`berita-row-${article.id}`}
                className="flex items-center gap-2 sm:block"
              >
                <article
                  data-testid={`berita-card-${article.id}`}
                  className={[
                    'relative min-w-0 flex-1 p-3.5 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex items-center justify-between gap-3 sm:gap-4 transition-colors',
                    canEdit
                      ? 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--focus)]'
                      : 'hover:bg-[var(--surface-elevated)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-20 sm:w-24 aspect-[4/3] rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0">
                      <ImageFallback
                        src={article.gambarSampul}
                        alt={article.teksAltSampul || article.judul}
                        aspectRatio="auto"
                        fallbackLabel={article.judul}
                        className="size-full rounded-none border-0"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p
                        data-testid={`berita-meta-${article.id}`}
                        className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate"
                      >
                        {metaLine}
                      </p>

                      {canEdit ? (
                        <>
                          <Link
                            to={editPath}
                            data-testid={`berita-title-${article.id}`}
                            aria-label={`Edit berita ${article.judul}`}
                            className="sm:hidden block text-sm font-semibold text-[var(--text)] truncate focus-visible:outline-none after:absolute after:inset-0"
                          >
                            {article.judul}
                          </Link>
                          <p
                            data-testid={`berita-title-desktop-${article.id}`}
                            className="hidden sm:block text-base font-semibold text-[var(--text)] truncate"
                          >
                            {article.judul}
                          </p>
                        </>
                      ) : (
                        <p
                          data-testid={`berita-title-${article.id}`}
                          className="text-sm sm:text-base font-semibold text-[var(--text)] truncate"
                        >
                          {article.judul}
                        </p>
                      )}

                      <p
                        data-testid={`berita-date-${article.id}`}
                        className="text-[11px] sm:text-xs text-[var(--text-muted)] tabular-nums truncate"
                      >
                        {dateLine}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <div
                      data-testid={`berita-desktop-actions-${article.id}`}
                      className="hidden sm:flex items-center justify-end gap-1.5 shrink-0"
                    >
                      <AdminActionLink
                        to={editPath}
                        aria-label={`Edit berita ${article.judul}`}
                        label={`Edit berita ${article.judul}`}
                        iconOnly
                        icon={<Pencil className="size-3.5" />}
                      />
                      <AdminActionButton
                        variant="danger"
                        iconOnly
                        label={`Hapus berita ${article.judul}`}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => handleDeleteArticle(article.id, article.judul)}
                      />
                    </div>
                  )}
                </article>

                {canEdit && (
                  <button
                    type="button"
                    data-testid={`berita-mobile-delete-${article.id}`}
                    onClick={() => handleDeleteArticle(article.id, article.judul)}
                    aria-label={`Hapus berita ${article.judul}`}
                    title={`Hapus berita ${article.judul}`}
                    className="sm:hidden shrink-0 inline-flex items-center justify-center size-8 -mr-1 border-0 bg-transparent text-[var(--danger)] hover:opacity-75 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded-[var(--radius-sm)]"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

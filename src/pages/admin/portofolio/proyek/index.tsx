import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { FormField, Input } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { filterAdminPortfolioProjects } from '../../../../lib/admin-header-search';
import {
  computePortfolioReviewStats,
  formatPortfolioClientWithSalutation,
} from '../../../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminPortofolioPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const deletePortfolioProject = useSiteContentStore((state) => state.deletePortfolioProject);
  const beranda = useSiteContentStore((state) => state.beranda);
  const updateBeranda = useSiteContentStore((state) => state.updateBeranda);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Portofolio Proyek & Ulasan | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'portofolio');
  const canDelete = canEdit;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [feedback, setFeedback] = useAdminFeedbackState();

  const [sectionEyebrow, setSectionEyebrow] = useState(beranda.labelTestimoni);
  const [sectionTitle, setSectionTitle] = useState(beranda.judulTestimoni);

  const reviewStats = useMemo(
    () => computePortfolioReviewStats(portfolioProjects),
    [portfolioProjects]
  );

  const featuredHomeCount = useMemo(
    () => portfolioProjects.filter((p) => p.tampilDiBeranda).length,
    [portfolioProjects]
  );

  const filteredProjects = useMemo(
    () => filterAdminPortfolioProjects(portfolioProjects, searchQuery),
    [portfolioProjects, searchQuery]
  );

  const handleSaveHeading = () => {
    if (!canEdit) return;
    updateBeranda({
      ...beranda,
      labelTestimoni: sectionEyebrow.trim() || 'Apa Kata Mereka',
      judulTestimoni: sectionTitle.trim() || 'Pengalaman Terbaik',
    });
    recordActivity(
      'Memperbarui tajuk seksi Ulasan Klien',
      'Portofolio',
      sectionTitle.trim()
    );
    setFeedback({
      type: 'ok',
      text: 'Tajuk ulasan Beranda berhasil disimpan.',
    });
  };

  const handleDeleteProject = (projectId: string, projectTitle: string) => {
    deletePortfolioProject(projectId);
    recordActivity('Menghapus proyek portofolio', 'Portofolio', projectTitle);
    setFeedback({ type: 'ok', text: `Proyek "${projectTitle}" dihapus.` });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Portofolio"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari judul proyek, kota, nama klien, atau ulasan...',
          ariaLabel: 'Cari proyek portofolio atau ulasan klien',
          onActiveChange: setIsSearchActive,
          onResetAll: () => setSearchQuery(''),
        }}
        actions={
          canEdit ? (
            <AdminActionLink
              to="/admin/portofolio/baru"
              variant="primary"
              label="Tambah Proyek"
              icon={<Plus className="size-3.5" />}
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {!isSearchActive && (
        <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Total Proyek
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {reviewStats.totalProjects}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Ulasan Aktif
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {reviewStats.totalReviews}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Rata-Rata Rating
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {reviewStats.totalReviews > 0 ? `${reviewStats.averageRating} / 5.0` : 'Belum ada'}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Slide Beranda
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {featuredHomeCount}
            </dd>
          </div>
        </dl>
      )}

      {filteredProjects.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-8 text-center space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            Belum ada studi kasus portofolio yang cocok dengan pencarian.
          </p>
          {searchQuery.trim() !== '' && (
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
        <div className="space-y-3" data-testid="admin-portfolio-list">
          {filteredProjects.map((project) => {
            const hasPrice =
              typeof project.referensiHarga === 'number' && project.referensiHarga > 0;
            const clientName = formatPortfolioClientWithSalutation(project.ulasan);
            const metaLine = [project.lokasi, project.tahun].filter(Boolean).join(' · ');
            const editPath = `/admin/portofolio/${project.id}/edit`;

            return (
              <div
                key={project.id}
                data-testid={`portfolio-row-${project.id}`}
                className="flex items-center gap-2 sm:block"
              >
                <article
                  data-testid={`portfolio-card-${project.id}`}
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
                        src={project.gambarUtama}
                        alt={project.teksAlt}
                        aspectRatio="auto"
                        fallbackLabel={project.judul}
                        className="size-full rounded-none border-0"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      {metaLine && (
                        <p
                          data-testid={`portfolio-meta-${project.id}`}
                          className="text-[11px] sm:text-xs text-[var(--text-muted)] tabular-nums truncate"
                        >
                          {metaLine}
                        </p>
                      )}
                      {canEdit ? (
                        <>
                          <Link
                            to={editPath}
                            data-testid={`portfolio-title-${project.id}`}
                            aria-label={`Edit proyek ${project.judul}`}
                            className="sm:hidden block text-sm font-semibold text-[var(--text)] truncate focus-visible:outline-none after:absolute after:inset-0"
                          >
                            {project.judul}
                          </Link>
                          <p
                            data-testid={`portfolio-title-desktop-${project.id}`}
                            className="hidden sm:block text-base font-semibold text-[var(--text)] truncate"
                          >
                            {project.judul}
                          </p>
                        </>
                      ) : (
                        <p
                          data-testid={`portfolio-title-${project.id}`}
                          className="text-sm sm:text-base font-semibold text-[var(--text)] truncate"
                        >
                          {project.judul}
                        </p>
                      )}
                      {hasPrice && (
                        <p
                          data-testid={`portfolio-price-${project.id}`}
                          className="text-xs sm:text-sm font-medium text-[var(--text)] tabular-nums truncate"
                        >
                          {formatCurrencyIDR(project.referensiHarga)}
                        </p>
                      )}
                      {clientName && (
                        <p
                          data-testid={`portfolio-client-${project.id}`}
                          className="text-xs text-[var(--text-muted)] truncate"
                        >
                          {clientName}
                        </p>
                      )}
                    </div>
                  </div>

                  {(canEdit || canDelete) && (
                    <div
                      data-testid={`portfolio-desktop-actions-${project.id}`}
                      className="hidden sm:flex items-center justify-end gap-1.5 shrink-0"
                    >
                      {canEdit && (
                        <AdminActionLink
                          to={editPath}
                          aria-label={`Edit proyek ${project.judul}`}
                          label={`Edit proyek ${project.judul}`}
                          iconOnly
                          icon={<Pencil className="size-3.5" />}
                        />
                      )}
                      {canDelete && (
                        <AdminActionButton
                          variant="danger"
                          label={`Hapus proyek ${project.judul}`}
                          iconOnly
                          icon={<Trash2 className="size-3.5" />}
                          onClick={() => handleDeleteProject(project.id, project.judul)}
                        />
                      )}
                    </div>
                  )}
                </article>

                {canDelete && (
                  <button
                    type="button"
                    data-testid={`portfolio-mobile-delete-${project.id}`}
                    onClick={() => handleDeleteProject(project.id, project.judul)}
                    aria-label={`Hapus proyek ${project.judul}`}
                    title={`Hapus proyek ${project.judul}`}
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

      {!isSearchActive && (
        <AdminFormSectionCard
          title="Tajuk Ulasan Beranda"
          headerAction={
            canEdit ? (
              <AdminActionButton
                label="Simpan Tajuk"
                mobileLabel="Simpan"
                icon={<Save className="size-3.5" />}
                onClick={handleSaveHeading}
              />
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="ulasan-eyebrow" label="Eyebrow">
              <Input
                id="ulasan-eyebrow"
                disabled={!canEdit}
                value={sectionEyebrow}
                onChange={(e) => setSectionEyebrow(e.target.value)}
              />
            </FormField>
            <FormField id="ulasan-title" label="Judul">
              <Input
                id="ulasan-title"
                disabled={!canEdit}
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
              />
            </FormField>
          </div>
        </AdminFormSectionCard>
      )}
    </div>
  );
}

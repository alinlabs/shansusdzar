import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { FormField, Input, Select } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  computePortfolioReviewStats,
  hasVisiblePortfolioReview,
} from '../../../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

type ReviewPresenceFilter = 'all' | 'with-review' | 'without-review';

export default function AdminPortofolioPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const deletePortfolioProject = useSiteContentStore((state) => state.deletePortfolioProject);
  const movePortfolioProject = useSiteContentStore((state) => state.movePortfolioProject);
  const beranda = useSiteContentStore((state) => state.beranda);
  const updateBeranda = useSiteContentStore((state) => state.updateBeranda);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Portofolio Proyek & Ulasan | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'portofolio.edit');
  const canDelete = hasPermission(currentRole, 'portofolio.delete');

  const [searchQuery, setSearchQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewPresenceFilter>('all');
  const [feedback, setFeedback] = useAdminFeedbackState();

  const [sectionEyebrow, setSectionEyebrow] = useState(beranda.labelTestimoni);
  const [sectionTitle, setSectionTitle] = useState(beranda.judulTestimoni);

  const reviewStats = useMemo(
    () => computePortfolioReviewStats(portfolioProjects),
    [portfolioProjects]
  );

  const featuredHomeCount = useMemo(
    () => portfolioProjects.filter((p) => p.terbit && p.tampilDiBeranda).length,
    [portfolioProjects]
  );

  const sortedProjects = useMemo(
    () => [...portfolioProjects].sort((a, b) => a.urutan - b.urutan),
    [portfolioProjects]
  );

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedProjects.filter((p) => {
      const hasReview = hasVisiblePortfolioReview(p);
      if (reviewFilter === 'with-review' && !hasReview) return false;
      if (reviewFilter === 'without-review' && hasReview) return false;
      if (!q) return true;
      const reviewText = p.ulasan ? `${p.ulasan.namaPengulas} ${p.ulasan.komentar}` : '';
      return `${p.judul} ${p.kategori} ${p.lokasi} ${p.namaKlien} ${reviewText}`
        .toLowerCase()
        .includes(q);
    });
  }, [sortedProjects, searchQuery, reviewFilter]);

  const isFilterActive = searchQuery.trim().length > 0 || reviewFilter !== 'all';

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

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Portofolio"
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

      <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Proyek Terbit
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {reviewStats.publishedProjects} / {reviewStats.totalProjects}
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="admin-portfolio-search" className="sr-only">
            Cari proyek portofolio atau ulasan klien
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <Input
            id="admin-portfolio-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul proyek, kota, nama klien, atau ulasan..."
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status ulasan proyek"
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value as ReviewPresenceFilter)}
          className="w-full sm:w-52"
        >
          <option value="all">Semua Proyek</option>
          <option value="with-review">Dengan Ulasan Klien</option>
          <option value="without-review">Belum Ada Ulasan</option>
        </Select>
      </div>

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)] overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada studi kasus portofolio yang cocok dengan filter atau pencarian.
          </div>
        ) : (
          filteredProjects.map((project, index) => {
            const hasReview = hasVisiblePortfolioReview(project) && project.ulasan;
            return (
              <div
                key={project.id}
                className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 hover:bg-[var(--surface-elevated)]"
              >
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <div className="w-20 sm:w-24 aspect-[4/3] rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0">
                    <ImageFallback
                      src={project.gambarUtama}
                      alt={project.teksAlt}
                      aspectRatio="auto"
                      fallbackLabel={project.kategori}
                      className="size-full rounded-none border-0"
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] sm:text-xs text-[var(--text-muted)] tabular-nums">
                      #{project.urutan} · {project.kategori} · {project.lokasi} · {project.tahun}
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-[var(--text)] truncate">
                      {project.judul}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1 tabular-nums">
                      {project.terbit ? 'Terbit' : 'Draft'}
                      {project.tampilDiBeranda ? ' · Beranda' : ''} · {project.cakupan}
                      {typeof project.referensiHarga === 'number' && project.referensiHarga > 0
                        ? ` · ${formatCurrencyIDR(project.referensiHarga)}`
                        : ''}
                    </p>
                    {hasReview ? (
                      <p className="text-xs text-[var(--text)] flex items-center gap-1.5 min-w-0">
                        <Star
                          className="size-3.5 fill-current text-[#b8862d] dark:text-[#d6a954] shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-medium tabular-nums shrink-0">
                          {hasReview.penilaian.toFixed(1)}
                        </span>
                        <span className="text-[var(--text-muted)] truncate">
                          · {hasReview.namaPengulas}: &ldquo;{hasReview.komentar}&rdquo;
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-subtle)]">
                        Belum ada ulasan klien aktif.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  {project.terbit && (
                    <AdminActionLink
                      to={`/portofolio/${project.slug}`}
                      label="Lihat"
                      icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
                    />
                  )}
                  {canEdit && (
                    <>
                      <AdminActionButton
                        label={`Naikkan urutan ${project.judul}`}
                        iconOnly
                        disabled={isFilterActive || index === 0}
                        icon={<ArrowUp className="size-3.5" />}
                        onClick={() => movePortfolioProject(project.id, 'up')}
                      />
                      <AdminActionButton
                        label={`Turunkan urutan ${project.judul}`}
                        iconOnly
                        disabled={isFilterActive || index === filteredProjects.length - 1}
                        icon={<ArrowDown className="size-3.5" />}
                        onClick={() => movePortfolioProject(project.id, 'down')}
                      />
                      <AdminActionLink
                        to={`/admin/portofolio/${project.id}/edit`}
                        aria-label={`Edit proyek ${project.judul}`}
                        label="Edit"
                        icon={<Pencil className="size-3.5" />}
                      />
                    </>
                  )}
                  {canDelete && (
                    <AdminActionButton
                      variant="danger"
                      label={`Hapus proyek ${project.judul}`}
                      iconOnly
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => {
                        deletePortfolioProject(project.id);
                        recordActivity('Menghapus proyek portofolio', 'Portofolio', project.judul);
                        setFeedback({ type: 'ok', text: `Proyek "${project.judul}" dihapus.` });
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

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
    </div>
  );
}

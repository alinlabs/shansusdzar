import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Select } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  computePortfolioReviewStats,
  hasVisiblePortfolioReview,
} from '../../../../lib/portfolio-filter';
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
  const [sectionDescription, setSectionDescription] = useState(beranda.deskripsiTestimoni);

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
      deskripsiTestimoni: sectionDescription.trim(),
    });
    recordActivity(
      'Memperbarui tajuk seksi Ulasan Klien di Beranda',
      'Portofolio',
      sectionTitle.trim()
    );
    setFeedback({
      type: 'ok',
      text: 'Tajuk seksi Ulasan Klien di Beranda berhasil diperbarui.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Portofolio Proyek & Ulasan Klien"
        description="Kelola studi kasus proyek, galeri foto, serta ulasan & rating klien yang melekat langsung pada setiap proyek."
        actions={
          canEdit ? (
            <Link
              to="/admin/portofolio/baru"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Proyek
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <dl className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Studi Kasus Terbit</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {reviewStats.publishedProjects} / {reviewStats.totalProjects}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Aktif di halaman portofolio</dd>
        </div>
        <div className="p-4 sm:p-5 border-l border-[var(--border)] lg:border-l-0">
          <dt className="text-xs text-[var(--text-muted)]">Ulasan Klien Aktif</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {reviewStats.totalReviews}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Terhubung ke proyek nyata</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Rata-Rata Rating</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {reviewStats.totalReviews > 0 ? `${reviewStats.averageRating} / 5.0` : 'Belum ada'}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)] tabular-nums">
            {reviewStats.fiveStarCount} ulasan bintang 5
          </dd>
        </div>
        <div className="p-4 sm:p-5 border-l border-[var(--border)] lg:border-l-0">
          <dt className="text-xs text-[var(--text-muted)]">Sorotan Slide Beranda</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {featuredHomeCount}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Tampil di carousel depan</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
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
          className="w-auto"
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
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--surface-elevated)]"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-24 aspect-[4/3] rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0">
                    <ImageFallback
                      src={project.gambarUtama}
                      alt={project.teksAlt}
                      aspectRatio="auto"
                      fallbackLabel={project.kategori}
                      className="size-full rounded-none border-0"
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      #{project.urutan} · {project.kategori} · {project.lokasi} · {project.tahun}
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-[var(--text)] truncate">
                      {project.judul}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                      {project.terbit ? 'Terbit di Situs' : 'Draft Tersembunyi'}
                      {project.tampilDiBeranda ? ' · Tampil di Slide Beranda' : ''} · {project.cakupan}
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
                        Belum ada ulasan klien aktif (tambahkan melalui menu Edit).
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  {project.terbit && (
                    <Link
                      to={`/portofolio/${project.slug}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Lihat
                    </Link>
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        aria-label={`Naikkan urutan ${project.judul}`}
                        disabled={isFilterActive || index === 0}
                        onClick={() => movePortfolioProject(project.id, 'up')}
                        className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Turunkan urutan ${project.judul}`}
                        disabled={isFilterActive || index === filteredProjects.length - 1}
                        onClick={() => movePortfolioProject(project.id, 'down')}
                        className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      </button>
                      <Link
                        to={`/admin/portofolio/${project.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      aria-label={`Hapus proyek ${project.judul}`}
                      onClick={() => {
                        deletePortfolioProject(project.id);
                        recordActivity('Menghapus proyek portofolio', 'Portofolio', project.judul);
                        setFeedback({ type: 'ok', text: `Proyek "${project.judul}" dihapus.` });
                      }}
                      className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] hover:opacity-85 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AdminFormSectionCard
        title="Pengaturan Tajuk Seksi Ulasan di Beranda"
        description="Sesuaikan label, judul, dan keterangan singkat di atas carousel testimoni Beranda yang bersumber dari proyek portofolio."
        headerAction={
          canEdit ? (
            <Button type="button" variant="secondary" size="sm" onClick={handleSaveHeading}>
              Simpan Tajuk Ulasan
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField id="ulasan-eyebrow" label="Eyebrow Seksi">
            <Input
              id="ulasan-eyebrow"
              disabled={!canEdit}
              value={sectionEyebrow}
              onChange={(e) => setSectionEyebrow(e.target.value)}
            />
          </FormField>
          <FormField id="ulasan-title" label="Judul Seksi">
            <Input
              id="ulasan-title"
              disabled={!canEdit}
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
          </FormField>
          <FormField id="ulasan-desc" label="Keterangan Singkat">
            <Input
              id="ulasan-desc"
              disabled={!canEdit}
              value={sectionDescription}
              onChange={(e) => setSectionDescription(e.target.value)}
            />
          </FormField>
        </div>
      </AdminFormSectionCard>
    </div>
  );
}

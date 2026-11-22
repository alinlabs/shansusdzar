import { useMemo, useState } from 'react';
import { ArrowUpRight, LayoutGrid, List, RotateCcw, Search, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Button, LinkButton } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/form-controls';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
import {
  ALL_PORTFOLIO_CATEGORIES,
  ALL_PORTFOLIO_YEARS,
  extractPortfolioCategories,
  extractPortfolioYears,
  filterPortfolioProjects,
  getPortfolioStats,
  hasVisiblePortfolioReview,
  type PortfolioSortMode,
} from '../../lib/portfolio-filter';
import { useSiteContentStore } from '../../store/site-content-store';

type PortfolioViewMode = 'bento' | 'list';

export default function PortofolioPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const beranda = useSiteContentStore((state) => state.beranda);
  const projects = useSiteContentStore((state) => state.portfolioProjects);

  useDocumentTitle(
    `Portofolio Proyek | ${businessConfig.namaMerekSingkat}`,
    'Dokumentasi studi kasus penataan ruang dan pengerjaan furniture custom dari workshop Purwakarta.'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_PORTFOLIO_CATEGORIES);
  const [selectedYear, setSelectedYear] = useState(ALL_PORTFOLIO_YEARS);
  const [sortBy, setSortBy] = useState<PortfolioSortMode>('order');
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('bento');

  const publishedProjects = useMemo(() => projects.filter((p) => p.terbit), [projects]);
  const categories = useMemo(
    () => extractPortfolioCategories(publishedProjects),
    [publishedProjects]
  );
  const years = useMemo(() => extractPortfolioYears(publishedProjects), [publishedProjects]);
  const stats = useMemo(() => getPortfolioStats(publishedProjects), [publishedProjects]);

  const filteredProjects = useMemo(
    () =>
      filterPortfolioProjects(publishedProjects, {
        searchQuery,
        category: selectedCategory,
        year: selectedYear,
        sortBy,
      }),
    [publishedProjects, searchQuery, selectedCategory, selectedYear, sortBy]
  );

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedCategory !== ALL_PORTFOLIO_CATEGORIES ||
    selectedYear !== ALL_PORTFOLIO_YEARS ||
    sortBy !== 'order';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory(ALL_PORTFOLIO_CATEGORIES);
    setSelectedYear(ALL_PORTFOLIO_YEARS);
    setSortBy('order');
  };

  return (
    <div className="space-y-7 sm:space-y-10">
      <div className="space-y-5 sm:space-y-6">
        <SectionHeading
          as="h1"
          eyebrow={beranda.labelPortofolio}
          title={beranda.judulPortofolio}
          description={beranda.deskripsiPortofolio}
        />

        <dl
          aria-label="Ringkasan statistik portofolio"
          className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 py-4 border-y border-[var(--border)] lg:gap-0 lg:divide-x lg:divide-[var(--border)]"
        >
          <div className="lg:pr-6">
            <dt className="text-xs text-[var(--text-muted)]">Proyek Terdokumentasi</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {stats.totalProjects}
            </dd>
          </div>
          <div className="lg:px-6">
            <dt className="text-xs text-[var(--text-muted)]">Kategori Ruang</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {stats.categoriesCount}
            </dd>
          </div>
          <div className="lg:px-6">
            <dt className="text-xs text-[var(--text-muted)]">Kota &amp; Area Layanan</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {stats.locationsCount}
            </dd>
          </div>
          <div className="lg:pl-6">
            <dt className="text-xs text-[var(--text-muted)]">Total Luas Pengerjaan</dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
              {stats.totalAreaSqm} m²
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3.5">
        <div
          role="tablist"
          aria-label="Filter kategori portofolio"
          className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto"
        >
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={[
                  'relative min-h-11 py-2.5 text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  active
                    ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-2.5 w-full sm:flex-1 sm:min-w-[220px]">
            <div className="relative flex-1">
              <label htmlFor="portfolio-search" className="sr-only">
                Cari proyek portofolio
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <Input
                id="portfolio-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari proyek, lokasi, atau material..."
                className="pl-9"
              />
            </div>

            <div
              role="group"
              aria-label="Mode tampilan portofolio (seluler)"
              className="inline-flex sm:hidden items-center p-1 border border-[var(--border)] bg-[var(--surface-muted)] rounded-[var(--radius-md)] shrink-0"
            >
              <button
                type="button"
                aria-label="Tampilan grid"
                aria-pressed={viewMode === 'bento'}
                onClick={() => setViewMode('bento')}
                className={[
                  'inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer',
                  viewMode === 'bento'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Tampilan daftar detail"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={[
                  'inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                <List className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
            <div className="sm:w-40">
              <label htmlFor="portfolio-year" className="sr-only">
                Filter tahun
              </label>
              <Select
                id="portfolio-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr === ALL_PORTFOLIO_YEARS ? 'Semua Tahun' : yr}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:w-48">
              <label htmlFor="portfolio-sort" className="sr-only">
                Urutkan portofolio
              </label>
              <Select
                id="portfolio-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as PortfolioSortMode)}
              >
                <option value="order">Urutan Kurasi</option>
                <option value="year-desc">Tahun Terbaru</option>
                <option value="area-desc">Luas Terbesar</option>
                <option value="title-asc">Judul (A–Z)</option>
              </Select>
            </div>

            <div
              role="group"
              aria-label="Mode tampilan portofolio"
              className="hidden sm:inline-flex items-center p-1 border border-[var(--border)] bg-[var(--surface-muted)] rounded-[var(--radius-md)] shrink-0"
            >
              <button
                type="button"
                aria-label="Tampilan grid"
                aria-pressed={viewMode === 'bento'}
                onClick={() => setViewMode('bento')}
                className={[
                  'inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer',
                  viewMode === 'bento'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Tampilan daftar detail"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={[
                  'inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                <List className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <p className="tabular-nums">
            Menampilkan {filteredProjects.length} dari {publishedProjects.length} studi kasus proyek
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-12 border-t border-[var(--border)] text-center space-y-4">
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Tidak ada proyek portofolio yang sesuai
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Coba pilih kategori lain atau atur ulang kata kunci pencarian Anda.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Tampilkan Semua Portofolio
          </Button>
        </div>
      ) : viewMode === 'bento' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 sm:gap-y-10">
          {filteredProjects.map((project, index) => {
            const isFeaturedLead =
              index === 0 && !hasActiveFilter && filteredProjects.length >= 3;

            return (
              <article
                key={project.id}
                className={[
                  'group flex flex-col gap-3.5 pb-6 border-b border-[var(--border)] md:border-b-0 md:pb-0',
                  isFeaturedLead ? 'md:col-span-2' : '',
                ].join(' ')}
              >
                <Link
                  to={`/portofolio/${project.slug}`}
                  aria-label={`Buka studi kasus ${project.judul}`}
                  className="relative -mx-4 sm:mx-0 block overflow-hidden image-clip-frame sm:rounded-[var(--radius-md)] bg-[var(--surface-muted)] text-left"
                >
                  <ImageFallback
                    src={project.gambarUtama}
                    alt={project.teksAlt}
                    aspectRatio={isFeaturedLead ? '16/9' : '4/3'}
                    eager={index < 3}
                    fallbackLabel={project.kategori}
                    className="rounded-none border-0"
                    imgClassName="image-hover-zoom"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-x-px -bottom-px h-[calc(40%+2px)] transform-gpu bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white/80 truncate">
                        {project.kategori} · {project.lokasi} · {project.tahun}
                      </p>
                      <h2 className="text-base sm:text-lg font-semibold text-white leading-snug mt-0.5">
                        {project.judul}
                      </h2>
                    </div>
                    <span className="inline-flex items-center justify-center size-9 rounded-full bg-white/15 text-white shrink-0 backdrop-blur-xs">
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </Link>

                <div className="flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-muted)]">
                      {project.cakupan} · {project.ringkasanDimensi}
                    </p>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {project.deskripsi}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-subtle)] truncate">
                      {hasVisiblePortfolioReview(project) && project.ulasan ? (
                        <>
                          <Star
                            className="size-3.5 fill-current text-[#b8862d] dark:text-[#d6a954] shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium text-[var(--text)] tabular-nums">
                            {project.ulasan.penilaian.toFixed(1)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">Ulasan {project.ulasan.namaPengulas}</span>
                        </>
                      ) : (
                        project.catatanMaterial || project.catatanFinishing
                      )}
                    </span>
                    <Link
                      to={`/portofolio/${project.slug}`}
                      className="text-xs font-semibold text-[var(--text)] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      Studi Kasus
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {filteredProjects.map((project) => (
            <article
              key={project.id}
              className="py-5 sm:py-6 flex flex-col md:flex-row md:items-center gap-4 sm:gap-6"
            >
              <Link
                to={`/portofolio/${project.slug}`}
                aria-label={`Lihat foto ${project.judul}`}
                className="block w-full md:w-60 shrink-0 overflow-hidden image-clip-frame rounded-[var(--radius-md)] bg-[var(--surface-muted)]"
              >
                <ImageFallback
                  src={project.gambarUtama}
                  alt={project.teksAlt}
                  aspectRatio="4/3"
                  fallbackLabel={project.kategori}
                  className="rounded-none border-0"
                />
              </Link>

              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  {project.kategori} · {project.lokasi} · {project.tahun} ·{' '}
                  <span className="tabular-nums">{project.durasi}</span>
                </p>
                <h2 className="text-lg font-semibold text-[var(--text)] leading-snug">
                  <Link
                    to={`/portofolio/${project.slug}`}
                    className="hover:underline underline-offset-4"
                  >
                    {project.judul}
                  </Link>
                </h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {project.deskripsi}
                </p>
                <p className="text-xs text-[var(--text-subtle)] tabular-nums">
                  {project.cakupan} · {project.ringkasanDimensi} · {project.catatanMaterial}
                  {hasVisiblePortfolioReview(project) && project.ulasan
                    ? ` · ★ ${project.ulasan.penilaian.toFixed(1)} Ulasan ${project.ulasan.namaPengulas}`
                    : ''}
                </p>
              </div>

              <div className="shrink-0">
                <LinkButton to={`/portofolio/${project.slug}`} variant="secondary" size="sm">
                  Lihat Studi Kasus
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </LinkButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router';
import { LinkButton } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_NEWS_CATEGORIES,
  extractBeritaOnlyCategories,
  filterBeritaOnlyArticles,
} from '../../lib/informasi-filter';
import { buildBeritaListJsonLd } from '../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { useSiteContentStore } from '../../store/site-content-store';
import type { NewsArticleItem } from '../../types/cms';

function formatNewsDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

function HeroCoverOverlayTile({
  article,
  minHeightClass = 'aspect-[16/10] sm:aspect-auto min-h-[220px] sm:min-h-[340px] lg:min-h-0 lg:h-full',
  eager = false,
  headingLevel = 'h2',
}: {
  article: NewsArticleItem;
  minHeightClass?: string;
  eager?: boolean;
  headingLevel?: 'h2' | 'h3';
}) {
  const HeadingTag = headingLevel;
  return (
    <article
      data-testid="berita-hero-overlay-card"
      className={`group relative flex flex-col ${minHeightClass} rounded-[var(--radius-lg)] border border-[var(--border)] bg-zinc-900 overflow-hidden shadow-[var(--shadow-sm)]`}
    >
      <Link
        to={`/berita/${article.slug}`}
        className="relative flex flex-1 w-full flex-col justify-end focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-zinc-900">
          <ImageFallback
            src={article.gambarSampul}
            alt={article.teksAltSampul || article.judul}
            aspectRatio="auto"
            eager={eager}
            fallbackLabel="Foto Berita"
            className="h-full w-full rounded-none border-0"
            imgClassName="image-hover-zoom h-full w-full object-cover"
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-px -bottom-px h-[72%] sm:h-[68%] bg-gradient-to-t from-zinc-950/92 via-zinc-950/52 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/55 via-zinc-950/12 to-transparent"
        />

        <ArrowUpRight
          className="pointer-events-none absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-10 size-4 sm:size-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />

        <div className="relative z-10 p-4 pr-10 sm:p-7 space-y-1.5 sm:space-y-2">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] sm:text-xs text-zinc-200 tabular-nums">
            <span className="font-medium text-white">{article.kategori}</span>
            <span aria-hidden="true" className="text-zinc-300">
              ·
            </span>
            <time dateTime={article.tanggalTerbit} className="whitespace-nowrap">
              {formatNewsDate(article.tanggalTerbit)}
            </time>
          </p>

          <HeadingTag className="text-[17px] sm:text-2xl xl:text-[1.8rem] font-semibold text-white leading-[1.24] sm:leading-[1.2]">
            {article.judul}
          </HeadingTag>
        </div>
      </Link>
    </article>
  );
}

function HorizontalFeatureCard({
  article,
  brandName,
  splitClass = 'sm:col-span-6',
  eager = false,
}: {
  article: NewsArticleItem;
  brandName: string;
  splitClass?: string;
  eager?: boolean;
}) {
  const copyClass = splitClass === 'sm:col-span-5' ? 'sm:col-span-7' : 'sm:col-span-6';
  return (
    <article className="group h-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch shadow-[var(--shadow-sm)] card-hover-surface">
      <Link
        to={`/berita/${article.slug}`}
        className={`${splitClass} block overflow-hidden image-clip-frame bg-[var(--surface-muted)]`}
      >
        <ImageFallback
          src={article.gambarSampul}
          alt={article.teksAltSampul || article.judul}
          aspectRatio="16/9"
          eager={eager}
          fallbackLabel="Foto Berita"
          className="rounded-none border-0 sm:aspect-auto sm:h-full"
          imgClassName="image-hover-zoom"
        />
      </Link>
      <div className={`${copyClass} p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4`}>
        <div className="space-y-1.5 sm:space-y-2.5">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-muted)] tabular-nums">
            <span className="font-medium text-[var(--text)]">{article.kategori}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={article.tanggalTerbit} className="whitespace-nowrap">
              {formatNewsDate(article.tanggalTerbit)}
            </time>
          </p>
          <h3 className="text-base sm:text-xl font-semibold text-[var(--text)] leading-snug">
            <Link to={`/berita/${article.slug}`}>{article.judul}</Link>
          </h3>
          <p className="text-[13px] sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
            {article.ringkasan}
          </p>
        </div>

        <div className="pt-3 sm:pt-3.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-subtle)]">{brandName}</span>
          <LinkButton to={`/berita/${article.slug}`} variant="secondary" size="sm">
            Baca Berita
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </LinkButton>
        </div>
      </div>
    </article>
  );
}

function AdaptiveEditorialCard({
  article,
  headingLevel = 'h3',
  eager = false,
  testId,
  desktopMinHeightClass = 'sm:min-h-[195px]',
}: {
  article: NewsArticleItem;
  headingLevel?: 'h2' | 'h3';
  eager?: boolean;
  testId?: string;
  desktopMinHeightClass?: string;
}) {
  const HeadingTag = headingLevel;
  const targetUrl = `/berita/${article.slug}`;

  return (
    <article
      data-testid={testId}
      className="group flex-1 h-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden card-hover-surface shadow-[var(--shadow-sm)]"
    >
      {/* Mobile (< sm): kartu vertikal 2-kolom dengan seluruh kartu sebagai target klik yang nyaman */}
      <Link
        to={targetUrl}
        className="flex flex-col h-full sm:hidden focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden image-clip-frame bg-[var(--surface-muted)]">
          <ImageFallback
            src={article.gambarSampul}
            alt={article.teksAltSampul || article.judul}
            aspectRatio="4/3"
            eager={eager}
            fallbackLabel="Foto Berita"
            className="rounded-none border-0 size-full"
            imgClassName="image-hover-zoom size-full object-cover"
          />
          <ArrowUpRight
            className="pointer-events-none absolute top-2.5 right-2.5 z-10 size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 p-3 flex flex-col justify-between gap-2 min-w-0">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              {article.kategori}
            </p>
            <HeadingTag className="text-[13.5px] font-semibold text-[var(--text)] leading-snug line-clamp-3">
              {article.judul}
            </HeadingTag>
          </div>
          <time
            dateTime={article.tanggalTerbit}
            className="text-[11px] text-[var(--text-subtle)] tabular-nums whitespace-nowrap"
          >
            {formatNewsDate(article.tanggalTerbit)}
          </time>
        </div>
      </Link>

      {/* Tablet & Desktop (sm+): kartu horizontal gambar-kiri teks-kanan */}
      <div className="hidden sm:grid sm:grid-cols-12 items-stretch h-full">
        <Link
          to={targetUrl}
          className={`col-span-5 relative block ${desktopMinHeightClass} overflow-hidden image-clip-frame bg-[var(--surface-muted)]`}
        >
          <div className="absolute inset-0">
            <ImageFallback
              src={article.gambarSampul}
              alt={article.teksAltSampul || article.judul}
              aspectRatio="auto"
              eager={eager}
              fallbackLabel="Foto Berita"
              className="h-full w-full rounded-none border-0"
              imgClassName="image-hover-zoom h-full w-full object-cover"
            />
          </div>
        </Link>
        <div className="col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="space-y-1.5">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--text-muted)] tabular-nums">
              <span className="font-medium text-[var(--text)]">{article.kategori}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={article.tanggalTerbit} className="whitespace-nowrap">
                {formatNewsDate(article.tanggalTerbit)}
              </time>
            </p>
            <HeadingTag className="text-[15.5px] xl:text-[16px] font-semibold text-[var(--text)] leading-snug line-clamp-2 sm:line-clamp-3">
              <Link to={targetUrl}>{article.judul}</Link>
            </HeadingTag>
            <p className="text-[12.5px] sm:text-[13px] text-[var(--text-muted)] leading-relaxed line-clamp-2">
              {article.ringkasan}
            </p>
          </div>
          <Link
            to={targetUrl}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)] hover:underline w-fit pt-0.5"
          >
            Baca Liputan
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BeritaPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);

  useDocumentTitle(
    `Berita Terbaru | ${businessConfig.namaMerekSingkat}`,
    'Kumpulan berita terbaru workshop, liputan serah terima proyek interior, perkembangan produksi, dan pengumuman resmi Shansus Dzar Indonesia.',
    {
      keywords: [
        'berita shansus dzar indonesia',
        'kabar workshop purwakarta',
        'proyek interior purwakarta',
        'update produksi furniture custom',
      ],
    }
  );

  const originUrl = getRuntimeSiteOrigin();

  const beritaOnlyPublished = useMemo(
    () => filterBeritaOnlyArticles(newsArticles, ALL_NEWS_CATEGORIES, ''),
    [newsArticles]
  );

  const beritaCategories = useMemo(
    () => extractBeritaOnlyCategories(newsArticles),
    [newsArticles]
  );

  const beritaSchema = useMemo(
    () => buildBeritaListJsonLd(beritaOnlyPublished, businessConfig, originUrl),
    [beritaOnlyPublished, businessConfig, originUrl]
  );
  useJsonLdSchema('shansusdzar-berita-collection', beritaSchema);

  const [newsSearch, setNewsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_NEWS_CATEGORIES);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuContainerRef = useRef<HTMLDivElement>(null);

  const filteredNews = useMemo(
    () => filterBeritaOnlyArticles(newsArticles, selectedCategory, newsSearch),
    [newsArticles, selectedCategory, newsSearch]
  );

  const hasPopupFilterActive = selectedCategory !== ALL_NEWS_CATEGORIES;
  const hasActiveFilter = newsSearch.trim().length > 0 || hasPopupFilterActive;

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        filterMenuContainerRef.current &&
        !filterMenuContainerRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  const resetFilters = () => {
    setNewsSearch('');
    setSelectedCategory(ALL_NEWS_CATEGORIES);
  };

  const leadArticle = filteredNews[0] ?? null;
  const sideStackArticles = filteredNews.slice(1, 3);
  const remainingArticles = filteredNews.slice(3);
  const secondaryBannerArticle = remainingArticles[0] ?? null;
  const secondaryGridArticles = remainingArticles.slice(1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3.5 sm:gap-4">
          <SectionHeading
            as="h1"
            eyebrow="Kabar & Publikasi Studio"
            title="Berita & Jurnal Shansus Dzar Indonesia"
            className="min-w-0 [&_h1]:text-[22px] [&_h1]:sm:text-3xl [&_h1]:lg:text-4xl"
          />

          <div ref={filterMenuContainerRef} className="relative w-full md:w-80 shrink-0">
            <label htmlFor="news-search" className="sr-only">
              Cari berita terbaru
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="news-search"
              type="text"
              enterKeyHint="search"
              value={newsSearch}
              onChange={(e) => setNewsSearch(e.target.value)}
              placeholder="Cari kabar workshop atau proyek..."
              className="pl-10 pr-22 text-base md:text-sm outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
            />

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {newsSearch.trim().length > 0 && (
                <button
                  type="button"
                  aria-label="Hapus kata kunci pencarian berita"
                  onClick={() => setNewsSearch('')}
                  className="inline-flex items-center justify-center size-8 rounded-[calc(var(--radius-md)-2px)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}

              {beritaCategories.length > 1 && (
                <button
                  type="button"
                  data-testid="berita-filter-trigger"
                  aria-label="Filter kategori berita"
                  aria-expanded={isFilterMenuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                  className={[
                    'relative inline-flex items-center justify-center size-9 rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none',
                    isFilterMenuOpen || hasPopupFilterActive
                      ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
                  ].join(' ')}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  {hasPopupFilterActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[var(--accent)]"
                    />
                  )}
                </button>
              )}
            </div>

            {isFilterMenuOpen && beritaCategories.length > 1 && (
              <div
                role="dialog"
                data-testid="berita-filter-popover"
                aria-label="Menu filter kategori berita"
                className="absolute right-0 top-full mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-[var(--text)]">
                    Kategori Berita
                  </p>
                  {hasPopupFilterActive && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(ALL_NEWS_CATEGORIES)}
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] underline-offset-4 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div
                  role="group"
                  aria-label="Pilihan kategori berita"
                  className="flex flex-wrap gap-1.5"
                >
                  {beritaCategories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setIsFilterMenuOpen(false);
                        }}
                        className={[
                          'min-h-9 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
                        ].join(' ')}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
            <span className="tabular-nums">
              {filteredNews.length} liputan ditemukan
              {hasPopupFilterActive ? ` · ${selectedCategory}` : ''}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {!leadArticle ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10 text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Belum ada berita yang cocok dengan kata kunci atau kategori tersebut.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset Pencarian Berita
          </button>
        </div>
      ) : filteredNews.length === 1 ? (
        <HorizontalFeatureCard
          article={leadArticle}
          brandName={businessConfig.namaMerekSingkat}
          splitClass="sm:col-span-5"
          eager
        />
      ) : filteredNews.length === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          <div className="lg:col-span-7">
            <HorizontalFeatureCard
              article={leadArticle}
              brandName={businessConfig.namaMerekSingkat}
              eager
            />
          </div>
          <div className="lg:col-span-5">
            <HeroCoverOverlayTile
              article={filteredNews[1]}
              minHeightClass="aspect-[16/10] sm:aspect-auto min-h-[220px] sm:min-h-[300px] lg:h-full"
              headingLevel="h3"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-7 sm:space-y-12">
          {/* Kolase Editorial Utama (Mobile: Cover 16:10 + 2 Kartu Grid 2 Kolom | Desktop: Cover Kiri + 2 Kartu Horizontal Kanan) */}
          <section
            aria-label="Kolase tiga berita utama"
            data-testid="berita-magazine-collage"
            className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 xl:gap-6 items-stretch"
          >
            <div className="lg:col-span-6 flex flex-col">
              <HeroCoverOverlayTile
                article={leadArticle}
                minHeightClass="aspect-[16/10] sm:aspect-auto min-h-[220px] sm:min-h-[340px] lg:min-h-0 lg:h-full"
                eager
              />
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-1 sm:flex sm:flex-col gap-3 sm:gap-4 xl:gap-5">
              {sideStackArticles.map((article) => (
                <AdaptiveEditorialCard
                  key={article.id}
                  article={article}
                  headingLevel="h2"
                  eager
                  testId="berita-collage-side-card"
                  desktopMinHeightClass="sm:min-h-0 sm:aspect-[4/3]"
                />
              ))}
            </div>
          </section>

          {/* Kolase Lanjutan: Banner Fitur + Pasangan Kartu Adaptif */}
          {remainingArticles.length > 0 && (
            <section
              aria-labelledby="kolase-edisi-heading"
              data-testid="berita-collage-secondary"
              className="space-y-4 sm:space-y-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-[var(--text-muted)]">
                    Liputan Lapangan &amp; Studio
                  </p>
                  <h2
                    id="kolase-edisi-heading"
                    className="text-[17px] sm:text-xl font-semibold text-[var(--text)]"
                  >
                    Kolase Berita &amp; Edisi Lainnya
                  </h2>
                </div>
                <Link
                  to="/portofolio"
                  className="inline-flex items-center gap-1 min-h-9 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  Lihat Portofolio
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              {secondaryBannerArticle && (
                <article
                  data-testid="berita-secondary-banner"
                  className="group relative flex flex-col min-h-[215px] sm:min-h-[260px] lg:min-h-0 lg:aspect-[4/1] rounded-[var(--radius-lg)] border border-[var(--border)] bg-zinc-900 overflow-hidden shadow-[var(--shadow-sm)]"
                >
                  <Link
                    to={`/berita/${secondaryBannerArticle.slug}`}
                    className="relative flex flex-1 w-full items-end md:items-center justify-end focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                  >
                    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-zinc-900">
                      <ImageFallback
                        src={secondaryBannerArticle.gambarSampul}
                        alt={
                          secondaryBannerArticle.teksAltSampul || secondaryBannerArticle.judul
                        }
                        aspectRatio="auto"
                        fallbackLabel="Foto Berita"
                        className="h-full w-full rounded-none border-0"
                        imgClassName="image-hover-zoom h-full w-full object-cover"
                      />
                    </div>

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/92 via-zinc-950/58 to-zinc-950/15 md:bg-gradient-to-l md:from-zinc-950/92 md:via-zinc-950/65 md:to-zinc-950/20"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none hidden md:block absolute -inset-x-px -bottom-px h-[55%] bg-gradient-to-t from-zinc-950/70 via-zinc-950/25 to-transparent"
                    />

                    <ArrowUpRight
                      className="pointer-events-none absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-10 size-4 sm:size-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />

                    <div
                      data-testid="berita-secondary-banner-copy"
                      className="relative z-10 w-full md:w-[56%] lg:w-[50%] xl:w-[48%] p-4 pr-10 sm:p-7 sm:pr-12 lg:py-6 lg:pl-8 lg:pr-12 xl:py-7 xl:pl-10 xl:pr-14 space-y-1.5 sm:space-y-2 text-left"
                    >
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] sm:text-xs text-zinc-200 tabular-nums">
                        <span className="font-medium text-white">
                          {secondaryBannerArticle.kategori}
                        </span>
                        <span aria-hidden="true" className="text-zinc-300">
                          ·
                        </span>
                        <time
                          dateTime={secondaryBannerArticle.tanggalTerbit}
                          className="whitespace-nowrap"
                        >
                          {formatNewsDate(secondaryBannerArticle.tanggalTerbit)}
                        </time>
                      </p>

                      <h3 className="text-base sm:text-xl lg:text-2xl xl:text-[1.65rem] font-semibold text-white leading-[1.24] line-clamp-2 sm:line-clamp-3">
                        {secondaryBannerArticle.judul}
                      </h3>

                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed line-clamp-2 sm:line-clamp-3">
                        {secondaryBannerArticle.ringkasan}
                      </p>
                    </div>
                  </Link>
                </article>
              )}

              {secondaryGridArticles.length === 1 ? (
                <HorizontalFeatureCard
                  article={secondaryGridArticles[0]}
                  brandName={businessConfig.namaMerekSingkat}
                  splitClass="sm:col-span-5"
                />
              ) : (
                secondaryGridArticles.length >= 2 && (
                  <div
                    data-testid="berita-secondary-pair"
                    className="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6"
                  >
                    {secondaryGridArticles.map((article) => (
                      <AdaptiveEditorialCard
                        key={article.id}
                        article={article}
                        headingLevel="h3"
                        testId="berita-secondary-pair-card"
                      />
                    ))}
                  </div>
                )
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

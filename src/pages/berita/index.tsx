import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { parseDetailSearchRedirectState } from '../../lib/detail-search-navigation';
import {
  ALL_NEWS_CATEGORIES,
  BERITA_SORT_OPTIONS,
  extractBeritaOnlyCategories,
  filterBeritaOnlyArticles,
  getNewsSlug,
  sortBeritaArticles,
  type BeritaSortMode,
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
        to={`/berita/${getNewsSlug(article)}`}
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
        to={`/berita/${getNewsSlug(article)}`}
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
            <Link to={`/berita/${getNewsSlug(article)}`}>{article.judul}</Link>
          </h3>
          <p className="text-[13px] sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
            {article.ringkasan}
          </p>
        </div>

        <div className="pt-3 sm:pt-3.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-subtle)]">{brandName}</span>
          <LinkButton to={`/berita/${getNewsSlug(article)}`} variant="secondary" size="sm">
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
  const targetUrl = `/berita/${getNewsSlug(article)}`;

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
    `Berita Terbaru | ${businessConfig.namaMerek}`,
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

  const location = useLocation();
  const [newsSearch, setNewsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_NEWS_CATEGORIES);
  const [sortBy, setSortBy] = useState<BeritaSortMode>('featured');
  const [isSearchActive, setIsSearchActive] = useState(() =>
    Boolean(parseDetailSearchRedirectState(location.state)?.openSearch)
  );

  const filteredNews = useMemo(
    () =>
      sortBeritaArticles(
        filterBeritaOnlyArticles(newsArticles, selectedCategory, newsSearch),
        sortBy
      ),
    [newsArticles, selectedCategory, newsSearch, sortBy]
  );

  const hasPopupFilterActive =
    selectedCategory !== ALL_NEWS_CATEGORIES || sortBy !== 'featured';

  const resetPopupFilters = useCallback(() => {
    setSelectedCategory(ALL_NEWS_CATEGORIES);
    setSortBy('featured');
  }, []);

  const resetFilters = useCallback(() => {
    setNewsSearch('');
    resetPopupFilters();
  }, [resetPopupFilters]);

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        search: {
          value: newsSearch,
          onChange: setNewsSearch,
          placeholder: 'Cari kabar workshop atau proyek...',
          ariaLabel: 'Cari berita terbaru',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasPopupFilterActive,
          onResetAll: resetFilters,
          filterAriaLabel: 'Filter dan urutkan berita',
          filterTitle: 'Urutkan & Filter',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Urutkan
                </p>
                <div role="radiogroup" aria-label="Urutkan berita" className="space-y-1">
                  {BERITA_SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSortBy(opt.value)}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer text-left',
                          isSelected
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <Check className="size-3.5 text-[var(--text)] shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {beritaCategories.length > 1 && (
                <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Kategori
                  </p>
                  <div
                    role="group"
                    aria-label="Filter kategori berita"
                    className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto"
                  >
                    {beritaCategories.map((cat) => {
                      const isActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSelectedCategory(cat)}
                          className={[
                            'min-h-8 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
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

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasPopupFilterActive}
                  onClick={resetPopupFilters}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Filter
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
        },
      },
    }),
    [
      newsSearch,
      sortBy,
      selectedCategory,
      hasPopupFilterActive,
      beritaCategories,
      resetPopupFilters,
      resetFilters,
    ]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  const leadArticle = filteredNews[0] ?? null;
  const sideStackArticles = filteredNews.slice(1, 3);
  const remainingArticles = filteredNews.slice(3);
  const secondaryBannerArticle = remainingArticles[0] ?? null;
  const secondaryGridArticles = remainingArticles.slice(1);

  return (
    <div className={isSearchActive ? undefined : 'space-y-6 sm:space-y-8'}>
      {!isSearchActive && (
        <div data-testid="berita-header-row">
          <SectionHeading
            as="h1"
            eyebrow="Kabar & Publikasi Studio"
            title="Berita & Jurnal Shansus Dzar Indonesia"
            className="min-w-0 [&_h1]:text-[22px] [&_h1]:sm:text-3xl [&_h1]:lg:text-4xl"
          />
        </div>
      )}

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
      ) : isSearchActive ? (
        <div
          data-testid="berita-search-results"
          className="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6"
        >
          {filteredNews.map((article, index) => (
            <AdaptiveEditorialCard
              key={article.id}
              article={article}
              headingLevel="h2"
              eager={index < 4}
              testId="berita-search-card"
            />
          ))}
        </div>
      ) : filteredNews.length === 1 ? (
        <HorizontalFeatureCard
          article={leadArticle}
          brandName={businessConfig.namaMerek}
          splitClass="sm:col-span-5"
          eager
        />
      ) : filteredNews.length === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          <div className="lg:col-span-7">
            <HorizontalFeatureCard
              article={leadArticle}
              brandName={businessConfig.namaMerek}
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
                    to={`/berita/${getNewsSlug(secondaryBannerArticle)}`}
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
                  brandName={businessConfig.namaMerek}
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

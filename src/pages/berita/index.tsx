import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_NEWS_CATEGORIES,
  extractNewsCategories,
  filterNewsArticles,
} from '../../lib/informasi-filter';
import { buildBeritaListJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

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

export default function BeritaPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);

  useDocumentTitle(
    `Berita & Artikel | ${businessConfig.namaMerekSingkat}`,
    'Kumpulan berita terbaru workshop, proyek interior custom, jadwal survei lapangan, dan publikasi resmi dari Shansus Dzar Indonesia.',
    {
      keywords: [
        'berita shansus dzar indonesia',
        'interior purwakarta',
        'artikel furniture custom',
        'kabar workshop purwakarta',
      ],
    }
  );

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  const beritaSchema = useMemo(
    () => buildBeritaListJsonLd(newsArticles, businessConfig, originUrl),
    [newsArticles, businessConfig, originUrl]
  );
  useJsonLdSchema('shansusdzar-berita-collection', beritaSchema);

  const [newsCategory, setNewsCategory] = useState(ALL_NEWS_CATEGORIES);
  const [newsSearch, setNewsSearch] = useState('');

  const newsCategories = useMemo(() => extractNewsCategories(newsArticles), [newsArticles]);
  const filteredNews = useMemo(
    () => filterNewsArticles(newsArticles, newsCategory, newsSearch),
    [newsArticles, newsCategory, newsSearch]
  );

  const leadArticle = filteredNews[0] ?? null;
  const secondaryArticles = filteredNews.slice(1);

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="space-y-5 sm:space-y-6">
        <SectionHeading
          as="h1"
          eyebrow="Publikasi Resmi Studio"
          title="Berita & Artikel Shansus Dzar Indonesia"
          description="Kabar terbaru workshop, proyek interior di Purwakarta dan sekitarnya, edukasi material, serta informasi layanan resmi kami."
        />

        {operationalInfo.pengumumanAktif && operationalInfo.teksPengumuman.trim() && (
          <div
            role="status"
            className="py-3.5 border-y border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[var(--text)]">Informasi Layanan Terkini</p>
              <p className="text-sm text-[var(--text-muted)]">{operationalInfo.teksPengumuman}</p>
            </div>
            <ExternalLinkButton
              href={buildDynamicWhatsAppUrl(
                businessConfig,
                `Halo ${businessConfig.namaMerek}, saya ingin menjadwalkan survei atau konsultasi.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              Jadwalkan Survei
            </ExternalLinkButton>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori berita"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto md:flex-1"
          >
            {newsCategories.map((cat) => {
              const active = newsCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setNewsCategory(cat)}
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

          <div className="relative w-full md:w-72 shrink-0">
            <label htmlFor="news-search" className="sr-only">
              Cari berita dan artikel
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="news-search"
              type="text"
              value={newsSearch}
              onChange={(e) => setNewsSearch(e.target.value)}
              placeholder="Cari berita, tips, atau topik..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {!leadArticle ? (
        <div className="py-12 border-t border-[var(--border)] text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Belum ada berita atau artikel yang cocok dengan kata kunci pencarian tersebut.
          </p>
          <button
            type="button"
            onClick={() => {
              setNewsCategory(ALL_NEWS_CATEGORIES);
              setNewsSearch('');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)] hover:underline cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset Filter Berita
          </button>
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          <article className="pb-8 border-b border-[var(--border)] grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-center">
            <Link
              to={`/berita/${leadArticle.slug}`}
              className="lg:col-span-6 -mx-4 sm:mx-0 block overflow-hidden image-clip-frame sm:rounded-[var(--radius-md)]"
            >
              <ImageFallback
                src={leadArticle.gambarSampul}
                alt={leadArticle.teksAltSampul || leadArticle.judul}
                aspectRatio="16/9"
                eager
                fallbackLabel="Foto Berita"
                className="rounded-none border-0"
              />
            </Link>
            <div className="lg:col-span-6 space-y-3">
              <p className="text-xs text-[var(--text-muted)] tabular-nums">
                {leadArticle.unggulan ? 'Berita Utama · ' : ''}
                {leadArticle.kategori} ·{' '}
                <time dateTime={leadArticle.tanggalTerbit}>
                  {formatNewsDate(leadArticle.tanggalTerbit)}
                </time>{' '}
                · {leadArticle.menitBaca} menit baca
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text)] leading-snug">
                <Link to={`/berita/${leadArticle.slug}`} className="hover:underline">
                  {leadArticle.judul}
                </Link>
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {leadArticle.ringkasan}
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-subtle)]">Oleh {leadArticle.namaPenulis}</p>
                <LinkButton to={`/berita/${leadArticle.slug}`} variant="primary" size="sm">
                  Baca Artikel
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </LinkButton>
              </div>
            </div>
          </article>

          {secondaryArticles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {secondaryArticles.map((article) => (
                <article
                  key={article.id}
                  className="group flex flex-col justify-between gap-3.5 pb-6 border-b border-[var(--border)] md:border-b-0 md:pb-0"
                >
                  <div className="space-y-3">
                    <Link
                      to={`/berita/${article.slug}`}
                      className="-mx-4 sm:mx-0 block overflow-hidden image-clip-frame sm:rounded-[var(--radius-md)]"
                    >
                      <ImageFallback
                        src={article.gambarSampul}
                        alt={article.teksAltSampul || article.judul}
                        aspectRatio="16/9"
                        fallbackLabel="Foto Artikel"
                        className="rounded-none border-0"
                        imgClassName="image-hover-zoom"
                      />
                    </Link>
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      {article.kategori} ·{' '}
                      <time dateTime={article.tanggalTerbit}>
                        {formatNewsDate(article.tanggalTerbit)}
                      </time>{' '}
                      · {article.menitBaca} menit
                    </p>
                    <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                      <Link to={`/berita/${article.slug}`} className="hover:underline">
                        {article.judul}
                      </Link>
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
                      {article.ringkasan}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-subtle)] truncate">
                      {article.namaPenulis}
                    </span>
                    <Link
                      to={`/berita/${article.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
                    >
                      Baca Selengkapnya
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <section
        aria-label="Navigasi informasi terkait"
        className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Pelajari Material &amp; Pertanyaan Umum
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Jelajahi panduan teknis material utama &amp; finishing/laminasi (HPL, Cat Duco) atau baca FAQ
            layanan survei kami.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <LinkButton to="/tips-interior" variant="secondary" size="sm">
            Tips Interior &amp; Material
          </LinkButton>
          <LinkButton to="/faq" variant="secondary" size="sm">
            Pusat FAQ
          </LinkButton>
        </div>
      </section>
    </div>
  );
}

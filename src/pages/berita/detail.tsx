import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { BeritaRelatedSidebar } from '../../components/informasi/berita-related-sidebar';
import { LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { getNewsSlug, isTipsInteriorCategory } from '../../lib/informasi-filter';
import { useCachedMediaSrc } from '../../lib/media-cache';
import {
  parseNewsContentBlocks,
  resolveNewsImageGroupLayout,
} from '../../lib/news-content';
import { buildArticleJsonLd } from '../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { useSiteContentStore } from '../../store/site-content-store';

function formatIndonesianDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

function NaturalNewsImage({
  src,
  alt,
  isMultiCol,
}: {
  src: string;
  alt: string;
  isMultiCol: boolean;
}) {
  const cachedSrc = useCachedMediaSrc(src);
  const displaySrc = cachedSrc ?? src;
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !displaySrc) {
    return (
      <ImageFallback
        src={null}
        alt={alt}
        aspectRatio="16/9"
        fallbackLabel="Dokumentasi Berita"
        className="w-full rounded-none border-0"
      />
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={
        isMultiCol
          ? 'block w-full h-auto object-contain'
          : 'block w-auto max-w-full max-h-[72vh] h-auto mx-auto object-contain'
      }
    />
  );
}

export default function BeritaDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);

  const article = useMemo(
    () => newsArticles.find((item) => getNewsSlug(item) === slug) ?? null,
    [newsArticles, slug]
  );

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return newsArticles
      .filter(
        (item) =>
          item.id !== article.id &&
          !isTipsInteriorCategory(item.kategori)
      )
      .slice(0, 5);
  }, [article, newsArticles]);

  const rawCoverSrc = article?.gambarSampul ?? null;
  const cachedCoverSrc = useCachedMediaSrc(rawCoverSrc);
  const coverSrc = cachedCoverSrc ?? rawCoverSrc;
  const [heroImageError, setHeroImageError] = useState(false);

  useEffect(() => {
    setHeroImageError(false);
  }, [rawCoverSrc]);

  const contentBlocks = useMemo(() => {
    if (!article) return [];
    let photoCounter = 0;
    return parseNewsContentBlocks(article.isi).map((block) => {
      if (block.type === 'paragraph') return block;
      return {
        ...block,
        images: block.images.map((img) => {
          photoCounter += 1;
          return {
            ...img,
            captionNumber: photoCounter,
          };
        }),
      };
    });
  }, [article]);

  const desktopSidebarNode = useMemo(
    () =>
      article ? (
        <BeritaRelatedSidebar
          articleId={article.id}
          relatedArticles={relatedArticles}
          variant="desktop"
        />
      ) : null,
    [article, relatedArticles]
  );

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        hideDesktopNav: true,
        hideDesktopAccountIcons: true,
        hideCartIcon: true,
        desktopSidebarSplit: Boolean(article),
        backTo: '/berita',
        backAriaLabel: 'Kembali ke Berita',
        searchRedirect: {
          listRoute: '/berita',
          ariaLabel: 'Cari berita terbaru',
        },
        ...(article
          ? {
              mobileEyebrow: article.kategori,
              mobileTitle: article.judul,
            }
          : {}),
      },
      bottom: null,
      desktopRightSidebar: desktopSidebarNode,
    }),
    [article, desktopSidebarNode]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      const scrollContainer = document.getElementById('app-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, [article?.id]);

  const originUrl = getRuntimeSiteOrigin();

  useDocumentTitle(
    article
      ? article.judulSeo.trim() || `${article.judul} | ${businessConfig.namaMerek}`
      : `Berita Tidak Ditemukan | ${businessConfig.namaMerek}`,
    article
      ? article.deskripsiSeo.trim() || article.ringkasan
      : 'Berita yang Anda cari belum tersedia atau telah diarsipkan.',
    article
      ? {
          ogType: 'article',
          ogImage: article.gambarSampul,
          keywords: article.kataKunciSeo,
        }
      : undefined
  );

  const articleSchema = useMemo(
    () => (article ? buildArticleJsonLd(article, businessConfig, originUrl) : null),
    [article, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-article-schema', articleSchema);

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Berita</p>
        <h1 className="text-xl sm:text-3xl font-semibold text-[var(--text)]">
          Berita Tidak Ditemukan
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          Berita yang Anda cari mungkin telah diperbarui alamatnya atau belum diterbitkan.
        </p>
        <div className="pt-2">
          <LinkButton to="/berita" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Berita
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 sm:gap-8 lg:gap-0">
      <div className="min-w-0 space-y-5 sm:space-y-9">
        <section aria-labelledby="berita-detail-heading">
          <div
            data-testid="berita-detail-hero"
            className="relative -mx-4 sm:-mx-6 -mt-5 sm:-mt-9 lg:-ml-[calc(3vw+2rem)] lg:-mr-10 xl:-mr-12 lg:-mt-9 aspect-[16/9] lg:aspect-[3/1] overflow-hidden rounded-none bg-[var(--bg)]"
          >
            {coverSrc && !heroImageError && (
              <img
                src={coverSrc}
                alt={article.teksAltSampul || article.judul}
                referrerPolicy="no-referrer"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onError={() => setHeroImageError(true)}
                className="pointer-events-none absolute inset-0 size-full object-cover object-center"
              />
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-px -bottom-px h-[52%] sm:h-[46%] lg:h-[42%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/78 to-transparent"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--bg)]/95 via-[var(--bg)]/58 to-transparent"
            />

            <div className="relative z-10 flex h-full min-h-0 flex-col justify-end px-4 sm:px-6 lg:pl-[calc(3vw+2rem)] lg:pr-10 xl:pr-12 pt-5 pb-4 sm:pb-7 lg:pb-8">
              <div className="space-y-1 sm:space-y-2 max-w-[44rem]">
                <p
                  data-testid="berita-detail-hero-meta"
                  className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-sm text-[var(--text-muted)] tabular-nums"
                >
                  <span className="font-semibold text-[var(--text)]">{article.kategori}</span>
                  <span aria-hidden="true" className="text-[var(--text-subtle)]">
                    ·
                  </span>
                  <time dateTime={article.tanggalTerbit}>
                    {formatIndonesianDate(article.tanggalTerbit)}
                  </time>
                </p>

                <h1
                  id="berita-detail-heading"
                  data-testid="berita-detail-title"
                  className="text-lg sm:text-[1.75rem] lg:text-[2.1rem] xl:text-[2.3rem] font-semibold tracking-tight text-[var(--text)] leading-[1.2] sm:leading-[1.16]"
                >
                  {article.judul}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <article data-testid="berita-detail-article" className="space-y-4 sm:space-y-8">
          <p
            data-testid="berita-detail-summary"
            className="text-[13.5px] sm:text-[1.1875rem] font-medium text-[var(--text)] leading-[1.58] sm:leading-[1.6] text-justify border-b border-[var(--border)] pb-4 sm:pb-6"
          >
            {article.ringkasan}
          </p>

          <div data-testid="berita-detail-body" className="space-y-4 sm:space-y-6">
            {(() => {
              let leadRendered = false;
              return contentBlocks.map((block, blockIndex) => {
                if (block.type === 'paragraph') {
                  const style = block.gaya ?? 'paragraf';
                  const alignClass = block.rata === 'left' ? 'text-left' : 'text-justify';

                  if (style === 'subjudul') {
                    return (
                      <h2
                        key={`h-${blockIndex}`}
                        className={`text-base sm:text-xl font-semibold text-[var(--text)] leading-snug pt-2 ${alignClass}`}
                      >
                        {block.text}
                      </h2>
                    );
                  }

                  if (style === 'kutipan') {
                    return (
                      <blockquote
                        key={`q-${blockIndex}`}
                        className={`border-l-2 border-[var(--border-strong)] pl-4 py-1 text-[13.5px] sm:text-[17px] italic text-[var(--text)]/85 leading-[1.68] sm:leading-[1.82] ${alignClass}`}
                      >
                        {block.text}
                      </blockquote>
                    );
                  }

                  const isLeadParagraph = !leadRendered;
                  leadRendered = true;
                  return (
                    <p
                      key={`p-${blockIndex}`}
                      className={[
                        `text-[13.5px] sm:text-[17px] text-[var(--text)]/90 leading-[1.68] sm:leading-[1.82] ${alignClass}`,
                        isLeadParagraph
                          ? 'first-letter:text-[2.8rem] sm:first-letter:text-[3.75rem] first-letter:font-semibold first-letter:leading-[0.82] first-letter:float-left first-letter:mr-2 first-letter:mt-[0.22rem] sm:first-letter:mt-[0.32rem] first-letter:text-[var(--text)]'
                          : '',
                      ].join(' ')}
                    >
                      {block.text}
                    </p>
                  );
                }

              const layout = resolveNewsImageGroupLayout(block);
              const firstNumber = block.images[0].captionNumber;
              const lastNumber = block.images[block.images.length - 1].captionNumber;
              const defaultCaption =
                block.images.length === 1
                  ? `Dokumentasi ${firstNumber} · ${article.judul}`
                  : `Dokumentasi ${firstNumber}–${lastNumber} · ${article.judul}`;
              const captionLabel = block.caption?.trim() || defaultCaption;

              return (
                <figure
                  key={`img-group-${blockIndex}`}
                  data-testid="berita-detail-inline-images"
                  data-image-mode={layout.mode}
                  data-image-grid={layout.grid}
                  data-image-ratio={layout.ratio}
                  className={[
                    'my-1.5 sm:my-2 space-y-1.5 sm:space-y-2',
                    layout.isFullBleed
                      ? '-mx-4 sm:-mx-6 lg:-ml-[calc(3vw+2rem)] lg:-mr-10 xl:-mr-12'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className={layout.gridClassName}>
                    {block.images.map((img, imgIndex) => {
                      const imgAlt =
                        img.alt?.trim() ||
                        `${article.judul} — Dokumentasi ${img.captionNumber}`;
                      const frameClass = layout.isFullBleed
                        ? 'overflow-hidden rounded-none border-y border-[var(--border)] bg-[var(--surface-muted)]'
                        : 'overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]';

                      if (layout.mode === 'fit') {
                        const fitWrapperClass =
                          layout.grid === '1' && !layout.isFullBleed
                            ? 'mx-auto w-fit max-w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]'
                            : `${frameClass} flex items-center justify-center`;
                        return (
                          <div key={`${img.url}-${imgIndex}`} className={fitWrapperClass}>
                            <NaturalNewsImage
                              src={img.url}
                              alt={imgAlt}
                              isMultiCol={layout.grid !== '1'}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={`${img.url}-${imgIndex}`} className={frameClass}>
                          <ImageFallback
                            src={img.url}
                            alt={imgAlt}
                            aspectRatio={layout.ratio}
                            fallbackLabel="Dokumentasi Berita"
                            className="rounded-none border-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <figcaption
                    className={[
                      'text-[11px] sm:text-xs text-[var(--text-muted)] leading-relaxed text-center',
                      layout.isFullBleed
                        ? 'px-4 sm:px-6 lg:pl-[calc(3vw+2rem)] lg:pr-10 xl:pr-12'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {captionLabel}
                  </figcaption>
                </figure>
              );
            });
            })()}
          </div>

          {article.kataKunciSeo.length > 0 && (
            <footer
              data-testid="berita-detail-topics"
              className="pt-3 sm:pt-4 space-y-1 sm:space-y-1.5"
            >
              <p className="text-[11.5px] sm:text-xs font-semibold text-[var(--text)]">
                Topik Berita
              </p>
              <p className="text-[11px] sm:text-xs text-[var(--text)]/85 leading-relaxed">
                {article.kataKunciSeo.join(' · ')}
              </p>
            </footer>
          )}
        </article>
      </div>

      <aside
        aria-labelledby="related-news-heading-mobile"
        data-testid="berita-related-sidebar-mobile"
        className="lg:hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col"
      >
        <BeritaRelatedSidebar
          articleId={article.id}
          relatedArticles={relatedArticles}
          variant="mobile"
        />
      </aside>
    </div>
  );
}

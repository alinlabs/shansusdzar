import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router';
import {
  computePortfolioAreaSqm,
  findMatchingProductForPortfolio,
  formatPortfolioDimensionSummary,
  getPortfolioSlug,
  hasVisiblePortfolioReview,
  resolvePortfolioClientSummary,
  resolvePortfolioReferencePrice,
} from '../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../lib/price-format';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import type { PortfolioCaseStudy } from '../../types/cms';
import type { ProductItem } from '../../types/product';
import { ImageFallback } from './image-fallback';

export interface PortfolioCardProps {
  project: PortfolioCaseStudy;
  activeProducts: ReadonlyArray<ProductItem>;
  eager?: boolean;
  featuredWide?: boolean;
  titleAs?: 'h2' | 'h3';
  testId?: string;
}

export function PortfolioCard({
  project,
  activeProducts,
  eager = false,
  featuredWide = false,
  titleAs = 'h2',
  testId = 'portfolio-card',
}: PortfolioCardProps) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const matchedProduct = findMatchingProductForPortfolio(project, activeProducts);
  const referencePrice = resolvePortfolioReferencePrice(project, matchedProduct, customPricing);
  const formattedReferencePrice = formatCurrencyIDR(referencePrice);
  const targetUrl = `/portofolio/${encodeURIComponent(getPortfolioSlug(project))}`;
  const TitleTag = titleAs;

  const hasReview = Boolean(hasVisiblePortfolioReview(project) && project.ulasan);
  const reviewRating = project.ulasan?.penilaian || 5;
  const clientSummary = resolvePortfolioClientSummary(project);
  const areaSqm = computePortfolioAreaSqm(project.dimensi);
  const dimensionSummary = formatPortfolioDimensionSummary(project.dimensi);
  const areaSummaryLabel =
    areaSqm > 0
      ? `Est. Biaya ${areaSqm}M²`
      : dimensionSummary ? `${dimensionSummary} cm` : '-';

  return (
    <article
      data-testid={testId}
      className={featuredWide ? 'group h-full cv-auto-card lg:col-span-2' : 'group h-full cv-auto-card'}
    >
      <Link
        to={targetUrl}
        aria-label={`Buka studi kasus ${project.judul}`}
        onMouseEnter={() => prefetchRoute(targetUrl)}
        onFocus={() => prefetchRoute(targetUrl)}
        className={[
          'flex h-full overflow-hidden image-clip-frame rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] card-hover-surface text-left focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
          featuredWide ? 'flex-col lg:flex-row' : 'flex-col',
        ].join(' ')}
      >
        <div
          className={
            featuredWide
              ? 'relative overflow-hidden bg-[var(--surface-muted)] lg:w-[56%] lg:shrink-0 lg:h-full'
              : 'relative overflow-hidden bg-[var(--surface-muted)]'
          }
        >
          <ImageFallback
            src={project.gambarUtama}
            alt={project.teksAlt || project.judul}
            aspectRatio={featuredWide ? 'auto' : '4/3'}
            eager={eager}
            fallbackLabel={project.kategori}
            className={
              featuredWide
                ? 'rounded-none border-0 aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[340px]'
                : 'rounded-none border-0'
            }
            imgClassName="image-hover-zoom"
          />
          <div
            aria-hidden="true"
            className={[
              'pointer-events-none absolute -inset-x-px -bottom-px h-[calc(45%+2px)] transform-gpu bg-gradient-to-t from-black/80 via-black/35 to-transparent',
              featuredWide ? 'lg:hidden' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <ArrowUpRight
            className={[
              'pointer-events-none absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-10 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
              featuredWide ? 'lg:hidden' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
          <div
            className={[
              'pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5',
              featuredWide ? 'lg:hidden' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="min-w-0">
              <p className="text-xs text-white/80 truncate">{project.kategori}</p>
              <TitleTag className="text-base sm:text-lg font-semibold text-white leading-snug mt-0.5 line-clamp-2">
                {project.judul}
              </TitleTag>
            </div>
          </div>
        </div>

        <div
          className={[
            'flex-1 flex items-stretch justify-between gap-3 p-4 sm:p-5',
            featuredWide ? 'lg:hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="min-w-0 flex flex-col justify-between gap-1">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {areaSummaryLabel}
            </p>
            {formattedReferencePrice && (
              <p
                data-testid="portfolio-card-price"
                className="text-sm font-semibold text-[var(--text)] tabular-nums"
              >
                {formattedReferencePrice}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end justify-between gap-1 shrink-0 text-right">
            <p
              data-testid="portfolio-card-meta"
              className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap"
            >
              {project.lokasi} · {project.tahun}
            </p>
            {hasReview ? (
              <div
                data-testid="portfolio-card-rating"
                className="inline-flex items-center gap-1 shrink-0"
                aria-label={`Penilaian ${reviewRating} dari 5 bintang`}
              >
                <div className="inline-flex items-center gap-0.5 text-[#b8862d] dark:text-[#d6a954]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={
                        star <= reviewRating
                          ? 'size-3 fill-current'
                          : 'size-3 text-[var(--border-strong)]'
                      }
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
                  {reviewRating.toFixed(1)}
                </span>
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </div>

        {featuredWide && (
          <div className="hidden lg:flex lg:flex-1 lg:min-w-0 lg:flex-col lg:justify-between lg:p-4 xl:p-5 lg:border-l lg:border-[var(--border)]">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[var(--text-muted)] truncate">
                  {project.kategori}
                </p>
                <ArrowUpRight
                  className="size-4 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </div>

              <TitleTag className="mt-1 text-lg xl:text-xl font-semibold text-[var(--text)] leading-snug line-clamp-2">
                {project.judul}
              </TitleTag>

              {project.deskripsi && (
                <p className="mt-1.5 text-xs xl:text-[13px] text-[var(--text-muted)] leading-relaxed line-clamp-3">
                  {project.deskripsi}
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">Material Utama</p>
                  <p className="mt-0.5 text-[13px] xl:text-sm font-semibold text-[var(--text)] leading-snug truncate">
                    {project.catatanMaterial || '-'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">Finishing</p>
                  <p className="mt-0.5 text-[13px] xl:text-sm font-semibold text-[var(--text)] leading-snug truncate">
                    {project.catatanFinishing || '-'}
                  </p>
                </div>
              </div>

              <div
                data-testid="portfolio-wide-client"
                className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/55 px-3 py-2 flex items-center gap-2.5"
              >
                <div
                  className="size-8 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0"
                  aria-hidden="true"
                >
                  {clientSummary.inisial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs xl:text-[13px] font-semibold text-[var(--text)] truncate">
                    {clientSummary.nama}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums truncate">
                    {clientSummary.lokasiTahun}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-end justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs text-[var(--text-muted)] tabular-nums">{areaSummaryLabel}</p>
                {formattedReferencePrice && (
                  <p className="text-base font-semibold text-[var(--text)] tabular-nums">
                    {formattedReferencePrice}
                  </p>
                )}
              </div>

              {hasReview ? (
                <div
                  data-testid="portfolio-wide-rating"
                  className="inline-flex items-center shrink-0 pb-0.5"
                  aria-label={`Penilaian ${reviewRating} dari 5 bintang`}
                >
                  <div className="inline-flex items-center gap-1 text-[#b8862d] dark:text-[#d6a954]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={
                          star <= reviewRating
                            ? 'size-4 fill-current'
                            : 'size-4 text-[var(--border-strong)]'
                        }
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          </div>
        )}
      </Link>
    </article>
  );
}

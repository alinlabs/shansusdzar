import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router';
import { ImageFallback } from '../../components/ui/image-fallback';
import { PortfolioCard } from '../../components/ui/portfolio-card';
import {
  findMatchingProductForPortfolio,
  hasVisiblePortfolioReview,
  partitionMobilePortfolioProjects,
  resolvePortfolioReferencePrice,
} from '../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../lib/price-format';
import { parseReferenceSizeCm } from '../../lib/product-catalog';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import type { CustomInteriorPricingConfig, PortfolioCaseStudy } from '../../types/cms';
import type { ProductItem } from '../../types/product';

function resolveAreaLabel(project: PortfolioCaseStudy): string {
  const parsedDim = parseReferenceSizeCm(project.ringkasanDimensi);
  const areaSqm = parsedDim
    ? Math.round(((parsedDim.lengthCm * parsedDim.widthCm) / 10000) * 10000) / 10000
    : project.luasMeterPersegi;
  return areaSqm > 0 ? `Est. Biaya ${areaSqm}M²` : project.ringkasanDimensi;
}

function MobileLeadPortfolioShowcase({
  project,
  activeProducts,
  customPricing,
}: {
  project: PortfolioCaseStudy;
  activeProducts: ReadonlyArray<ProductItem>;
  customPricing: CustomInteriorPricingConfig | null | undefined;
}) {
  const matchedProduct = findMatchingProductForPortfolio(project, activeProducts);
  const referencePrice = resolvePortfolioReferencePrice(project, matchedProduct, customPricing);
  const formattedReferencePrice = formatCurrencyIDR(referencePrice);
  const targetUrl = `/portofolio/${project.slug}`;
  const hasReview = Boolean(hasVisiblePortfolioReview(project) && project.ulasan);
  const reviewRating = project.ulasan?.penilaian || 5;
  const areaSummaryLabel = resolveAreaLabel(project);

  return (
    <article
      data-testid="portfolio-mobile-lead"
      className="relative left-1/2 -translate-x-1/2 w-screen"
    >
      <Link
        to={targetUrl}
        aria-label={`Buka studi kasus ${project.judul}`}
        onMouseEnter={() => prefetchRoute(targetUrl)}
        onFocus={() => prefetchRoute(targetUrl)}
        className="group block text-left focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
      >
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-[var(--surface-muted)]">
          <ImageFallback
            src={project.gambarUtama}
            alt={project.teksAlt || project.judul}
            aspectRatio="auto"
            eager
            fallbackLabel={project.kategori}
            className="size-full rounded-none border-0"
            imgClassName="image-hover-zoom"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-px -bottom-px h-[calc(50%+2px)] transform-gpu bg-gradient-to-t from-black/85 via-black/35 to-transparent"
          />
          <ArrowUpRight
            className="pointer-events-none absolute top-3.5 right-4 z-10 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 pt-6">
            <p className="text-xs text-white/80 truncate">{project.kategori}</p>
            <h2 className="text-lg font-semibold text-white leading-snug mt-0.5 line-clamp-2">
              {project.judul}
            </h2>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-3.5 border-b border-[var(--border)] flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">{areaSummaryLabel}</p>
            {formattedReferencePrice && (
              <p className="text-sm font-semibold text-[var(--text)] tabular-nums">
                {formattedReferencePrice}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
            <p className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
              {project.lokasi} · {project.tahun}
            </p>
            {hasReview && (
              <div
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
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

function MobilePortfolioListRow({
  project,
  activeProducts,
  customPricing,
}: {
  project: PortfolioCaseStudy;
  activeProducts: ReadonlyArray<ProductItem>;
  customPricing: CustomInteriorPricingConfig | null | undefined;
}) {
  const matchedProduct = findMatchingProductForPortfolio(project, activeProducts);
  const referencePrice = resolvePortfolioReferencePrice(project, matchedProduct, customPricing);
  const formattedReferencePrice = formatCurrencyIDR(referencePrice);
  const targetUrl = `/portofolio/${project.slug}`;
  const hasReview = Boolean(hasVisiblePortfolioReview(project) && project.ulasan);
  const reviewRating = project.ulasan?.penilaian || 5;

  return (
    <article data-testid="portfolio-mobile-list-item">
      <Link
        to={targetUrl}
        aria-label={`Buka studi kasus ${project.judul}`}
        onMouseEnter={() => prefetchRoute(targetUrl)}
        onFocus={() => prefetchRoute(targetUrl)}
        className="group flex items-center gap-3.5 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
      >
        <div className="w-28 aspect-[4/3] shrink-0 overflow-hidden image-clip-frame rounded-[var(--radius-md)] bg-[var(--surface-muted)]">
          <ImageFallback
            src={project.gambarUtama}
            alt={project.teksAlt || project.judul}
            aspectRatio="auto"
            fallbackLabel={project.kategori}
            className="size-full rounded-none border-0"
            imgClassName="image-hover-zoom"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="truncate">{project.kategori}</span>
            {hasReview && (
              <span
                className="inline-flex items-center gap-1 shrink-0 tabular-nums"
                aria-label={`Penilaian ${reviewRating} dari 5 bintang`}
              >
                <Star
                  className="size-3 fill-current text-[#b8862d] dark:text-[#d6a954]"
                  aria-hidden="true"
                />
                <span className="font-semibold text-[var(--text)]">
                  {reviewRating.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          <h2 className="text-sm font-semibold text-[var(--text)] leading-snug line-clamp-2 group-hover:underline underline-offset-4">
            {project.judul}
          </h2>

          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs tabular-nums">
            {formattedReferencePrice ? (
              <span className="font-semibold text-[var(--text)] whitespace-nowrap">
                {formattedReferencePrice}
              </span>
            ) : (
              <span className="text-[var(--text-muted)] truncate">{project.ringkasanDimensi}</span>
            )}
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              {project.lokasi} · {project.tahun}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function MobilePortfolioShowcase({
  projects,
  activeProducts,
}: {
  projects: readonly PortfolioCaseStudy[];
  activeProducts: ReadonlyArray<ProductItem>;
}) {
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const { leadProject, horizontalProjects, remainingProjects } =
    partitionMobilePortfolioProjects(projects);

  if (!leadProject) return null;

  return (
    <div className="md:hidden space-y-5">
      <MobileLeadPortfolioShowcase
        project={leadProject}
        activeProducts={activeProducts}
        customPricing={customPricing}
      />

      {horizontalProjects.length > 0 && (
        <div
          role="region"
          aria-label="Pilihan proyek portofolio lainnya"
          data-testid="portfolio-mobile-horizontal-strip"
          className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto scroll-pl-4 sm:scroll-pl-6 snap-x snap-mandatory flex items-stretch gap-3 pb-1"
        >
          {horizontalProjects.map((project, index) => (
            <div key={project.id} className="w-[74vw] max-w-[272px] shrink-0 snap-start">
              <PortfolioCard
                project={project}
                activeProducts={activeProducts}
                eager={index < 2}
                titleAs="h2"
                testId="portfolio-mobile-horizontal-card"
              />
            </div>
          ))}
        </div>
      )}

      {remainingProjects.length > 0 && (
        <div
          data-testid="portfolio-mobile-list"
          className="divide-y divide-[var(--border)] border-t border-[var(--border)]"
        >
          {remainingProjects.map((project) => (
            <MobilePortfolioListRow
              key={project.id}
              project={project}
              activeProducts={activeProducts}
              customPricing={customPricing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

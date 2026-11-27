import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { ImageFallback } from '../../components/ui/image-fallback';
import {
  getPortfolioSlug,
  shufflePortfolioProjects,
  syncPortfolioProjectsWithProducts,
} from '../../lib/portfolio-filter';
import { getDefaultProductCatalog } from '../../lib/product-catalog';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import type { PortfolioCaseStudy } from '../../types/cms';

function PortfolioRunnerCard({
  item,
  eager,
  isDuplicate,
}: {
  item: PortfolioCaseStudy;
  eager?: boolean;
  isDuplicate?: boolean;
}) {
  const TitleTag = isDuplicate ? 'p' : 'h3';
  const targetUrl = `/portofolio/${encodeURIComponent(getPortfolioSlug(item))}`;

  return (
    <Link
      to={targetUrl}
      onMouseEnter={() => prefetchRoute(targetUrl)}
      aria-label={isDuplicate ? undefined : item.judul}
      aria-hidden={isDuplicate ? true : undefined}
      tabIndex={isDuplicate ? -1 : undefined}
      className="group relative block shrink-0 w-[86cqw] sm:w-[82cqw] md:w-[calc((100cqw-1rem)/2)] lg:w-[calc((100cqw-2rem)/3)] aspect-[2/1] md:aspect-[16/9] overflow-hidden image-clip-frame rounded-[var(--radius-lg)] bg-[var(--surface)] select-none"
    >
      <ImageFallback
        src={item.gambarUtama}
        alt={isDuplicate ? '' : item.teksAlt}
        aspectRatio="auto"
        eager={eager}
        fallbackLabel={item.kategori}
        className="size-full rounded-none border-0"
        imgClassName="image-hover-zoom"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-px -bottom-px h-[calc(55%+2px)] transform-gpu bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3.5 sm:p-4 space-y-0.5 text-left">
        <p className="text-[10px] sm:text-xs font-medium text-white/80 leading-tight truncate">
          {item.kategori}
        </p>
        <TitleTag className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-2">
          {item.judul}
        </TitleTag>
      </div>
    </Link>
  );
}

export function SectionPortofolio() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const rawProjects = useSiteContentStore((state) => state.portfolioProjects);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isRunnerInView, setIsRunnerInView] = useState(true);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsRunnerInView(entry.isIntersecting);
        }
      },
      { rootMargin: '80px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeProducts = useMemo(
    () => (catalogOverride ?? loadedBaseCatalog ?? getDefaultProductCatalog()).daftarProduk,
    [catalogOverride, loadedBaseCatalog]
  );

  const allProjects = useMemo(
    () => syncPortfolioProjectsWithProducts(rawProjects, activeProducts),
    [rawProjects, activeProducts]
  );

  const items = useMemo(() => {
    const featured = allProjects.filter((p) => p.tampilDiBeranda);
    const pool = featured.length > 0 ? featured : allProjects;
    return shufflePortfolioProjects(pool);
  }, [allProjects]);

  const runnerItems = useMemo(() => {
    if (items.length === 0) return [];
    const result: PortfolioCaseStudy[] = [];
    while (result.length < 4) {
      result.push(...items);
    }
    return result;
  }, [items]);

  if (runnerItems.length === 0) return null;

  const durationSeconds = Math.max(30, Math.round(runnerItems.length * 9));
  const trackStyle = {
    '--portfolio-runner-duration': `${durationSeconds}s`,
    animationPlayState: isRunnerInView ? 'running' : 'paused',
  } as CSSProperties;

  return (
    <section aria-labelledby="portofolio-heading" className="space-y-6 sm:space-y-8">
      <div className="flex flex-row items-end justify-between gap-4">
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] leading-tight mb-0.5">
            {beranda.labelPortofolio}
          </p>
          <h2
            id="portofolio-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)] leading-snug"
          >
            {beranda.judulPortofolio}
          </h2>
        </div>

        <Link
          to="/portofolio"
          onMouseEnter={() => prefetchRoute('/portofolio')}
          onFocus={() => prefetchRoute('/portofolio')}
          className="inline-flex items-center justify-end gap-1 md:gap-1.5 text-xs font-medium tracking-wide leading-tight text-[var(--text-muted)] hover:text-[var(--text)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          <span className="md:hidden">Selengkapnya</span>
          <span className="hidden md:inline">Lihat Selengkapnya</span>
          <ChevronRight className="size-3.5 md:hidden" aria-hidden="true" />
          <ArrowRight className="hidden md:block size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div
        ref={viewportRef}
        role="region"
        aria-label="Galeri portofolio berjalan"
        className="portfolio-runner-viewport [container-type:inline-size] mx-0 w-full overflow-hidden rounded-[var(--radius-lg)]"
      >
        <div className="portfolio-runner-track flex w-max" style={trackStyle}>
          <div className="flex shrink-0 items-center gap-3 pr-3 sm:gap-4 sm:pr-4">
            {runnerItems.map((item, idx) => (
              <PortfolioRunnerCard
                key={`primary-${item.id}-${idx}`}
                item={item}
                eager={idx < 3}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex shrink-0 items-center gap-3 pr-3 sm:gap-4 sm:pr-4"
          >
            {runnerItems.map((item, idx) => (
              <PortfolioRunnerCard
                key={`duplicate-${item.id}-${idx}`}
                item={item}
                eager={false}
                isDuplicate
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

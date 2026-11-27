import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Play,
  Star,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { PortfolioCard } from '../../components/ui/portfolio-card';
import { VisualMediaStage } from '../../components/ui/visual-media-stage';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import {
  buildPortfolioDesktopGridColumns,
  buildPortfolioVisualSlides,
  computeNextPortfolioGridStartCol,
  computePortfolioAreaSqm,
  deriveClientInitials,
  findMatchingProductForPortfolio,
  formatPortfolioClientWithSalutation,
  formatPortfolioDimensionSummary,
  getPortfolioSlug,
  hasVisiblePortfolioReview,
  resolvePortfolioReferencePrice,
  shufflePortfolioProjects,
  syncPortfolioProjectsWithProducts,
} from '../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../lib/price-format';
import { getDefaultProductCatalog, getProductSlug } from '../../lib/product-catalog';
import { buildPortfolioProjectJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import type { PortfolioDimensionItem, PortfolioReviewData } from '../../types/cms';

const PORTFOLIO_BODY_TEXT_CLASS = 'text-sm text-[var(--text-muted)] leading-relaxed';
const PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS = `${PORTFOLIO_BODY_TEXT_CLASS} text-justify`;

function PortfolioReviewContent({
  klien,
  lokasi,
  tahun,
  penilaian,
  komentar,
  testIdPrefix,
  isCollapsible = false,
  isExpanded = true,
  onToggleExpand,
  panelId,
}: {
  klien: string;
  lokasi: string;
  tahun: number | string;
  penilaian: number;
  komentar: string;
  testIdPrefix: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  panelId?: string;
}) {
  const safeRating = penilaian || 5;
  const showQuote = !isCollapsible || isExpanded;

  return (
    <div className="space-y-3.5">
      <div
        data-testid={`${testIdPrefix}-author`}
        className="flex items-start justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-10 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0"
            aria-hidden="true"
          >
            {deriveClientInitials(klien)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)] truncate">{klien}</p>
            <p
              data-testid={`${testIdPrefix}-meta`}
              className="text-xs text-[var(--text-muted)] truncate tabular-nums"
            >
              {lokasi} · {tahun}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div
            data-testid={`${testIdPrefix}-rating`}
            className="inline-flex items-center gap-1.5 pt-0.5 shrink-0"
            aria-label={`Penilaian ${penilaian} dari 5 bintang`}
          >
            <div className="inline-flex items-center gap-0.5 text-[#b8862d] dark:text-[#d6a954]">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={
                    star <= safeRating
                      ? 'size-3.5 fill-current'
                      : 'size-3.5 text-[var(--border-strong)]'
                  }
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
              {safeRating.toFixed(1)}
            </span>
          </div>

          {isCollapsible && onToggleExpand && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-toggle`}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Lihat Ulasan</span>
              <ChevronDown
                className={[
                  'size-3.5 transition-transform duration-200',
                  isExpanded ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {showQuote && (
        <div
          id={panelId}
          data-testid={`${testIdPrefix}-quote-card`}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3.5 py-3"
        >
          <blockquote
            data-testid={`${testIdPrefix}-testimonial`}
            className={PORTFOLIO_BODY_TEXT_CLASS}
          >
            {komentar}
          </blockquote>
        </div>
      )}
    </div>
  );
}

type PortfolioMobileTab = 'ringkasan' | 'solusi' | 'galeri';

function PortfolioPriceCard({
  formattedReferencePrice,
  testId = 'portfolio-detail-price',
}: {
  formattedReferencePrice: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-1"
    >
      <p className="text-xs font-medium text-[var(--text-muted)]">Est. Biaya Pengerjaan</p>
      <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] tabular-nums">
        {formattedReferencePrice}
      </p>
    </div>
  );
}

function PortfolioTechnicalSpecs({
  project,
  materialsSectionTestId = 'portfolio-detail-materials-section',
  materialsHeadingTestId = 'portfolio-detail-materials-heading',
  materialsListTestId = 'portfolio-detail-materials',
}: {
  project: {
    ulasan?: PortfolioReviewData | null;
    lokasi: string;
    cakupan: string;
    dimensi: PortfolioDimensionItem[];
    durasi: string;
    catatanMaterial: string;
    catatanFinishing: string;
    materialDigunakan: string[];
  };
  materialsSectionTestId?: string;
  materialsHeadingTestId?: string;
  materialsListTestId?: string;
}) {
  const dimensionSummary = formatPortfolioDimensionSummary(project.dimensi);
  const computedAreaSqm = computePortfolioAreaSqm(project.dimensi);
  const clientSummaryName = formatPortfolioClientWithSalutation(project.ulasan);

  return (
    <dl
      aria-label="Spesifikasi teknis proyek"
      className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1 text-sm"
    >
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Klien / Konteks</dt>
        <dd className="font-medium text-[var(--text)] mt-1">{clientSummaryName || '-'}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Lokasi Proyek</dt>
        <dd className="font-medium text-[var(--text)] mt-1">{project.lokasi}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Cakupan Kerja</dt>
        <dd className="font-medium text-[var(--text)] mt-1">{project.cakupan}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Dimensi Referensi (cm)</dt>
        <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
          {dimensionSummary || '-'}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Luas Pengerjaan</dt>
        <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
          {computedAreaSqm} m²
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Durasi Pengerjaan</dt>
        <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
          {project.durasi}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Material Utama</dt>
        <dd className="font-medium text-[var(--text)] mt-1">{project.catatanMaterial}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-muted)]">Finishing/Laminasi</dt>
        <dd className="font-medium text-[var(--text)] mt-1">{project.catatanFinishing}</dd>
      </div>
      {project.materialDigunakan.length > 0 && (
        <div data-testid={materialsSectionTestId} className="col-span-2">
          <dt
            data-testid={materialsHeadingTestId}
            className="text-xs text-[var(--text-muted)]"
          >
            Spesifikasi Material
          </dt>
          <dd className="mt-1">
            <ul
              data-testid={materialsListTestId}
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-medium text-[var(--text)]"
            >
              {project.materialDigunakan.map((mat) => (
                <li key={mat}>{mat}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

export default function PortofolioDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const rawPortfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const customPricing = useSiteContentStore((state) => state.customPricing);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeProducts = useMemo(
    () => (catalogOverride ?? loadedBaseCatalog ?? getDefaultProductCatalog()).daftarProduk,
    [catalogOverride, loadedBaseCatalog]
  );

  const portfolioProjects = useMemo(
    () => syncPortfolioProjectsWithProducts(rawPortfolioProjects, activeProducts),
    [rawPortfolioProjects, activeProducts]
  );

  const project = useMemo(
    () => portfolioProjects.find((item) => getPortfolioSlug(item) === slug) ?? null,
    [portfolioProjects, slug]
  );

  const matchedProduct = useMemo(
    () => (project ? findMatchingProductForPortfolio(project, activeProducts) : null),
    [project, activeProducts]
  );

  const slides = useMemo(
    () => (project ? buildPortfolioVisualSlides(project, matchedProduct) : []),
    [project, matchedProduct]
  );

  const [activeGallerySlide, setActiveGallerySlide] = useState(0);
  const [desktopGridStartCol, setDesktopGridStartCol] = useState(0);
  const [gallerySlideRequest, setGallerySlideRequest] = useState<{
    index: number;
    token: number;
  } | null>(null);
  const [isDesktopReviewOpen, setIsDesktopReviewOpen] = useState(true);
  const [isMobileReviewOpen, setIsMobileReviewOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<PortfolioMobileTab>('ringkasan');

  const prevActiveSlideRef = useRef(0);
  const gridPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressGridTileClickRef = useRef(false);
  const gridWheelLockUntilRef = useRef(0);

  useEffect(() => {
    prevActiveSlideRef.current = 0;
    setActiveGallerySlide(0);
    setDesktopGridStartCol(0);
    setGallerySlideRequest(null);
    setIsDesktopReviewOpen(true);
    setIsMobileReviewOpen(false);
    setActiveMobileTab('ringkasan');
  }, [project?.id]);

  useEffect(() => {
    if (prevActiveSlideRef.current === activeGallerySlide) return;
    prevActiveSlideRef.current = activeGallerySlide;
    setDesktopGridStartCol((prev) =>
      computeNextPortfolioGridStartCol(prev, activeGallerySlide, slides.length)
    );
  }, [activeGallerySlide, slides.length]);

  const relatedProjects = useMemo(() => {
    if (!project) return [];
    const sameCategory = shufflePortfolioProjects(
      portfolioProjects.filter(
        (item) => item.id !== project.id && item.kategori === project.kategori
      )
    );
    const others = shufflePortfolioProjects(
      portfolioProjects.filter(
        (item) => item.id !== project.id && item.kategori !== project.kategori
      )
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [portfolioProjects, project]);

  const headerEyebrow = project ? `${project.kategori} · ${project.lokasi} · ${project.tahun}` : '';

  const referencePrice = useMemo(
    () => (project ? resolvePortfolioReferencePrice(project, matchedProduct, customPricing) : null),
    [project, matchedProduct, customPricing]
  );
  const formattedReferencePrice = formatCurrencyIDR(referencePrice);

  const whatsappUrl = useMemo(
    () =>
      project
        ? buildDynamicWhatsAppUrl(
            businessConfig,
            `Halo ${businessConfig.namaMerek}, saya tertarik berkonsultasi mengenai konsep proyek "${project.judul}" (${project.kategori})${formattedReferencePrice ? ` dengan referensi biaya ${formattedReferencePrice}` : ''}.`
          )
        : '',
    [businessConfig, project, formattedReferencePrice]
  );

  const catalogTargetTo = matchedProduct
    ? `/produk/${encodeURIComponent(getProductSlug(matchedProduct))}`
    : '/produk';

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        hideDesktopNav: true,
        hideDesktopAccountIcons: true,
        backTo: '/portofolio',
        backAriaLabel: 'Kembali ke semua portofolio',
        searchRedirect: {
          listRoute: '/portofolio',
          ariaLabel: 'Cari proyek portofolio',
        },
        ...(project
          ? {
              mobileEyebrow: headerEyebrow,
              mobileTitle: project.judul,
            }
          : {}),
      },
      bottom: project
        ? {
            type: 'custom',
            render: () => (
              <div data-testid="bottom-nav-portfolio-detail" className="py-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <LinkButton
                    to={catalogTargetTo}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    data-testid="mobile-bottom-portfolio-catalog"
                    className="!min-h-9 !h-9 !px-3"
                  >
                    <span className="truncate">Lihat Katalog</span>
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </LinkButton>
                  <LinkButton
                    to="/produk/custom"
                    variant="secondary"
                    size="sm"
                    fullWidth
                    data-testid="mobile-bottom-portfolio-custom"
                    className="!min-h-9 !h-9 !px-3"
                  >
                    <span className="truncate">Rancang Custom</span>
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </LinkButton>
                </div>
                <ExternalLinkButton
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="md"
                  fullWidth
                  aria-label="Konsultasi konsep proyek via WhatsApp"
                  data-testid="mobile-bottom-portfolio-consultation"
                  className="!min-h-10 !h-10 !text-xs"
                >
                  <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>Konsultasi</span>
                </ExternalLinkButton>
              </div>
            ),
          }
        : null,
    }),
    [project, headerEyebrow, catalogTargetTo, whatsappUrl]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [project?.id]);

  const originUrl = getRuntimeSiteOrigin();

  useDocumentTitle(
    project
      ? `${project.judul} · Portofolio | ${businessConfig.namaMerek}`
      : `Portofolio Tidak Ditemukan | ${businessConfig.namaMerek}`,
    project
      ? project.deskripsi
      : 'Dokumentasi studi kasus portofolio yang Anda cari belum tersedia atau telah diarsipkan.',
    project
      ? {
          ogType: 'article',
          ogImage: project.gambarUtama,
          keywords: [project.kategori, project.lokasi, project.cakupan, ...project.materialDigunakan],
        }
      : undefined
  );

  const projectSchema = useMemo(
    () => (project ? buildPortfolioProjectJsonLd(project, businessConfig, originUrl) : null),
    [project, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-portfolio-project-schema', projectSchema);

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Portofolio Proyek
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
          Studi Kasus Portofolio Tidak Ditemukan
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Dokumentasi proyek yang Anda cari mungkin telah diperbarui alamatnya atau sedang
          diarsipkan oleh tim workshop.
        </p>
        <div className="pt-2">
          <LinkButton to="/portofolio" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Semua Portofolio
          </LinkButton>
        </div>
      </div>
    );
  }

  const desktopGalleryColumns = buildPortfolioDesktopGridColumns(slides);
  const maxDesktopGridStartCol = Math.max(0, desktopGalleryColumns.length - 2);
  const clampedDesktopGridStartCol = Math.max(
    0,
    Math.min(maxDesktopGridStartCol, desktopGridStartCol)
  );

  const shiftDesktopGrid = (deltaCol: number) => {
    if (maxDesktopGridStartCol <= 0) return;
    setDesktopGridStartCol((prev) =>
      Math.max(0, Math.min(maxDesktopGridStartCol, prev + deltaCol))
    );
  };

  const renderDesktopGalleryTile = (
    slide: (typeof slides)[number],
    slideIndex: number
  ) => {
    const isActive = slideIndex === activeGallerySlide;
    return (
      <button
        key={slide.id}
        type="button"
        draggable={false}
        data-testid="portfolio-gallery-grid-item"
        aria-label={`Tampilkan ${slide.title}`}
        aria-pressed={isActive}
        onClick={() => {
          if (suppressGridTileClickRef.current) {
            suppressGridTileClickRef.current = false;
            return;
          }
          setGallerySlideRequest((prev) => ({
            index: slideIndex,
            token: (prev?.token ?? 0) + 1,
          }));
        }}
        className={[
          'group relative size-full min-h-0 overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface-muted)] text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]',
          isActive
            ? 'border-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]'
            : 'border-[var(--border)] hover:border-[var(--border-strong)]',
        ].join(' ')}
      >
        {slide.kind === 'video' ? (
          <div className="relative size-full pointer-events-none">
            <ImageFallback
              src={slide.poster ?? null}
              alt={slide.title}
              aspectRatio="auto"
              fallbackLabel={slide.title}
              className="size-full rounded-none border-0"
              imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-black/25"
            >
              <span className="inline-flex items-center justify-center size-10 rounded-full bg-white/95 text-black shadow-md transition-transform group-hover:scale-105">
                <Play className="size-4 fill-current ml-0.5" aria-hidden="true" />
              </span>
            </span>
          </div>
        ) : (
          <ImageFallback
            src={slide.src}
            alt={slide.title}
            aspectRatio="auto"
            fallbackLabel={slide.fallbackLabel ?? slide.title}
            className="size-full rounded-none border-0 pointer-events-none"
            imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-10 sm:space-y-12">
      <article className="space-y-6 md:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 md:items-stretch">
          <div className="md:col-span-7">
            <VisualMediaStage
              itemKey={project.id}
              itemTitle={project.judul}
              slides={slides}
              galleryAriaLabel={`Galeri visual ${project.judul}`}
              miniGalleryAriaLabel="Mini galeri visual portofolio"
              externalSlideRequest={gallerySlideRequest}
              onSlideChange={setActiveGallerySlide}
            />
          </div>

          <div
            data-testid="portfolio-desktop-gallery-grid"
            aria-label={`Grid galeri visual ${project.judul}`}
            onPointerDown={(e) => {
              if (maxDesktopGridStartCol <= 0) return;
              gridPointerStartRef.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              const start = gridPointerStartRef.current;
              gridPointerStartRef.current = null;
              if (!start || maxDesktopGridStartCol <= 0) return;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy)) {
                suppressGridTileClickRef.current = true;
                window.setTimeout(() => {
                  suppressGridTileClickRef.current = false;
                }, 120);
                shiftDesktopGrid(dx < 0 ? 1 : -1);
              }
            }}
            onPointerCancel={() => {
              gridPointerStartRef.current = null;
            }}
            onWheel={(e) => {
              if (maxDesktopGridStartCol <= 0) return;
              if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) >= 18) {
                const now = Date.now();
                if (now < gridWheelLockUntilRef.current) return;
                gridWheelLockUntilRef.current = now + 320;
                shiftDesktopGrid(e.deltaX > 0 ? 1 : -1);
              }
            }}
            className="hidden md:block md:col-span-5 group/grid relative overflow-hidden select-none [touch-action:pan-y]"
          >
            <div
              className="absolute inset-0 flex gap-3 transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(calc(-${clampedDesktopGridStartCol} * (50% + 0.375rem)))`,
              }}
            >
              {desktopGalleryColumns.map((col, colIdx) => (
                <div
                  key={`desktop-col-${colIdx}`}
                  className="grid h-full grid-rows-2 gap-3 shrink-0"
                  style={{ width: 'calc((100% - 0.75rem) / 2)' }}
                >
                  {renderDesktopGalleryTile(col.top.slide, col.top.slideIndex)}
                  {col.bottom ? (
                    renderDesktopGalleryTile(col.bottom.slide, col.bottom.slideIndex)
                  ) : (
                    <div aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>

            {clampedDesktopGridStartCol > 0 && (
              <button
                type="button"
                data-testid="portfolio-desktop-grid-prev"
                aria-label="Geser grid galeri ke kiri"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  shiftDesktopGrid(-1);
                }}
                className="inline-flex items-center justify-center size-8 rounded-full bg-black/55 hover:bg-black/75 text-white absolute left-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/grid:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
            )}

            {clampedDesktopGridStartCol < maxDesktopGridStartCol && (
              <button
                type="button"
                data-testid="portfolio-desktop-grid-next"
                aria-label="Geser grid galeri ke kanan"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  shiftDesktopGrid(1);
                }}
                className="inline-flex items-center justify-center size-8 rounded-full bg-black/55 hover:bg-black/75 text-white absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/grid:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Price & Rating Header (Above Tabs, No Card, No Description) & Tabbed Content: Ringkasan | Solusi | Galeri */}
        {(() => {
          const hasMobileReview = Boolean(hasVisiblePortfolioReview(project) && project.ulasan);
          const showMobileTopBar = Boolean(formattedReferencePrice) || hasMobileReview;
          const mobileReviewRating = project.ulasan?.penilaian || 5;

          return (
            <div
              className={[
                'md:hidden',
                showMobileTopBar ? '-mt-2 space-y-3' : '-mt-6 space-y-5',
              ].join(' ')}
            >
              {showMobileTopBar && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {formattedReferencePrice ? (
                      <div data-testid="portfolio-mobile-price" className="min-w-0 space-y-0.5">
                        <p className="text-xs font-medium text-[var(--text-muted)]">
                          Est. Biaya Pengerjaan
                        </p>
                        <p className="text-xl font-bold tracking-tight text-[var(--text)] tabular-nums">
                          {formattedReferencePrice}
                        </p>
                      </div>
                    ) : (
                      <div className="min-w-0" />
                    )}

                    {hasMobileReview && project.ulasan && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div
                          data-testid="portfolio-mobile-rating"
                          className="inline-flex items-center gap-1.5 pt-0.5 shrink-0"
                          aria-label={`Penilaian ${project.ulasan.penilaian} dari 5 bintang`}
                        >
                          <div className="inline-flex items-center gap-0.5 text-[#b8862d] dark:text-[#d6a954]">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={
                                  star <= mobileReviewRating
                                    ? 'size-3.5 fill-current'
                                    : 'size-3.5 text-[var(--border-strong)]'
                                }
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
                            {mobileReviewRating.toFixed(1)}
                          </span>
                        </div>

                        <button
                          type="button"
                          data-testid="portfolio-mobile-review-toggle"
                          aria-expanded={isMobileReviewOpen}
                          aria-controls="portfolio-mobile-review-panel"
                          onClick={() => setIsMobileReviewOpen((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Lihat Ulasan</span>
                          <ChevronDown
                            className={[
                              'size-3.5 transition-transform duration-200',
                              isMobileReviewOpen ? 'rotate-180' : '',
                            ].join(' ')}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {hasMobileReview && project.ulasan && isMobileReviewOpen && (
                    <section
                      id="portfolio-mobile-review-panel"
                      aria-label="Ulasan klien proyek"
                      data-testid="portfolio-detail-review-section"
                      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
                    >
                      <div
                        data-testid="portfolio-detail-author"
                        className="flex items-center gap-3 min-w-0"
                      >
                        <div
                          className="size-10 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0"
                          aria-hidden="true"
                        >
                          {deriveClientInitials(project.ulasan.klien)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text)] truncate">
                            {project.ulasan.klien}
                          </p>
                          <p
                            data-testid="portfolio-detail-meta"
                            className="text-xs text-[var(--text-muted)] truncate tabular-nums"
                          >
                            {project.lokasi} · {project.tahun}
                          </p>
                        </div>
                      </div>
                      <div
                        data-testid="portfolio-detail-quote-card"
                        className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3.5 py-3"
                      >
                        <blockquote
                          data-testid="portfolio-detail-testimonial"
                          className={PORTFOLIO_BODY_TEXT_CLASS}
                        >
                          {project.ulasan.komentar}
                        </blockquote>
                      </div>
                    </section>
                  )}
                </div>
              )}

              <div className="space-y-5">
                <div
                  role="tablist"
                  aria-label="Navigasi bagian detail portofolio"
                  data-testid="portfolio-mobile-tablist"
                  className="-mx-4 sm:-mx-6 px-4 sm:px-6 grid grid-cols-3 border-b border-[var(--border)] bg-[var(--bg)]"
                >
                  {(
                    [
                      { id: 'ringkasan', label: 'Ringkasan' },
                      { id: 'solusi', label: 'Solusi' },
                      { id: 'galeri', label: 'Galeri' },
                    ] as const
                  ).map((tab) => {
                    const isActive = activeMobileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`portfolio-mobile-tab-${tab.id}`}
                        data-testid={`portfolio-mobile-tab-${tab.id}`}
                        aria-selected={isActive}
                        aria-controls={`portfolio-mobile-tabpanel-${tab.id}`}
                        onClick={() => setActiveMobileTab(tab.id)}
                        className={[
                          'relative min-h-11 py-2.5 text-xs text-center transition-colors whitespace-nowrap cursor-pointer',
                          isActive
                            ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {activeMobileTab === 'ringkasan' && (
                  <div
                    role="tabpanel"
                    id="portfolio-mobile-tabpanel-ringkasan"
                    aria-labelledby="portfolio-mobile-tab-ringkasan"
                    data-testid="portfolio-mobile-tabpanel-ringkasan"
                    className="space-y-5"
                  >
                    <PortfolioTechnicalSpecs
                      project={project}
                      materialsSectionTestId="portfolio-mobile-materials-section"
                      materialsHeadingTestId="portfolio-mobile-materials-heading"
                      materialsListTestId="portfolio-mobile-materials"
                    />
                  </div>
                )}

          {activeMobileTab === 'solusi' && (
            <div
              role="tabpanel"
              id="portfolio-mobile-tabpanel-solusi"
              aria-labelledby="portfolio-mobile-tab-solusi"
              data-testid="portfolio-mobile-tabpanel-solusi"
              className="space-y-6"
            >
              {project.deskripsi?.trim() && (
                <>
                  <section className="space-y-2">
                    <h2 className="text-base font-semibold text-[var(--text)]">Deskripsi</h2>
                    <p
                      data-testid="portfolio-mobile-description"
                      className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                    >
                      {project.deskripsi}
                    </p>
                  </section>
                  <div className="border-t border-[var(--border)]" />
                </>
              )}
              <section className="space-y-2">
                <h2 className="text-base font-semibold text-[var(--text)]">Tantangan Ruang</h2>
                <p
                  data-testid="portfolio-mobile-challenge"
                  className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                >
                  {project.tantangan}
                </p>
              </section>
              <div className="border-t border-[var(--border)]" />
              <section className="space-y-2">
                <h2 className="text-base font-semibold text-[var(--text)]">Solusi &amp; Eksekusi</h2>
                <p
                  data-testid="portfolio-mobile-solution"
                  className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                >
                  {project.solusi}
                </p>
              </section>
            </div>
          )}

          {activeMobileTab === 'galeri' && (
            <div
              role="tabpanel"
              id="portfolio-mobile-tabpanel-galeri"
              aria-labelledby="portfolio-mobile-tab-galeri"
              data-testid="portfolio-mobile-tabpanel-galeri"
              className="space-y-3"
            >
              <div
                data-testid="portfolio-mobile-collage"
                aria-label={`Kolase galeri ${project.judul}`}
                className="grid grid-cols-2 gap-2.5"
              >
                {slides.map((slide, idx) => {
                  const isLead = idx === 0;
                  const remainingCount = slides.length - 1;
                  const isTrailingOdd =
                    !isLead && idx === slides.length - 1 && remainingCount % 2 === 1;
                  const spanClass =
                    isLead || isTrailingOdd
                      ? 'col-span-2 aspect-[4/3]'
                      : 'col-span-1 aspect-[4/5]';
                  const isActive = idx === activeGallerySlide;

                  return (
                    <button
                      key={slide.id}
                      type="button"
                      data-testid="portfolio-mobile-collage-item"
                      aria-label={`Tampilkan ${slide.title}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setGallerySlideRequest((prev) => ({
                          index: idx,
                          token: (prev?.token ?? 0) + 1,
                        }));
                        const scrollRegion = document.getElementById('app-scroll-container');
                        if (scrollRegion) {
                          scrollRegion.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={[
                        'group relative w-full overflow-hidden rounded-[var(--radius-md)] border bg-[var(--surface-muted)] text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
                        spanClass,
                        isActive
                          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                          : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                      ].join(' ')}
                    >
                      {slide.kind === 'video' ? (
                        <div className="relative size-full">
                          <ImageFallback
                            src={slide.poster ?? null}
                            alt={slide.title}
                            aspectRatio="auto"
                            fallbackLabel={slide.title}
                            className="size-full rounded-none border-0"
                            imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 flex items-center justify-center bg-black/25"
                          >
                            <span className="inline-flex items-center justify-center size-10 rounded-full bg-white/95 text-black shadow-md">
                              <Play className="size-4 fill-current ml-0.5" aria-hidden="true" />
                            </span>
                          </span>
                        </div>
                      ) : (
                        <ImageFallback
                          src={slide.src}
                          alt={slide.title}
                          aspectRatio="auto"
                          fallbackLabel={slide.fallbackLabel ?? slide.title}
                          className="size-full rounded-none border-0"
                          imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
              </div>
            </div>
          );
        })()}

        {/* Desktop Content Layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="space-y-1">
                  <p
                    data-testid="portfolio-detail-desktop-eyebrow"
                    className="text-xs font-medium text-[var(--text)] tabular-nums"
                  >
                    {headerEyebrow}
                  </p>
                  <h1
                    data-testid="portfolio-detail-desktop-title"
                    className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] leading-tight"
                  >
                    {project.judul}
                  </h1>
                </div>

                <p
                  data-testid="portfolio-detail-description"
                  className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                >
                  {project.deskripsi}
                </p>
              </div>

              <PortfolioTechnicalSpecs project={project} />

              <div
                data-testid="portfolio-detail-challenge-solution-section"
                className="space-y-6 pt-1"
              >
                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">Tantangan Ruang</h2>
                  <p
                    data-testid="portfolio-detail-challenge"
                    className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                  >
                    {project.tantangan}
                  </p>
                </section>
                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">Solusi &amp; Eksekusi</h2>
                  <p
                    data-testid="portfolio-detail-solution"
                    className={PORTFOLIO_JUSTIFIED_BODY_TEXT_CLASS}
                  >
                    {project.solusi}
                  </p>
                </section>
              </div>
            </div>

            <div className="col-span-5 space-y-5">
              {formattedReferencePrice && (
                <PortfolioPriceCard formattedReferencePrice={formattedReferencePrice} />
              )}

              <section
                aria-label="Konsultasi konsep proyek"
                data-testid="portfolio-detail-cta"
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5"
              >
                {hasVisiblePortfolioReview(project) && project.ulasan && (
                  <div
                    data-testid="portfolio-detail-desktop-review"
                    aria-label="Ulasan klien proyek"
                  >
                    <PortfolioReviewContent
                      klien={project.ulasan.klien}
                      lokasi={project.lokasi}
                      tahun={project.tahun}
                      penilaian={project.ulasan.penilaian}
                      komentar={project.ulasan.komentar}
                      testIdPrefix="portfolio-detail-desktop-review"
                      isCollapsible
                      isExpanded={isDesktopReviewOpen}
                      onToggleExpand={() => setIsDesktopReviewOpen((prev) => !prev)}
                      panelId="portfolio-detail-desktop-review-panel"
                    />
                  </div>
                )}

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-[var(--text)]">
                      Tertarik Konsep Penataan Ruang Serupa?
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Sesuaikan ukuran, tata letak, dan pilihan material dengan kondisi ruangan Anda
                      bersama tim workshop {businessConfig.namaMerek}.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {matchedProduct && (
                        <LinkButton
                          to={`/produk/${encodeURIComponent(getProductSlug(matchedProduct))}`}
                          variant="secondary"
                          size="md"
                          fullWidth
                        >
                          Lihat di Katalog
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </LinkButton>
                      )}
                      <LinkButton
                        to="/produk/custom"
                        variant="secondary"
                        size="md"
                        fullWidth
                        className={matchedProduct ? '' : 'lg:col-span-2'}
                      >
                        Rancang Custom
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </LinkButton>
                    </div>
                    <ExternalLinkButton
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="primary"
                      size="md"
                      fullWidth
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      Konsultasikan Konsep Serupa
                    </ExternalLinkButton>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </article>

      {relatedProjects.length > 0 && (
        <section
          aria-labelledby="related-portfolio-heading"
          className="w-full space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="related-portfolio-heading" className="text-lg font-semibold text-[var(--text)]">
              Portofolio Proyek Lainnya
            </h2>
            <Link
              to="/portofolio"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
            >
              Semua Portofolio
            </Link>
          </div>

          <div
            data-testid="portfolio-related-grid"
            className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6"
          >
            {relatedProjects.map((item) => (
              <PortfolioCard
                key={item.id}
                project={item}
                activeProducts={activeProducts}
                titleAs="h3"
                testId="portfolio-related-card"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

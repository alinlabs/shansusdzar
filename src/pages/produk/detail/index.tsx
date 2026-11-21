import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Headset,
  Image as ImageIcon,
  Layers,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button, ExternalLinkButton, LinkButton } from '../../../components/ui/button';
import { Input } from '../../../components/ui/form-controls';
import { ImageFallback } from '../../../components/ui/image-fallback';
import { ProductCard } from '../../../components/ui/product-card';
import { useDocumentTitle, useJsonLdSchema } from '../../../hooks/use-document-title';
import {
  calculateCatalogVariantPrice,
  calculateDiscountPercent,
  findFinishOptionGroup,
  findMaterialOptionGroup,
  getDefaultProductDimensionsCm,
  parseDimensionPresetDimensions,
} from '../../../lib/catalog-pricing';
import {
  CUSTOM_SERVICE_MODES,
  getCustomServiceModeLabel,
  isBuildIncluded,
} from '../../../lib/custom-pricing';
import { formatCurrencyIDR } from '../../../lib/price-format';
import { buildProductJsonLd } from '../../../lib/seo-schema';
import { useCartStore } from '../../../store/cart-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../../store/site-content-store';
import type { CustomServiceMode } from '../../../types/cart';
import type { ProductItem } from '../../../types/product';
import {
  buildProductDetailWhatsAppMessage,
  buildProductVisualSlides,
  getRelatedProducts,
  resolveVideoSource,
} from './detail-logic';

const CUSTOM_DIMENSION_KEY = '__custom__';

export default function KatalogDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogLoadStatus = useSiteContentStore((state) => state.catalogLoadStatus);
  const catalogError = useSiteContentStore((state) => state.catalogError);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  const addProductItem = useCartStore((state) => state.addProductItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const products = activeCatalog?.daftarProduk ?? [];

  const product = useMemo<ProductItem | null>(() => {
    if (!slug || products.length === 0) return null;
    return products.find((item) => item.slug === slug) ?? null;
  }, [products, slug]);

  const slides = useMemo(
    () => (product ? buildProductVisualSlides(product, businessConfig.namaMerekSingkat) : []),
    [product, businessConfig.namaMerekSingkat]
  );

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [serviceMode, setServiceMode] = useState<CustomServiceMode>('build-only');
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedDimensionRef, setSelectedDimensionRef] = useState<string | null>(null);
  const [customLengthCm, setCustomLengthCm] = useState<string>('200');
  const [customWidthCm, setCustomWidthCm] = useState<string>('150');
  const [quantity, setQuantity] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const miniStripRef = useRef<HTMLDivElement>(null);
  const stagePointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const miniStripDragRef = useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(
    null
  );
  const suppressMiniClickRef = useRef(false);

  useEffect(() => {
    if (!product) return;
    setActiveSlideIndex(0);
    setIsVideoPlaying(false);
    setServiceMode('build-only');
    setSelectedColorId(product.pilihanWarna[0]?.id ?? null);
    const initialOpts: Record<string, string> = {};
    for (const opt of product.opsiKustom) {
      if (opt.daftarNilai.length > 0) {
        initialOpts[opt.label] = opt.daftarNilai[0];
      }
    }
    setSelectedOptions(initialOpts);
    const firstPreset = product.dimensi.referensiUkuran?.[0] ?? null;
    const defaultDims = getDefaultProductDimensionsCm(product);
    setSelectedDimensionRef(firstPreset ?? CUSTOM_DIMENSION_KEY);
    setCustomLengthCm(String(defaultDims.lengthCm));
    setCustomWidthCm(String(defaultDims.widthCm));
    setQuantity(1);
  }, [product?.id]);

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  useDocumentTitle(
    product
      ? `${product.nama} · Produk | ${businessConfig.namaMerekSingkat}`
      : `Detail Produk | ${businessConfig.namaMerekSingkat}`,
    product
      ? product.deskripsiSingkat
      : 'Detail produk furniture dan penataan interior custom Shansus Dzar Indonesia.',
    product
      ? {
          ogType: 'website',
          ogImage: product.daftarGambar[0],
          keywords: [product.nama, product.kategori, ...product.daftarMaterial],
        }
      : undefined
  );

  const productSchema = useMemo(
    () => (product ? buildProductJsonLd(product, businessConfig, originUrl) : null),
    [product, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-product-detail-schema', productSchema);

  const isLoading = !activeCatalog && (catalogLoadStatus === 'idle' || catalogLoadStatus === 'loading');
  const isError = !activeCatalog && catalogLoadStatus === 'error';

  if (isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Memuat detail produk">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 aspect-[4/3] lg:aspect-video rounded-[var(--radius-lg)] bg-[var(--surface-muted)] border border-[var(--border)]" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
            <div className="h-9 w-3/4 rounded bg-[var(--surface-muted)]" />
            <div className="h-20 w-full rounded bg-[var(--surface-muted)]" />
            <div className="h-12 w-full rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="max-w-xl mx-auto my-8 p-6 border border-[var(--danger-border)] bg-[var(--danger-surface)] rounded-[var(--radius-md)] space-y-4"
      >
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-[var(--danger)]">
            Data Produk Tidak Dapat Dimuat
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {catalogError || 'Periksa berkas public/produk/produk.json atau coba muat ulang.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => void ensureBaseCatalogLoaded(true)}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Coba Lagi
          </Button>
          <LinkButton to="/produk" variant="ghost" size="sm">
            Kembali ke Produk
          </LinkButton>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Produk Furniture
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
          Produk Tidak Ditemukan
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Unit produk yang Anda cari mungkin telah diperbarui alamatnya atau Anda dapat merancang
          kebutuhan ruangan secara langsung di kalkulator Custom Interior.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <LinkButton to="/produk" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Produk
          </LinkButton>
          <LinkButton to="/produk/custom" variant="secondary" size="md">
            Buka Custom Interior
            <ArrowRight className="size-4" aria-hidden="true" />
          </LinkButton>
        </div>
      </div>
    );
  }

  const selectedColor =
    product.pilihanWarna.find((c) => c.id === selectedColorId) ?? product.pilihanWarna[0] ?? null;

  const dimensionPresets = product.dimensi.referensiUkuran ?? [];
  const isCustomDimensionMode =
    selectedDimensionRef === CUSTOM_DIMENSION_KEY || dimensionPresets.length === 0;

  const defaultDimensions = getDefaultProductDimensionsCm(product);
  const parsedPreset = !isCustomDimensionMode
    ? parseDimensionPresetDimensions(selectedDimensionRef)
    : null;

  const rawCustomLen = Number(customLengthCm.replace(',', '.'));
  const rawCustomWid = Number(customWidthCm.replace(',', '.'));
  const validCustomLen =
    Number.isFinite(rawCustomLen) && rawCustomLen >= 20
      ? Math.min(3000, Math.round(rawCustomLen))
      : defaultDimensions.lengthCm;
  const validCustomWid =
    Number.isFinite(rawCustomWid) && rawCustomWid >= 20
      ? Math.min(3000, Math.round(rawCustomWid))
      : defaultDimensions.widthCm;

  const activeLengthCm = parsedPreset?.lengthCm ?? validCustomLen;
  const activeWidthCm = parsedPreset?.widthCm ?? validCustomWid;
  const activeAreaSqm = Math.max(
    0.05,
    Math.round((activeLengthCm / 100) * (activeWidthCm / 100) * 100) / 100
  );

  const dimensionLabelText = isCustomDimensionMode
    ? `Custom ${activeLengthCm}×${activeWidthCm} cm (${activeAreaSqm} m²)`
    : `${selectedDimensionRef} (${activeAreaSqm} m²)`;

  const materialGroup = findMaterialOptionGroup(product);
  const finishGroup = findFinishOptionGroup(product);
  const selectedMaterialLabel = materialGroup
    ? selectedOptions[materialGroup.label] ?? materialGroup.daftarNilai[0]
    : null;
  const selectedFinishLabel = finishGroup
    ? selectedOptions[finishGroup.label] ?? finishGroup.daftarNilai[0]
    : null;

  const variantPrice = calculateCatalogVariantPrice({
    product,
    serviceMode,
    areaSqm: activeAreaSqm,
    materialLabel: selectedMaterialLabel,
    finishLabel: selectedFinishLabel,
    siteCustomPricing: customPricing,
  });

  const totalPrice = variantPrice.unitPrice * quantity;
  const formattedDisplayPrice =
    formatCurrencyIDR(totalPrice) ?? `Rp ${totalPrice}`;
  const formattedCompareAtDisplayPrice =
    variantPrice.promoActive && variantPrice.compareAtUnitPrice !== null
      ? (formatCurrencyIDR(variantPrice.compareAtUnitPrice * quantity) ??
          `Rp ${variantPrice.compareAtUnitPrice * quantity}`)
      : null;
  const discountPercent = variantPrice.promoActive
    ? calculateDiscountPercent(variantPrice.unitPrice, variantPrice.compareAtUnitPrice)
    : null;
  const formattedUnitPriceForInquiry =
    formatCurrencyIDR(variantPrice.unitPrice) ?? `Rp ${variantPrice.unitPrice}`;
  const serviceModeLabel = getCustomServiceModeLabel(serviceMode);
  const buildIncluded = isBuildIncluded(serviceMode);

  const areaPrefix = quantity > 1 ? `${quantity} unit × ${activeAreaSqm} m²` : `${activeAreaSqm} m²`;
  const priceBreakdownSummary = buildIncluded
    ? `${areaPrefix} · ${serviceModeLabel}${
        selectedMaterialLabel && selectedFinishLabel
          ? ` · ${selectedMaterialLabel} + ${selectedFinishLabel}`
          : ''
      }`
    : `${areaPrefix} · ${serviceModeLabel} · Jasa desain 3D & gambar kerja`;

  const relatedProducts = getRelatedProducts(product, products, 4);

  const clampedSlideIndex = slides.length > 0 ? Math.min(activeSlideIndex, slides.length - 1) : 0;
  const activeSlide = slides[clampedSlideIndex] ?? null;

  const schematicRatio = Math.max(0.55, Math.min(2.2, activeLengthCm / Math.max(1, activeWidthCm)));
  const boxWidth = schematicRatio >= 1 ? 220 : Math.round(220 * schematicRatio);
  const boxHeight = schematicRatio >= 1 ? Math.round(220 / schematicRatio) : 220;
  const boxX = Math.round((360 - boxWidth) / 2);
  const boxY = Math.round((230 - boxHeight) / 2);

  const handleSelectPresetDimension = (preset: string) => {
    setSelectedDimensionRef(preset);
    const parsed = parseDimensionPresetDimensions(preset);
    if (parsed) {
      setCustomLengthCm(String(parsed.lengthCm));
      setCustomWidthCm(String(parsed.widthCm));
    }
  };

  const handleEnableCustomDimension = () => {
    setCustomLengthCm(String(activeLengthCm));
    setCustomWidthCm(String(activeWidthCm));
    setSelectedDimensionRef(CUSTOM_DIMENSION_KEY);
  };

  const handleAddToCart = () => {
    const optionsPayload: Record<string, string> = {
      Layanan: serviceModeLabel,
      Ukuran: dimensionLabelText,
      ...selectedOptions,
    };

    addProductItem({
      productId: product.id,
      slug: product.slug,
      name: product.nama,
      category: product.kategori,
      image: product.daftarGambar[0] ?? null,
      selectedColorName: selectedColor?.nama ?? null,
      selectedColorHex: selectedColor?.hex ?? null,
      selectedOptions: optionsPayload,
      quantity,
      unitPrice: variantPrice.unitPrice,
      priceStatus: 'tetap',
    });
    openDrawer();
  };

  const whatsappInquiry = buildDynamicWhatsAppUrl(
    businessConfig,
    buildProductDetailWhatsAppMessage({
      brandName: businessConfig.namaMerek,
      productName: product.nama,
      category: product.kategori,
      serviceModeLabel,
      priceLabel: `${formattedUnitPriceForInquiry}/unit (${priceBreakdownSummary})`,
      selectedColorName: selectedColor?.nama ?? null,
      selectedOptions,
      quantity,
      selectedDimensionRef: dimensionLabelText,
    })
  );

  const goToSlide = (nextIndex: number) => {
    if (slides.length === 0) return;
    const wrapped = (nextIndex + slides.length) % slides.length;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    setIsVideoPlaying(false);
    setActiveSlideIndex(wrapped);

    const container = miniStripRef.current;
    const thumb = container?.children.item(wrapped) as HTMLElement | null;
    if (container && thumb) {
      const targetLeft = thumb.offsetLeft - container.clientWidth / 2 + thumb.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  };

  const toggleVideoPlayback = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const renderVideoSlide = (videoSrc: string, posterSrc?: string, title?: string) => {
    const resolved = resolveVideoSource(videoSrc);
    if (resolved.kind === 'embed') {
      const embedUrl = resolved.src.includes('youtube.com/embed/')
        ? `${resolved.src}${resolved.src.includes('?') ? '&' : '?'}controls=0&modestbranding=1&rel=0`
        : resolved.src;
      return (
        <iframe
          src={embedUrl}
          title={title || `Video ${product.nama}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="size-full border-0"
        />
      );
    }

    if (resolved.kind === 'native') {
      return (
        <div className="relative size-full bg-black">
          <video
            ref={videoRef}
            key={resolved.src}
            src={resolved.src}
            poster={posterSrc}
            playsInline
            preload="metadata"
            loop
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            onEnded={() => setIsVideoPlaying(false)}
            onClick={(e) => {
              e.stopPropagation();
              toggleVideoPlayback();
            }}
            aria-label={title || `Video ${product.nama}`}
            className="size-full object-cover cursor-pointer"
          />
          {!isVideoPlaying && (
            <button
              type="button"
              aria-label={`Putar ${title || product.nama}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleVideoPlayback();
              }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center justify-center size-14 sm:size-16 rounded-full bg-white/95 text-black shadow-lg transition-transform hover:scale-105">
                <Play className="size-6 fill-current ml-0.5" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-12 sm:space-y-14">
      {/* Main Split: Left 4:3 Visual Stage + Info & Right E-commerce Variant Configurator */}
      <section
        aria-labelledby="product-detail-title"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
      >
        {/* Left: 4:3 Visual Stage + Product Title, Description & Promo/Current Price */}
        <div className="lg:col-span-7 space-y-3">
          <div
            role="region"
            aria-label={`Galeri visual ${product.nama}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goToSlide(clampedSlideIndex - 1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goToSlide(clampedSlideIndex + 1);
              }
            }}
            onPointerDown={(e) => {
              stagePointerStartRef.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              const start = stagePointerStartRef.current;
              stagePointerStartRef.current = null;
              if (!start || slides.length <= 1) return;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                goToSlide(dx < 0 ? clampedSlideIndex + 1 : clampedSlideIndex - 1);
              }
            }}
            className="group/stage relative aspect-[4/3] lg:aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            {activeSlide?.kind === 'video' &&
              renderVideoSlide(activeSlide.src, activeSlide.poster, activeSlide.title)}

            {activeSlide?.kind === 'image' && (
              <ImageFallback
                src={activeSlide.src}
                alt={activeSlide.title}
                aspectRatio="auto"
                eager
                fallbackLabel={product.nama}
                className="size-full rounded-none border-0"
              />
            )}

            {activeSlide?.kind === 'schematic' && (
              <div className="size-full flex flex-col items-center justify-center bg-[var(--surface)] p-5 sm:p-8">
                <svg
                  viewBox="0 0 360 250"
                  className="w-full max-w-[360px] max-h-full h-auto"
                  role="img"
                  aria-label={`Skema proporsi untuk ${product.nama} ukuran ${activeLengthCm}×${activeWidthCm} cm dengan warna ${selectedColor?.nama ?? 'standar'}`}
                >
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    fill="var(--bg)"
                    stroke="var(--border-strong)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                  <rect
                    x={boxX + 16}
                    y={boxY + 16}
                    width={Math.max(40, Math.round(boxWidth * 0.62))}
                    height={Math.max(28, Math.round(boxHeight * 0.42))}
                    rx="3"
                    fill={selectedColor?.hex ?? '#D8CFC2'}
                    stroke="var(--border-strong)"
                    strokeWidth="1.2"
                  />
                  <text
                    x="180"
                    y={boxY + boxHeight + 22}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="11"
                  >
                    {`${activeLengthCm} × ${activeWidthCm} cm (${activeAreaSqm} m²)`}
                  </text>
                </svg>
              </div>
            )}

            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Slide visual sebelumnya"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(clampedSlideIndex - 1);
                  }}
                  className="hidden sm:inline-flex items-center justify-center size-9 rounded-full bg-black/55 hover:bg-black/75 text-white absolute left-3 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Slide visual berikutnya"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(clampedSlideIndex + 1);
                  }}
                  className="hidden sm:inline-flex items-center justify-center size-9 rounded-full bg-black/55 hover:bg-black/75 text-white absolute right-3 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </>
            )}

            {slides.length > 1 && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 z-20 px-3 pb-2.5 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent opacity-100 sm:opacity-0 sm:translate-y-1.5 sm:group-hover/stage:opacity-100 sm:group-hover/stage:translate-y-0 sm:group-focus-within/stage:opacity-100 sm:group-focus-within/stage:translate-y-0 transition-all duration-200 pointer-events-auto sm:pointer-events-none sm:group-hover/stage:pointer-events-auto sm:group-focus-within/stage:pointer-events-auto"
              >
                <div
                  ref={miniStripRef}
                  role="group"
                  aria-label="Mini galeri visual produk"
                  onPointerDown={(e) => {
                    const container = miniStripRef.current;
                    if (!container) return;
                    miniStripDragRef.current = {
                      startX: e.clientX,
                      scrollLeft: container.scrollLeft,
                      moved: false,
                    };
                  }}
                  onPointerMove={(e) => {
                    const drag = miniStripDragRef.current;
                    const container = miniStripRef.current;
                    if (!drag || !container) return;
                    const dx = e.clientX - drag.startX;
                    if (Math.abs(dx) > 6) {
                      drag.moved = true;
                      container.scrollLeft = drag.scrollLeft - dx;
                    }
                  }}
                  onPointerUp={() => {
                    if (miniStripDragRef.current?.moved) {
                      suppressMiniClickRef.current = true;
                      window.setTimeout(() => {
                        suppressMiniClickRef.current = false;
                      }, 80);
                    }
                    miniStripDragRef.current = null;
                  }}
                  onPointerCancel={() => {
                    miniStripDragRef.current = null;
                  }}
                  className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5"
                >
                  {slides.map((slide, idx) => {
                    const isSelected = idx === clampedSlideIndex;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        aria-label={slide.title}
                        aria-pressed={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressMiniClickRef.current) return;
                          goToSlide(idx);
                        }}
                        className={[
                          'relative w-12 sm:w-14 lg:w-16 aspect-[4/3] lg:aspect-video shrink-0 snap-start overflow-hidden rounded-[var(--radius-sm)] border transition-all cursor-pointer bg-[var(--surface)]',
                          isSelected
                            ? 'border-white ring-1 ring-white/80 opacity-100 scale-[1.03]'
                            : 'border-white/35 opacity-75 hover:opacity-100',
                        ].join(' ')}
                      >
                        {slide.kind === 'video' && (
                          <div className="relative size-full flex items-center justify-center bg-black text-white">
                            {slide.poster && (
                              <img
                                src={slide.poster}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 size-full object-cover opacity-70"
                              />
                            )}
                            <span className="relative z-10 inline-flex items-center justify-center size-5 rounded-full bg-white/95 text-black">
                              <Play className="size-2.5 fill-current ml-0.5" aria-hidden="true" />
                            </span>
                          </div>
                        )}

                        {slide.kind === 'image' && (
                          slide.src ? (
                            <img
                              src={slide.src}
                              alt=""
                              draggable={false}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center bg-[var(--surface-muted)] text-[var(--text-muted)]">
                              <ImageIcon className="size-3.5" aria-hidden="true" />
                            </div>
                          )
                        )}

                        {slide.kind === 'schematic' && (
                          <div className="size-full flex items-center justify-center bg-[var(--surface)] text-[var(--text-muted)]">
                            <Layers className="size-3.5" aria-hidden="true" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Product Category, Title, Description, then Desktop-only Red Gradient Promo Price Card */}
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">{product.kategori}</p>
            <h1
              id="product-detail-title"
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] leading-tight"
            >
              {product.nama}
            </h1>

            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {product.deskripsiSingkat}
            </p>

            <div
              data-testid="detail-price-card"
              className="pt-2 lg:mt-2 lg:rounded-[var(--radius-lg)] lg:bg-gradient-to-r lg:from-[#7f1d1d] lg:via-[#b91c1c] lg:to-[#dc2626] lg:px-5 lg:py-4 lg:border lg:border-red-400/25 lg:shadow-[0_12px_28px_-10px_rgba(185,28,28,0.5)]"
            >
              <div className="flex items-center justify-between gap-4">
                {discountPercent !== null ? (
                  <p
                    data-testid="detail-discount-label"
                    className="hidden lg:block text-lg font-bold tracking-tight text-white tabular-nums"
                  >
                    {`Hemat ${discountPercent}%`}
                  </p>
                ) : (
                  <span aria-hidden="true" className="hidden lg:block" />
                )}

                <div className="flex-1 lg:flex-initial flex items-baseline justify-between gap-3 lg:flex-col lg:items-end lg:gap-0.5 lg:text-right">
                  {formattedCompareAtDisplayPrice ? (
                    <p
                      data-testid="detail-compare-price"
                      className="text-sm lg:text-xs font-light text-[var(--text-muted)] lg:text-white/80 line-through decoration-[1px] tabular-nums"
                    >
                      {formattedCompareAtDisplayPrice}
                    </p>
                  ) : (
                    <span aria-hidden="true" className="lg:hidden" />
                  )}
                  <p
                    data-testid="detail-live-price"
                    className="text-xl lg:text-2xl font-extrabold text-[var(--text)] lg:text-white tabular-nums leading-tight ml-auto lg:ml-0"
                  >
                    {formattedDisplayPrice}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: E-commerce Variation Configurator & Actions (clean, no divider lines, no nominal prices) */}
        <div
          data-testid="detail-right-configurator"
          className="lg:col-span-5 space-y-5"
        >
          {/* 1. Service Mode: Desain Saja / Build Saja / Desain + Build */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Layanan</p>
            <div
              role="radiogroup"
              aria-label="Pilihan layanan custom"
              className="grid grid-cols-3 gap-2"
            >
              {CUSTOM_SERVICE_MODES.map((mode) => {
                const isSelected = serviceMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setServiceMode(mode.id)}
                    className={[
                      'min-h-10 px-2.5 py-2 rounded-[var(--radius-md)] border text-xs transition-colors whitespace-nowrap cursor-pointer',
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-medium'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
                    ].join(' ')}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Size Selection (Custom on left + Presets) */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Ukuran</p>

            <div
              role="radiogroup"
              aria-label="Pilihan ukuran produk"
              className="flex flex-wrap gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={isCustomDimensionMode}
                onClick={handleEnableCustomDimension}
                className={[
                  'min-h-10 px-3.5 py-2 rounded-[var(--radius-md)] border text-xs transition-colors whitespace-nowrap cursor-pointer',
                  isCustomDimensionMode
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-medium'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
                ].join(' ')}
              >
                Custom
              </button>

              {dimensionPresets.map((preset) => {
                const isSelected = !isCustomDimensionMode && preset === selectedDimensionRef;
                return (
                  <button
                    key={preset}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectPresetDimension(preset)}
                    className={[
                      'min-h-10 px-3.5 py-2 rounded-[var(--radius-md)] border text-xs tabular-nums transition-colors whitespace-nowrap cursor-pointer',
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-medium'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
                    ].join(' ')}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            {isCustomDimensionMode && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label
                    htmlFor="detail-custom-length"
                    className="block text-[11px] font-medium text-[var(--text-muted)]"
                  >
                    Panjang (cm)
                  </label>
                  <Input
                    id="detail-custom-length"
                    type="number"
                    min={20}
                    max={3000}
                    step={5}
                    value={customLengthCm}
                    onChange={(e) => setCustomLengthCm(e.target.value)}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="detail-custom-width"
                    className="block text-[11px] font-medium text-[var(--text-muted)]"
                  >
                    Lebar (cm)
                  </label>
                  <Input
                    id="detail-custom-width"
                    type="number"
                    min={20}
                    max={3000}
                    step={5}
                    value={customWidthCm}
                    onChange={(e) => setCustomWidthCm(e.target.value)}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Color Swatches */}
          {product.pilihanWarna.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Pilihan Warna</p>
              <div
                role="radiogroup"
                aria-label="Pilihan warna produk"
                className="flex flex-wrap gap-2"
              >
                {product.pilihanWarna.map((color) => {
                  const isSelected = color.id === selectedColor?.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={color.nama}
                      onClick={() => setSelectedColorId(color.id)}
                      className={[
                        'inline-flex items-center gap-2 min-h-10 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs transition-colors cursor-pointer',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-muted)] font-medium text-[var(--text)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]',
                      ].join(' ')}
                    >
                      <span
                        className="size-4 rounded-full border border-[var(--border-strong)] shrink-0"
                        style={{ backgroundColor: color.hex }}
                        aria-hidden="true"
                      />
                      <span className="whitespace-nowrap">{color.nama}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Custom Options (Layout, Base Material, Finishing) */}
          {product.opsiKustom.map((option) => {
            const currentValue = selectedOptions[option.label] ?? option.daftarNilai[0];

            return (
              <div key={option.id} className="space-y-2.5">
                <p className="text-xs font-medium text-[var(--text-muted)]">{option.label}</p>
                <div
                  role="radiogroup"
                  aria-label={option.label}
                  className="flex flex-wrap gap-2"
                >
                  {option.daftarNilai.map((val) => {
                    const isSelected = val === currentValue;
                    return (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [option.label]: val,
                          }))
                        }
                        className={[
                          'min-h-10 px-3.5 py-2 rounded-[var(--radius-md)] border text-xs transition-colors whitespace-nowrap cursor-pointer',
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-medium'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
                        ].join(' ')}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 5. Primary Purchase Actions */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2.5">
              <div className="w-28 sm:w-32 shrink-0 inline-flex items-center justify-between border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)]">
                <button
                  type="button"
                  aria-label="Kurangi jumlah produk"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="inline-flex items-center justify-center w-9 sm:w-10 h-11 shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span
                  aria-label={`Jumlah unit: ${quantity}`}
                  className="flex-1 text-center text-sm font-medium tabular-nums text-[var(--text)]"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah produk"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="inline-flex items-center justify-center w-9 sm:w-10 h-11 shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-r-[var(--radius-md)] cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                className="flex-1 min-w-[205px] px-4 sm:px-5 whitespace-nowrap"
              >
                <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
                <span>Tambah ke Keranjang</span>
              </Button>
            </div>

            <ExternalLinkButton
              href={whatsappInquiry}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="md"
              className="w-full"
            >
              <Headset className="size-4 shrink-0" aria-hidden="true" />
              <span>Tanya via WhatsApp</span>
            </ExternalLinkButton>
          </div>
        </div>
      </section>

      {/* Related Catalog Products */}
      {relatedProducts.length > 0 && (
        <section
          aria-labelledby="related-products-heading"
          className="pt-8 border-t border-[var(--border)] space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="related-products-heading" className="text-lg font-semibold text-[var(--text)]">
              Produk Terkait
            </h2>
            <Link
              to="/produk"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
            >
              Semua Produk →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

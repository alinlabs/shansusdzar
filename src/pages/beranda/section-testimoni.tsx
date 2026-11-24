import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeading } from '../../components/ui/section-heading';
import { deriveReviewsFromPortfolio } from '../../lib/portfolio-filter';
import { useSiteContentStore } from '../../store/site-content-store';
import type { ClientReviewData } from '../../types/cms';
import { SlideIndicators } from './slide-indicators';
import { getVisibleCarouselWindow } from './utils';

const AUTO_SLIDE_INTERVAL_MS = 4000;
const DESKTOP_VISIBLE_CARDS = 3;
const DRAG_THRESHOLD_PX = 6;

function ReviewCard({
  review,
  isHiddenClone,
}: {
  review: ClientReviewData;
  isHiddenClone?: boolean;
}) {
  const projectHref = review.projectSlug ? `/portofolio/${review.projectSlug}` : '/portofolio';
  const cardClassName = [
    'review-carousel-card group p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] flex flex-col justify-between gap-5 select-none transition-colors',
    !isHiddenClone ? 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40' : '',
  ].join(' ');

  const inner = (
    <>
      <div className="space-y-4">
        <div
          className="flex items-center justify-between gap-2"
          aria-label={`Penilaian ${review.penilaian} dari 5 bintang`}
        >
          <div className="inline-flex items-center gap-1 text-[#b8862d] dark:text-[#d6a954]">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={
                  star <= review.penilaian
                    ? 'size-4 fill-current'
                    : 'size-4 text-[var(--border-strong)]'
                }
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="inline-flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
              {review.penilaian.toFixed(1)}
            </span>
            <ArrowUpRight
              className="size-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          data-testid="home-review-quote-card"
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3.5 py-3"
        >
          <blockquote className="text-sm text-[var(--text)] leading-relaxed line-clamp-3">
            {review.komentar}
          </blockquote>
        </div>
      </div>

      <figcaption className="pt-4 border-t border-[var(--border)] space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="size-9 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0"
            aria-hidden="true"
          >
            {review.inisial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)] truncate">{review.namaKlien}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {review.projectLocation || review.projectCategory || review.konteksProyek}
            </p>
          </div>
        </div>

        {review.projectTitle && (
          <div className="pt-2.5 border-t border-dashed border-[var(--border)] text-xs">
            <p className="text-[var(--text-muted)] truncate">
              Proyek: <span className="font-medium text-[var(--text)]">{review.projectTitle}</span>
            </p>
          </div>
        )}
      </figcaption>
    </>
  );

  if (isHiddenClone) {
    return (
      <figure aria-hidden="true" className={cardClassName}>
        {inner}
      </figure>
    );
  }

  return (
    <Link
      to={projectHref}
      draggable={false}
      aria-label={`Ulasan dari ${review.namaKlien} — Lihat proyek ${review.projectTitle || 'portofolio'}`}
      className={cardClassName}
    >
      {inner}
    </Link>
  );
}

export function SectionTestimoni() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const reviews = useMemo(
    () => deriveReviewsFromPortfolio(portfolioProjects),
    [portfolioProjects]
  );
  const totalItems = reviews.length;
  const trackItems =
    totalItems > 0
      ? [...reviews, ...reviews.slice(0, Math.min(DESKTOP_VISIBLE_CARDS, totalItems))]
      : [];

  const [trackIndex, setTrackIndex] = useState(0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressClickUntilRef = useRef(0);
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    width: number;
    hasDragged: boolean;
    captureActive: boolean;
  } | null>(null);

  useEffect(() => {
    if (trackIndex >= totalItems && totalItems > 0) {
      setIsTransitionEnabled(false);
      setTrackIndex(0);
    }
  }, [totalItems, trackIndex]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const handleNext = useCallback(() => {
    setIsTransitionEnabled(true);
    setTrackIndex((prev) => (prev >= totalItems ? 1 : prev + 1));
  }, [totalItems]);

  const handlePrev = useCallback(() => {
    if (trackIndex === 0) {
      setIsTransitionEnabled(false);
      setTrackIndex(totalItems);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsTransitionEnabled(true);
          setTrackIndex(totalItems - 1);
        });
      });
      return;
    }

    setIsTransitionEnabled(true);
    setTrackIndex((prev) => prev - 1);
  }, [trackIndex, totalItems]);

  const handleSelectDot = useCallback((index: number) => {
    setIsTransitionEnabled(true);
    setTrackIndex(index);
  }, []);

  useEffect(() => {
    if (isPaused || isDragging || prefersReducedMotion || totalItems <= 1) return;
    const timer = window.setInterval(() => {
      handleNext();
    }, AUTO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, isDragging, prefersReducedMotion, totalItems, handleNext]);

  const finishPointerDrag = useCallback(
    (deltaX: number, containerWidth: number) => {
      const threshold = Math.min(72, Math.max(36, containerWidth * 0.14));
      setIsDragging(false);
      setDragOffsetPx(0);
      setIsPaused(false);
      pointerStateRef.current = null;

      if (deltaX <= -threshold) {
        handleNext();
      } else if (deltaX >= threshold) {
        handlePrev();
      } else {
        setIsTransitionEnabled(true);
      }
    },
    [handleNext, handlePrev]
  );

  const activeLogicalIndex = totalItems > 0 ? trackIndex % totalItems : 0;
  const visibleDesktopIds = getVisibleCarouselWindow(
    reviews,
    activeLogicalIndex,
    DESKTOP_VISIBLE_CARDS
  )
    .map((item) => item.id)
    .join(',');

  if (totalItems === 0) return null;

  return (
    <section aria-labelledby="testimoni-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="testimoni-heading"
        align="center"
        eyebrow={beranda.labelTestimoni}
        title={beranda.judulTestimoni}
      />

      <div
        ref={carouselRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Daftar ulasan klien"
        data-active-slide={activeLogicalIndex}
        data-visible-desktop-ids={visibleDesktopIds}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          if (!pointerStateRef.current) setIsPaused(false);
        }}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={(event) => {
          if (!carouselRef.current?.contains(event.relatedTarget as Node | null)) {
            setIsPaused(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            handleNext();
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            handlePrev();
          }
        }}
        className="space-y-2"
      >
        <div
          ref={viewportRef}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => {
            if (Date.now() < suppressClickUntilRef.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const width = viewportRef.current?.getBoundingClientRect().width || 320;
            pointerStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              width,
              hasDragged: false,
              captureActive: false,
            };
            setIsPaused(true);
            setDragOffsetPx(0);
          }}
          onPointerMove={(event) => {
            const activeDrag = pointerStateRef.current;
            if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
            const deltaX = event.clientX - activeDrag.startX;
            if (!activeDrag.hasDragged) {
              if (Math.abs(deltaX) <= DRAG_THRESHOLD_PX) return;
              activeDrag.hasDragged = true;
              setIsDragging(true);
              setIsTransitionEnabled(false);
              if (event.currentTarget.setPointerCapture) {
                event.currentTarget.setPointerCapture(event.pointerId);
                activeDrag.captureActive = true;
              }
            }
            setDragOffsetPx(deltaX);
          }}
          onPointerUp={(event) => {
            const activeDrag = pointerStateRef.current;
            if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
            if (activeDrag.captureActive && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (activeDrag.hasDragged) {
              suppressClickUntilRef.current = Date.now() + 250;
              finishPointerDrag(event.clientX - activeDrag.startX, activeDrag.width);
            } else {
              pointerStateRef.current = null;
              setIsPaused(false);
            }
          }}
          onPointerCancel={(event) => {
            const activeDrag = pointerStateRef.current;
            if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
            if (activeDrag.captureActive && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            finishPointerDrag(0, activeDrag.width);
          }}
          className={[
            'review-carousel-viewport touch-pan-y select-none',
            isDragging ? 'cursor-grabbing' : '',
          ].join(' ')}
        >
          <div
            className="review-carousel-track"
            style={{
              transform: `translateX(calc(-${trackIndex} * ((100% + var(--review-gap)) / var(--review-visible)) + ${dragOffsetPx}px))`,
              transition:
                isDragging || !isTransitionEnabled
                  ? 'none'
                  : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
                return;
              }
              if (trackIndex >= totalItems) {
                setIsTransitionEnabled(false);
                setTrackIndex(0);
              }
            }}
          >
            {trackItems.map((item, idx) => (
              <ReviewCard
                key={`${item.id}-${idx}`}
                review={item}
                isHiddenClone={idx >= totalItems}
              />
            ))}
          </div>
        </div>

        <SlideIndicators
          items={reviews.map((item, idx) => ({
            id: item.id,
            label: `Ulasan ${idx + 1}: ${item.namaKlien}`,
          }))}
          activeIndex={activeLogicalIndex}
          ariaLabel="Pilih slide ulasan"
          onSelect={handleSelectDot}
        />
      </div>
    </section>
  );
}

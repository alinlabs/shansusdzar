import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ChevronLeft, ChevronRight, Image as ImageIcon, Play, X } from 'lucide-react';
import { prefetchMediaUrls } from '../../lib/media-cache';
import { prefetchProduct3dViewer, routeLoaders } from '../../lib/route-prefetch';
import { resolveVideoSource, type VisualMediaSlide } from '../../lib/visual-media';
import type { ProductColorOption } from '../../types/product';
import { BrandRingLoader } from './brand-ring-loader';
import { ImageFallback } from './image-fallback';

const LazyProduct3dViewer = lazy(() =>
  routeLoaders.product3dViewer().then((module) => ({ default: module.Product3dViewer }))
);

export interface VisualMediaStageProps {
  itemKey: string;
  itemTitle: string;
  slides: VisualMediaSlide[];
  galleryAriaLabel?: string;
  miniGalleryAriaLabel?: string;
  model3dSrc?: string | null;
  selectedColor?: ProductColorOption;
  selectedFinishLabel?: string;
  externalSlideRequest?: { index: number; token: number } | null;
  onSlideChange?: (index: number) => void;
}

export function VisualMediaStage({
  itemKey,
  itemTitle,
  slides,
  galleryAriaLabel,
  miniGalleryAriaLabel = 'Mini galeri visual',
  model3dSrc = null,
  selectedColor,
  selectedFinishLabel,
  externalSlideRequest = null,
  onSlideChange,
}: VisualMediaStageProps) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [isStageControlsVisible, setIsStageControlsVisible] = useState(false);
  const [is3dModeOpen, setIs3dModeOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageTrackRef = useRef<HTMLDivElement>(null);
  const miniStripRef = useRef<HTMLDivElement>(null);
  const activeSlideIndexRef = useRef(0);
  const stageMouseStartRef = useRef<{ x: number; y: number } | null>(null);
  const stageIdleTimerRef = useRef<number | null>(null);
  const suppressMiniClickTimerRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef<{ index: number; expiresAt: number } | null>(null);
  const miniStripDragRef = useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(
    null
  );
  const suppressMiniClickRef = useRef(false);

  const clampedSlideIndex = slides.length > 0 ? Math.min(activeSlideIndex, slides.length - 1) : 0;

  useEffect(() => {
    activeSlideIndexRef.current = clampedSlideIndex;
    onSlideChange?.(clampedSlideIndex);
    const adjacentUrls: string[] = [];
    const nextSlide = slides[clampedSlideIndex + 1];
    const prevSlide = slides[clampedSlideIndex - 1];
    if (nextSlide?.kind === 'image' && nextSlide.src) adjacentUrls.push(nextSlide.src);
    if (prevSlide?.kind === 'image' && prevSlide.src) adjacentUrls.push(prevSlide.src);
    if (adjacentUrls.length > 0) {
      prefetchMediaUrls(adjacentUrls);
    }
  }, [clampedSlideIndex, slides, onSlideChange]);

  const clearStageIdleTimer = useCallback(() => {
    if (stageIdleTimerRef.current !== null) {
      window.clearTimeout(stageIdleTimerRef.current);
      stageIdleTimerRef.current = null;
    }
  }, []);

  const hideStageControls = useCallback(() => {
    clearStageIdleTimer();
    setIsStageControlsVisible(false);
  }, [clearStageIdleTimer]);

  const revealStageControls = useCallback(() => {
    if (is3dModeOpen) return;
    setIsStageControlsVisible(true);
    clearStageIdleTimer();
    stageIdleTimerRef.current = window.setTimeout(() => {
      stageIdleTimerRef.current = null;
      setIsStageControlsVisible(false);
    }, 2000);
  }, [clearStageIdleTimer, is3dModeOpen]);

  useEffect(() => {
    return () => {
      clearStageIdleTimer();
      if (suppressMiniClickTimerRef.current !== null) {
        window.clearTimeout(suppressMiniClickTimerRef.current);
      }
    };
  }, [clearStageIdleTimer]);

  useEffect(() => {
    stageTrackRef.current?.querySelectorAll('video').forEach((el) => {
      if (!el.paused) el.pause();
    });
    setActiveSlideIndex(0);
    setIs3dModeOpen(false);
    activeSlideIndexRef.current = 0;
    programmaticScrollRef.current = null;
    hideStageControls();
    if (stageTrackRef.current) {
      stageTrackRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
    setIsVideoPlaying(false);
    setIsVideoBuffering(false);
  }, [itemKey, hideStageControls]);

  useEffect(() => {
    const track = stageTrackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;

    const syncScrollOnResize = () => {
      if (track.clientWidth <= 0) return;
      track.scrollTo({
        left: activeSlideIndexRef.current * track.clientWidth,
        behavior: 'auto',
      });
    };

    const observer = new ResizeObserver(syncScrollOnResize);
    observer.observe(track);
    return () => observer.disconnect();
  }, [itemKey]);

  const pauseAllStageVideos = useCallback(() => {
    stageTrackRef.current?.querySelectorAll('video').forEach((el) => {
      if (!el.paused) el.pause();
    });
    setIsVideoPlaying(false);
  }, []);

  const centerMiniGalleryThumb = useCallback((index: number) => {
    const container = miniStripRef.current;
    const thumb = container
      ?.querySelectorAll<HTMLButtonElement>('button[data-thumb-index]')
      .item(index);
    if (container && thumb) {
      const targetLeft = thumb.offsetLeft - container.clientWidth / 2 + thumb.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, []);

  const goToSlide = useCallback(
    (nextIndex: number) => {
      if (slides.length === 0) return;
      const wrapped = (nextIndex + slides.length) % slides.length;
      pauseAllStageVideos();
      setActiveSlideIndex(wrapped);
      activeSlideIndexRef.current = wrapped;

      const track = stageTrackRef.current;
      if (track && track.clientWidth > 0) {
        programmaticScrollRef.current = { index: wrapped, expiresAt: Date.now() + 500 };
        track.scrollTo({ left: wrapped * track.clientWidth, behavior: 'smooth' });
      }

      centerMiniGalleryThumb(wrapped);
    },
    [slides.length, pauseAllStageVideos, centerMiniGalleryThumb]
  );

  useEffect(() => {
    if (!externalSlideRequest) return;
    setIs3dModeOpen(false);
    goToSlide(externalSlideRequest.index);
  }, [externalSlideRequest, goToSlide]);

  const handleStageScroll = () => {
    const track = stageTrackRef.current;
    if (!track || track.clientWidth <= 0 || slides.length <= 1) return;

    const nearestIndex = Math.max(
      0,
      Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth))
    );

    const target = programmaticScrollRef.current;
    if (target) {
      if (
        nearestIndex === target.index &&
        Math.abs(track.scrollLeft - nearestIndex * track.clientWidth) < 2
      ) {
        programmaticScrollRef.current = null;
      } else if (Date.now() < target.expiresAt) {
        return;
      } else {
        programmaticScrollRef.current = null;
      }
    }

    if (nearestIndex !== activeSlideIndexRef.current) {
      pauseAllStageVideos();
      setActiveSlideIndex(nearestIndex);
      activeSlideIndexRef.current = nearestIndex;
      centerMiniGalleryThumb(nearestIndex);
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

  const renderVideoSlide = (
    videoSrc: string,
    posterSrc?: string,
    title?: string,
    isActive = true
  ) => {
    const resolved = resolveVideoSource(videoSrc);
    if (resolved.kind === 'embed') {
      const embedUrl = resolved.src.includes('youtube.com/embed/')
        ? `${resolved.src}${resolved.src.includes('?') ? '&' : '?'}controls=0&modestbranding=1&rel=0`
        : resolved.src;
      return (
        <iframe
          src={embedUrl}
          title={title || `Video ${itemTitle}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="size-full border-0"
        />
      );
    }

    if (resolved.kind === 'native') {
      return (
        <div className="relative size-full bg-black">
          <video
            ref={isActive ? videoRef : undefined}
            key={resolved.src}
            src={resolved.src}
            poster={posterSrc}
            playsInline
            preload="metadata"
            loop
            onPlay={() => {
              setIsVideoPlaying(true);
            }}
            onWaiting={() => setIsVideoBuffering(true)}
            onCanPlay={() => setIsVideoBuffering(false)}
            onPlaying={() => {
              setIsVideoPlaying(true);
              setIsVideoBuffering(false);
            }}
            onPause={() => {
              setIsVideoPlaying(false);
              setIsVideoBuffering(false);
            }}
            onEnded={() => {
              setIsVideoPlaying(false);
              setIsVideoBuffering(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleVideoPlayback();
            }}
            aria-label={title || `Video ${itemTitle}`}
            className="size-full object-cover cursor-pointer"
          />
          {isActive && isVideoBuffering && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/25"
            >
              <BrandRingLoader size="md" delayMs={150} surfaceTone="dark" />
            </div>
          )}
          {!isVideoPlaying && (
            <button
              type="button"
              data-testid="detail-video-play-button"
              aria-label={`Putar ${title || itemTitle}`}
              onClick={(e) => {
                e.stopPropagation();
                revealStageControls();
                toggleVideoPlayback();
              }}
              className={[
                'absolute inset-0 z-10 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-opacity duration-200 focus-visible:opacity-100 cursor-pointer',
                isStageControlsVisible
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none',
              ].join(' ')}
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
    <div className="-mt-5 sm:-mt-9 -mx-4 sm:-mx-6 md:mt-0 md:mx-0">
      <div
        role="region"
        aria-label={galleryAriaLabel ?? `Galeri visual ${itemTitle}`}
        tabIndex={0}
        onMouseEnter={revealStageControls}
        onMouseMove={revealStageControls}
        onMouseLeave={() => {
          if (!miniStripDragRef.current) {
            hideStageControls();
          }
        }}
        onTouchStart={revealStageControls}
        onKeyDown={(e) => {
          if (is3dModeOpen) {
            if (e.key === 'Escape') {
              e.preventDefault();
              setIs3dModeOpen(false);
            }
            return;
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            revealStageControls();
            goToSlide(clampedSlideIndex - 1);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            revealStageControls();
            goToSlide(clampedSlideIndex + 1);
          }
        }}
        className="group/stage relative aspect-[4/3] w-full overflow-hidden image-clip-frame rounded-none border-x-0 border-t-0 border-b border-[var(--border)] md:rounded-[var(--radius-lg)] md:border bg-[var(--surface-muted)] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
      >
        <div
          ref={stageTrackRef}
          data-testid="detail-visual-track"
          onScroll={() => {
            handleStageScroll();
            if (!programmaticScrollRef.current) {
              revealStageControls();
            }
          }}
          onPointerDown={(e) => {
            revealStageControls();
            if (e.pointerType === 'touch') return;
            stageMouseStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = stageMouseStartRef.current;
            stageMouseStartRef.current = null;
            if (!start || e.pointerType === 'touch' || slides.length <= 1) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
              goToSlide(dx < 0 ? clampedSlideIndex + 1 : clampedSlideIndex - 1);
            }
          }}
          onPointerCancel={() => {
            stageMouseStartRef.current = null;
          }}
          className={[
            'flex size-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [touch-action:pan-x_pan-y]',
            is3dModeOpen ? 'pointer-events-none' : '',
          ].join(' ')}
        >
          {slides.map((slide, idx) => (
            <div key={slide.id} className="relative size-full shrink-0 snap-center snap-always">
              {slide.kind === 'video' &&
                renderVideoSlide(slide.src, slide.poster, slide.title, idx === clampedSlideIndex)}

              {slide.kind === 'image' && (
                <ImageFallback
                  src={slide.src}
                  alt={slide.title}
                  aspectRatio="auto"
                  eager={idx === 0}
                  fallbackLabel={slide.fallbackLabel ?? itemTitle}
                  className="size-full rounded-none border-0"
                />
              )}
            </div>
          ))}
        </div>

        {!is3dModeOpen && model3dSrc && (
          <button
            type="button"
            data-testid="detail-3d-open-button"
            aria-label={`Lihat model 3D ${itemTitle}`}
            onMouseEnter={() => prefetchProduct3dViewer()}
            onFocus={() => prefetchProduct3dViewer()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              pauseAllStageVideos();
              hideStageControls();
              setIs3dModeOpen(true);
            }}
            className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <Box className="size-3.5 text-[var(--text)]" aria-hidden="true" />
            <span>3D</span>
          </button>
        )}

        {is3dModeOpen && model3dSrc && (
          <div className="absolute inset-0 z-30 size-full bg-[var(--surface-muted)]">
            <Suspense
              fallback={
                <div className="relative size-full flex flex-col items-center justify-center gap-2 bg-[var(--surface-muted)] text-center p-4">
                  <button
                    type="button"
                    data-testid="detail-3d-close-button"
                    aria-label="Tutup tampilan 3D"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIs3dModeOpen(false);
                    }}
                    className="absolute top-3 right-3 z-20 inline-flex items-center justify-center size-7 sm:size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--text)] hover:bg-[var(--surface-muted)] shadow-xs cursor-pointer"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <BrandRingLoader size="md" delayMs={0} label="Menyiapkan penampil 3D..." />
                </div>
              }
            >
              <LazyProduct3dViewer
                src={model3dSrc}
                productName={itemTitle}
                isActive={is3dModeOpen}
                selectedColor={selectedColor}
                finishLabel={selectedFinishLabel}
                onClose={() => setIs3dModeOpen(false)}
              />
            </Suspense>
          </div>
        )}

        {!is3dModeOpen && slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Slide visual sebelumnya"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                revealStageControls();
                goToSlide(clampedSlideIndex - 1);
              }}
              className={[
                'hidden sm:inline-flex items-center justify-center size-9 rounded-full bg-black/55 hover:bg-black/75 text-white absolute left-3 top-1/2 -translate-y-1/2 z-20 transition-opacity duration-200 focus-visible:opacity-100 cursor-pointer',
                isStageControlsVisible
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none',
              ].join(' ')}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Slide visual berikutnya"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                revealStageControls();
                goToSlide(clampedSlideIndex + 1);
              }}
              className={[
                'hidden sm:inline-flex items-center justify-center size-9 rounded-full bg-black/55 hover:bg-black/75 text-white absolute right-3 top-1/2 -translate-y-1/2 z-20 transition-opacity duration-200 focus-visible:opacity-100 cursor-pointer',
                isStageControlsVisible
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none',
              ].join(' ')}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </>
        )}

        {!is3dModeOpen && slides.length > 1 && (
          <div
            data-testid="detail-mini-gallery-overlay"
            onPointerDown={(e) => {
              e.stopPropagation();
              revealStageControls();
            }}
            onPointerUp={(e) => e.stopPropagation()}
            className={[
              'absolute -inset-x-px -bottom-px z-20 px-2 sm:px-3 pb-2 pt-7 bg-gradient-to-t from-black/75 via-black/35 to-transparent transition-opacity duration-200',
              isStageControlsVisible
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none',
            ].join(' ')}
          >
            <div
              ref={miniStripRef}
              role="group"
              aria-label={miniGalleryAriaLabel}
              onScroll={revealStageControls}
              onPointerDown={(e) => {
                revealStageControls();
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
                  if (suppressMiniClickTimerRef.current !== null) {
                    window.clearTimeout(suppressMiniClickTimerRef.current);
                  }
                  suppressMiniClickTimerRef.current = window.setTimeout(() => {
                    suppressMiniClickTimerRef.current = null;
                    suppressMiniClickRef.current = false;
                  }, 80);
                }
                miniStripDragRef.current = null;
              }}
              onPointerCancel={() => {
                miniStripDragRef.current = null;
              }}
              className="overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1"
            >
              <div className="flex w-max min-w-full items-center justify-center gap-1.5 px-2">
                {slides.map((slide, idx) => {
                  const isSelected = idx === clampedSlideIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      data-thumb-index={idx}
                      aria-label={slide.title}
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressMiniClickRef.current) return;
                        revealStageControls();
                        goToSlide(idx);
                      }}
                      className={[
                        'relative w-12 sm:w-14 lg:w-16 aspect-[4/3] shrink-0 overflow-hidden rounded-[var(--radius-sm)] transition-[border-color,opacity] cursor-pointer bg-[var(--surface)]',
                        isSelected
                          ? 'border-2 border-white opacity-100 shadow-sm'
                          : 'border border-white/40 opacity-75 hover:opacity-100',
                      ].join(' ')}
                    >
                      {slide.kind === 'video' && (
                        <div className="relative size-full flex items-center justify-center bg-black text-white">
                          {slide.poster && (
                            <img
                              src={slide.poster}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              className="absolute inset-0 size-full object-cover opacity-70"
                            />
                          )}
                          <span className="relative z-10 inline-flex items-center justify-center size-5 rounded-full bg-white/95 text-black">
                            <Play className="size-2.5 fill-current ml-0.5" aria-hidden="true" />
                          </span>
                        </div>
                      )}

                      {slide.kind === 'image' &&
                        (slide.src ? (
                          <img
                            src={slide.src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="size-full object-cover object-center"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center bg-[var(--surface-muted)] text-[var(--text-muted)]">
                            <ImageIcon className="size-3.5" aria-hidden="true" />
                          </div>
                        ))}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { getCachedMediaObjectUrl, useCachedMediaSrc } from '../../lib/media-cache';
import { BrandRingLoader } from './brand-ring-loader';

export type AspectRatioPreset = '16/9' | '4/3' | '4/5' | '3/4' | '1/1' | '21/9' | 'auto';

const ASPECT_CLASSES: Record<AspectRatioPreset, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
  '21/9': 'aspect-[21/9]',
  auto: '',
};

export interface ImageFallbackProps {
  src?: string | null;
  alt: string;
  aspectRatio?: AspectRatioPreset;
  fallbackLabel?: string;
  compact?: boolean;
  eager?: boolean;
  className?: string;
  imgClassName?: string;
}

export function ImageFallback({
  src,
  alt,
  aspectRatio = '4/5',
  fallbackLabel,
  compact = false,
  eager = false,
  className = '',
  imgClassName = '',
}: ImageFallbackProps) {
  const normalizedSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [inViewportRange, setInViewportRange] = useState<boolean>(() => {
    if (eager) return true;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return true;
    if (normalizedSrc && getCachedMediaObjectUrl(normalizedSrc)) return true;
    return false;
  });

  useEffect(() => {
    if (eager || inViewportRange) return;
    if (normalizedSrc && getCachedMediaObjectUrl(normalizedSrc)) {
      setInViewportRange(true);
      return;
    }

    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInViewportRange(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setInViewportRange(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '300px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, inViewportRange, normalizedSrc]);

  const shouldLoad = Boolean(normalizedSrc) && (eager || inViewportRange);
  const cachedSrc = useCachedMediaSrc(normalizedSrc, { enabled: shouldLoad });
  const displaySrc = shouldLoad ? (cachedSrc ?? normalizedSrc) : null;

  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(() =>
    Boolean(normalizedSrc && getCachedMediaObjectUrl(normalizedSrc))
  );

  useEffect(() => {
    setHasError(false);
    if (!displaySrc) {
      setIsLoaded(false);
      return;
    }
    if (normalizedSrc && getCachedMediaObjectUrl(normalizedSrc)) {
      setIsLoaded(true);
      return;
    }
    const imgEl = imgRef.current;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [displaySrc, normalizedSrc]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const showFallback = !normalizedSrc || hasError;
  const showLoader = !showFallback && shouldLoad && !isLoaded;

  return (
    <div
      ref={frameRef}
      className={[
        'relative overflow-hidden image-clip-frame bg-[var(--surface-muted)] border border-[var(--border)]',
        ASPECT_CLASSES[aspectRatio],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showFallback ? (
        <div
          className={[
            'absolute inset-0 size-full flex flex-col items-center justify-center text-center select-none',
            compact ? 'p-1 gap-0.5' : 'p-4 sm:p-6 gap-2.5',
          ].join(' ')}
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
        >
          <svg
            viewBox="0 0 48 48"
            fill="none"
            className={[
              'text-[var(--text-subtle)] shrink-0',
              compact ? 'size-4' : 'size-7 sm:size-8',
            ].join(' ')}
            aria-hidden="true"
          >
            <rect
              x="6"
              y="10"
              width="36"
              height="28"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12 31L20 23L27 29L32 25L36 31"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="17" cy="18" r="2" fill="currentColor" />
          </svg>
          <span
            className={[
              'font-medium text-[var(--text-muted)]',
              compact ? 'text-[9px] leading-none truncate max-w-full' : 'text-xs max-w-[22ch] leading-snug',
            ].join(' ')}
          >
            {fallbackLabel || alt || 'Gambar'}
          </span>
        </div>
      ) : (
        <>
          {showLoader && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <BrandRingLoader size={compact ? 'xs' : 'sm'} delayMs={140} />
            </div>
          )}

          {displaySrc && (
            <img
              ref={imgRef}
              src={displaySrc}
              alt={alt}
              referrerPolicy="no-referrer"
              loading={eager ? 'eager' : 'lazy'}
              decoding={eager ? 'sync' : 'async'}
              fetchPriority={eager ? 'high' : undefined}
              onLoad={handleImageLoad}
              onError={() => setHasError(true)}
              className={[
                'absolute -inset-px size-[calc(100%+2px)] max-w-none object-cover object-center transition-opacity duration-200',
                isLoaded ? 'opacity-100' : 'opacity-0',
                imgClassName,
              ]
                .filter(Boolean)
                .join(' ')}
            />
          )}
        </>
      )}
    </div>
  );
}

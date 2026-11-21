import { useEffect, useState } from 'react';
import { useCachedMediaSrc } from '../../lib/media-cache';

export type AspectRatioPreset = '16/9' | '4/3' | '4/5' | '3/4' | '1/1' | 'auto';

const ASPECT_CLASSES: Record<AspectRatioPreset, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
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
  const cachedSrc = useCachedMediaSrc(normalizedSrc);
  const displaySrc = cachedSrc ?? normalizedSrc;
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [displaySrc]);

  const showFallback = !displaySrc || hasError;

  return (
    <div
      className={[
        'relative overflow-hidden bg-[var(--surface-muted)] border border-[var(--border)]',
        ASPECT_CLASSES[aspectRatio],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showFallback ? (
        <div
          className={[
            'h-full w-full flex flex-col items-center justify-center text-center select-none',
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
        <img
          src={displaySrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? 'sync' : 'async'}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      )}
    </div>
  );
}

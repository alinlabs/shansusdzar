import { useEffect, useState } from 'react';
import { getCachedMediaObjectUrl } from '../../lib/media-cache';

export type BrandRingLoaderSize = 'xs' | 'sm' | 'md' | 'lg';

interface SizeSpec {
  wrapper: string;
  logo: string;
  svgSize: number;
  strokeWidth: number;
}

const SIZE_SPECS: Record<BrandRingLoaderSize, SizeSpec> = {
  xs: { wrapper: 'size-8', logo: 'size-3.5', svgSize: 32, strokeWidth: 2 },
  sm: { wrapper: 'size-10', logo: 'size-4.5', svgSize: 40, strokeWidth: 2 },
  md: { wrapper: 'size-13', logo: 'size-6', svgSize: 52, strokeWidth: 2.1 },
  lg: { wrapper: 'size-16', logo: 'size-7.5', svgSize: 64, strokeWidth: 2.2 },
};

export interface BrandRingLoaderProps {
  size?: BrandRingLoaderSize;
  progressPct?: number | null;
  label?: string;
  delayMs?: number;
  className?: string;
  surfaceTone?: 'theme' | 'dark';
}

export function BrandRingLoader({
  size = 'md',
  progressPct = null,
  label,
  delayMs = 120,
  className = '',
  surfaceTone = 'theme',
}: BrandRingLoaderProps) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  const spec = SIZE_SPECS[size];
  const radius = (spec.svgSize - spec.strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasDeterminateProgress =
    typeof progressPct === 'number' && Number.isFinite(progressPct) && progressPct > 0;
  const clampedPct = hasDeterminateProgress
    ? Math.max(8, Math.min(100, progressPct as number))
    : 28;
  const dashLength = (clampedPct / 100) * circumference;

  const lightLogoSrc = getCachedMediaObjectUrl('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = getCachedMediaObjectUrl('/logo-white.webp') ?? '/logo-white.webp';

  const ringColorClass =
    surfaceTone === 'dark' ? 'text-white' : 'text-[var(--text)]';
  const trackOpacityClass =
    surfaceTone === 'dark' ? 'opacity-20' : 'opacity-15';
  const labelColorClass =
    surfaceTone === 'dark' ? 'text-white/90' : 'text-[var(--text-muted)]';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Memuat konten'}
      data-testid="brand-ring-loader"
      className={[
        'inline-flex flex-col items-center justify-center gap-2.5 select-none transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={`relative inline-flex items-center justify-center ${spec.wrapper}`}>
        <svg
          viewBox={`0 0 ${spec.svgSize} ${spec.svgSize}`}
          className={`absolute inset-0 size-full ${ringColorClass}`}
          aria-hidden="true"
        >
          <circle
            cx={spec.svgSize / 2}
            cy={spec.svgSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={spec.strokeWidth}
            className={trackOpacityClass}
          />
          <circle
            cx={spec.svgSize / 2}
            cy={spec.svgSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={spec.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference}`}
            className={
              hasDeterminateProgress
                ? 'origin-center -rotate-90 transition-[stroke-dasharray] duration-200'
                : 'brand-ring-spin origin-center'
            }
          />
        </svg>

        {surfaceTone === 'dark' ? (
          <img
            src={darkLogoSrc}
            alt=""
            aria-hidden="true"
            decoding="async"
            className={`${spec.logo} object-contain pointer-events-none`}
          />
        ) : (
          <>
            <img
              src={lightLogoSrc}
              alt=""
              aria-hidden="true"
              decoding="async"
              className={`${spec.logo} object-contain pointer-events-none dark:hidden`}
            />
            <img
              src={darkLogoSrc}
              alt=""
              aria-hidden="true"
              decoding="async"
              className={`hidden ${spec.logo} object-contain pointer-events-none dark:block`}
            />
          </>
        )}
      </div>

      {label && (
        <p className={`text-xs font-medium leading-tight text-center ${labelColorClass}`}>
          {label}
        </p>
      )}
    </div>
  );
}

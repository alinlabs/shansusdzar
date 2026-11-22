import { BrandRingLoader } from './brand-ring-loader';

export interface RouteLoadingFallbackProps {
  fullViewport?: boolean;
  label?: string;
}

export function RouteLoadingFallback({
  fullViewport = false,
  label = 'Memuat halaman...',
}: RouteLoadingFallbackProps) {
  return (
    <div
      data-testid="route-loading-fallback"
      aria-busy="true"
      aria-label="Memuat halaman"
      className={
        fullViewport
          ? 'min-h-dvh w-full flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]'
          : 'flex-1 w-full min-h-[calc(100dvh-9rem)] flex items-center justify-center p-4'
      }
    >
      <BrandRingLoader size="lg" delayMs={120} label={label} />
    </div>
  );
}

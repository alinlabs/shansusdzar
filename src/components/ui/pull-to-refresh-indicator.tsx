import type { PullToRefreshPhase } from '../../lib/pull-to-refresh-logic';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  phase: PullToRefreshPhase;
  progress: number;
}

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function PullToRefreshIndicator({
  pullDistance,
  phase,
  progress,
}: PullToRefreshIndicatorProps) {
  const isVisible = phase !== 'idle';
  const containerHeight = phase === 'refreshing' ? 48 : isVisible ? Math.min(64, pullDistance) : 0;
  const dashOffset =
    phase === 'refreshing'
      ? RING_CIRCUMFERENCE * 0.28
      : RING_CIRCUMFERENCE * (1 - Math.max(0.1, progress) * 0.85);

  return (
    <div
      aria-hidden="true"
      data-testid="pull-to-refresh-indicator"
      data-phase={phase}
      style={{ height: `${containerHeight}px` }}
      className={[
        'pointer-events-none select-none shrink-0 w-full overflow-hidden flex items-center justify-center',
        phase === 'pulling' || phase === 'ready'
          ? ''
          : 'transition-[height,opacity] duration-200 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div
        className={[
          'size-8 rounded-full border bg-[var(--surface)] shadow-[var(--shadow-sm)] flex items-center justify-center transition-transform duration-150',
          phase === 'ready' || phase === 'refreshing'
            ? 'border-[var(--accent)] text-[var(--accent)] scale-100'
            : 'border-[var(--border-strong)] text-[var(--text-muted)] scale-95',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 24 24"
          className={[
            'size-4',
            phase === 'refreshing' ? 'animate-spin' : '',
          ].join(' ')}
          style={
            phase === 'refreshing'
              ? undefined
              : { transform: `rotate(${Math.round(progress * 240)}deg)` }
          }
        >
          <circle
            cx="12"
            cy="12"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
      </div>
    </div>
  );
}

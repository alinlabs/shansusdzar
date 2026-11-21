import { useState } from 'react';
import type { DonutSliceItem } from '../../lib/dashboard-analytics';

interface CircleDonutChartProps {
  slices: readonly DonutSliceItem[];
  centerLabel: string;
  centerValue: string;
  emptyMessage?: string;
}

export function CircleDonutChart({
  slices,
  centerLabel,
  centerValue,
  emptyMessage = 'Belum ada data distribusi.',
}: CircleDonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nonZeroSlices = slices.filter((s) => s.value > 0);
  const total = nonZeroSlices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0 || nonZeroSlices.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-[var(--text-muted)]">{emptyMessage}</div>
    );
  }

  const size = 204;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const gapPx = nonZeroSlices.length > 1 ? 2.5 : 0;

  let cumulativeFraction = 0;
  const segments = nonZeroSlices.map((slice) => {
    const fraction = slice.value / total;
    const rawDash = fraction * circumference;
    const dashLength = Math.max(2, rawDash - gapPx);
    const dashOffset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;

    return {
      ...slice,
      dashLength,
      dashOffset,
    };
  });

  const activeSlice = hoveredId ? segments.find((s) => s.id === hoveredId) ?? null : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-5">
      {/* Circle / Donut SVG */}
      <div className="sm:col-span-5 flex items-center justify-center">
        <div className="relative size-[196px]">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="size-full -rotate-90 overflow-visible"
            role="img"
            aria-label={`Diagram lingkaran: ${centerLabel}`}
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--surface-muted)"
              strokeWidth={22}
            />
            {segments.map((seg) => {
              const isHighlighted = activeSlice?.id === seg.id;
              const isDimmed = activeSlice !== null && !isHighlighted;
              return (
                <circle
                  key={seg.id}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.colorVar}
                  strokeWidth={isHighlighted ? 26 : 22}
                  strokeDasharray={`${seg.dashLength} ${circumference}`}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="butt"
                  opacity={isDimmed ? 0.35 : 1}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setHoveredId((prev) => (prev === seg.id ? null : seg.id))}
                />
              );
            })}
          </svg>

          {/* Center Readout */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <span className="text-[11px] text-[var(--text-muted)] line-clamp-1">
              {activeSlice ? activeSlice.label : centerLabel}
            </span>
            <span className="mt-0.5 text-base font-semibold text-[var(--text)] tabular-nums leading-tight">
              {activeSlice ? `${activeSlice.percentage}%` : centerValue}
            </span>
            {activeSlice && (
              <span className="mt-0.5 text-[10px] text-[var(--text-subtle)] tabular-nums line-clamp-1">
                {activeSlice.detailLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Legend Breakdown */}
      <ul className="sm:col-span-7 divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
        {segments.map((seg) => {
          const isHighlighted = activeSlice?.id === seg.id;
          return (
            <li key={seg.id}>
              <button
                type="button"
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(seg.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => setHoveredId((prev) => (prev === seg.id ? null : seg.id))}
                className={[
                  'w-full px-3 py-2 flex items-center justify-between gap-3 text-left text-xs transition-colors cursor-pointer',
                  isHighlighted ? 'bg-[var(--surface-muted)]/70' : 'hover:bg-[var(--surface-muted)]/40',
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: seg.colorVar }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text)] truncate">{seg.label}</p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums truncate">
                      {seg.detailLabel}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                  {seg.percentage}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

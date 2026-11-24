import { useId, useState } from 'react';
import type { LineChartPoint } from '../../lib/dashboard-analytics';

export interface LineSeriesConfig {
  key: string;
  label: string;
  colorVar: string;
  yAxis?: 'left' | 'right';
  dashed?: boolean;
  areaFill?: boolean;
  formatValue?: (val: number) => string;
}

interface LineTrendChartProps {
  data: readonly LineChartPoint[];
  series: readonly LineSeriesConfig[];
  height?: number;
  leftAxisFormatter?: (val: number) => string;
  rightAxisFormatter?: (val: number) => string;
  emptyMessage?: string;
}

function defaultNumberFormatter(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)} rb`;
  return String(Math.round(val));
}

export function LineTrendChart({
  data,
  series,
  height = 260,
  leftAxisFormatter = defaultNumberFormatter,
  rightAxisFormatter = defaultNumberFormatter,
  emptyMessage = 'Belum ada data tren untuk ditampilkan.',
}: LineTrendChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0 || series.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-[var(--text-muted)]">{emptyMessage}</div>
    );
  }

  const width = 760;
  const hasRightAxis = series.some((s) => s.yAxis === 'right');
  const padLeft = 56;
  const padRight = hasRightAxis ? 54 : 20;
  const padTop = 18;
  const padBottom = 34;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const leftSeries = series.filter((s) => (s.yAxis ?? 'left') === 'left');
  const rightSeries = series.filter((s) => s.yAxis === 'right');

  const computeMax = (targetSeries: readonly LineSeriesConfig[]) => {
    let max = 0;
    for (const point of data) {
      for (const s of targetSeries) {
        const val = point.values[s.key] ?? 0;
        if (val > max) max = val;
      }
    }
    return max > 0 ? max * 1.15 : 10;
  };

  const leftMax = computeMax(leftSeries);
  const rightMax = hasRightAxis ? computeMax(rightSeries) : 10;

  const getX = (index: number) => {
    if (data.length === 1) return padLeft + innerWidth / 2;
    return padLeft + (index / (data.length - 1)) * innerWidth;
  };

  const getY = (val: number, axis: 'left' | 'right' = 'left') => {
    const max = axis === 'right' ? rightMax : leftMax;
    const ratio = Math.max(0, Math.min(1, val / max));
    return padTop + innerHeight - ratio * innerHeight;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = data.length > 16 ? Math.ceil(data.length / 7) : data.length > 8 ? 2 : 1;
  const resolvedActiveIndex =
    activeIndex !== null && activeIndex >= 0 && activeIndex < data.length
      ? activeIndex
      : data.length - 1;
  const activePoint = data[resolvedActiveIndex];

  const primaryAreaSeries = series.find((s) => s.areaFill) ?? series[0];

  const buildPolylinePoints = (s: LineSeriesConfig) =>
    data
      .map((point, idx) => {
        const x = getX(idx);
        const y = getY(point.values[s.key] ?? 0, s.yAxis ?? 'left');
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const buildAreaPath = (s: LineSeriesConfig) => {
    if (data.length === 0) return '';
    const coords = data.map((point, idx) => ({
      x: getX(idx),
      y: getY(point.values[s.key] ?? 0, s.yAxis ?? 'left'),
    }));
    const baseline = padTop + innerHeight;
    const first = coords[0];
    const last = coords[coords.length - 1];
    const lineSegments = coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    return `M ${first.x.toFixed(1)} ${baseline.toFixed(1)} ${lineSegments} L ${last.x.toFixed(1)} ${baseline.toFixed(1)} Z`;
  };

  return (
    <div className="space-y-3">
      {/* Interactive Point Readout Bar (always visible, updates on hover/tap) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-muted)]/45 border border-[var(--border)] text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[var(--text)]">{activePoint.label}</span>
          {activePoint.subLabel && (
            <span className="text-[var(--text-muted)] truncate hidden sm:inline">
              · {activePoint.subLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s) => {
            const val = activePoint.values[s.key] ?? 0;
            const formatted = s.formatValue ? s.formatValue(val) : val.toLocaleString('id-ID');
            return (
              <span key={s.key} className="inline-flex items-center gap-1.5 tabular-nums">
                <span
                  className="size-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: s.colorVar }}
                />
                <span className="text-[var(--text-muted)]">{s.label}:</span>
                <strong className="font-semibold text-[var(--text)]">{formatted}</strong>
              </span>
            );
          })}
        </div>
      </div>

      {/* Responsive SVG Line Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Grafik garis tren statistik"
        >
          <defs>
            <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryAreaSeries.colorVar} stopOpacity="0.24" />
              <stop offset="100%" stopColor={primaryAreaSeries.colorVar} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((ratio) => {
            const y = padTop + innerHeight - ratio * innerHeight;
            const leftVal = leftMax * ratio;
            const rightVal = rightMax * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[var(--text-subtle)] text-[10px] tabular-nums"
                >
                  {leftAxisFormatter(leftVal)}
                </text>
                {hasRightAxis && (
                  <text
                    x={width - padRight + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    className="fill-[var(--text-subtle)] text-[10px] tabular-nums"
                  >
                    {rightAxisFormatter(rightVal)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Primary Area Under Curve */}
          {data.length > 1 && (
            <path d={buildAreaPath(primaryAreaSeries)} fill={`url(#area-${gradientId})`} />
          )}

          {/* Series Polylines */}
          {series.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.colorVar}
              strokeWidth={s.dashed ? 2 : 2.5}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={buildPolylinePoints(s)}
            />
          ))}

          {/* Active Crosshair Line */}
          <line
            x1={getX(resolvedActiveIndex)}
            y1={padTop}
            x2={getX(resolvedActiveIndex)}
            y2={padTop + innerHeight}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Data Point Nodes & Interactive Hit Columns */}
          {data.map((point, idx) => {
            const cx = getX(idx);
            const isSelected = idx === resolvedActiveIndex;
            const colWidth = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;
            const hitX = idx === 0 ? padLeft : cx - colWidth / 2;
            const hitW =
              idx === 0 || idx === data.length - 1 ? colWidth / 2 + 8 : colWidth;

            const showXLabel =
              idx === 0 || idx === data.length - 1 || idx % labelStep === 0;

            return (
              <g key={point.key}>
                {showXLabel && (
                  <text
                    x={cx}
                    y={height - 10}
                    textAnchor={
                      idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'
                    }
                    className="fill-[var(--text-subtle)] text-[10px] tabular-nums"
                  >
                    {point.label}
                  </text>
                )}

                {series.map((s) => {
                  const cy = getY(point.values[s.key] ?? 0, s.yAxis ?? 'left');
                  if (!isSelected && data.length > 15) return null;
                  return (
                    <circle
                      key={s.key}
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 4.5 : 2.5}
                      fill={isSelected ? s.colorVar : 'var(--surface)'}
                      stroke={s.colorVar}
                      strokeWidth={isSelected ? 2 : 1.75}
                    />
                  );
                })}

                <rect
                  x={Math.max(padLeft - 4, hitX)}
                  y={padTop}
                  width={Math.max(12, hitW)}
                  height={innerHeight + 16}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => setActiveIndex(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

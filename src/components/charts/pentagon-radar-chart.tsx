import { useState } from 'react';
import type { PentagonAxisScore } from '../../lib/dashboard-analytics';

interface PentagonRadarChartProps {
  axes: readonly PentagonAxisScore[];
  compositeIndex: number;
}

function getPolygonPoint(
  cx: number,
  cy: number,
  radius: number,
  axisIndex: number,
  totalAxes: number
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (axisIndex * 2 * Math.PI) / totalAxes;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function PentagonRadarChart({ axes, compositeIndex }: PentagonRadarChartProps) {
  const [hoveredAxisId, setHoveredAxisId] = useState<string | null>(null);

  if (axes.length !== 5) return null;

  const width = 340;
  const height = 276;
  const cx = width / 2;
  const cy = height / 2 + 6;
  const maxRadius = 86;
  const levels = [20, 40, 60, 80, 100];

  const actualPoints = axes.map((axis, idx) =>
    getPolygonPoint(cx, cy, (axis.score / 100) * maxRadius, idx, 5)
  );
  const targetPoints = axes.map((axis, idx) =>
    getPolygonPoint(cx, cy, (axis.targetScore / 100) * maxRadius, idx, 5)
  );

  const toPointsAttr = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const activeAxis = hoveredAxisId ? axes.find((a) => a.id === hoveredAxisId) ?? null : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-5">
      {/* 5-Axis Pentagon Radar SVG */}
      <div className="md:col-span-6 flex flex-col items-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[340px] h-auto select-none"
          role="img"
          aria-label="Pentagon chart performa studio 5 sumbu"
        >
          {/* Concentric Pentagon Grid Levels */}
          {levels.map((lvl) => {
            const ringPts = axes.map((_, idx) =>
              getPolygonPoint(cx, cy, (lvl / 100) * maxRadius, idx, 5)
            );
            return (
              <polygon
                key={lvl}
                points={toPointsAttr(ringPts)}
                fill={lvl === 100 ? 'var(--surface-muted)' : 'none'}
                fillOpacity={lvl === 100 ? 0.25 : 0}
                stroke="var(--border)"
                strokeWidth={lvl === 100 ? 1.25 : 0.85}
              />
            );
          })}

          {/* Radial Spokes */}
          {axes.map((axis, idx) => {
            const outer = getPolygonPoint(cx, cy, maxRadius, idx, 5);
            return (
              <line
                key={axis.id}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--border)"
                strokeWidth={1}
              />
            );
          })}

          {/* Scale Ticks on Top Vertical Spoke */}
          {[40, 80].map((lvl) => {
            const pt = getPolygonPoint(cx, cy, (lvl / 100) * maxRadius, 0, 5);
            return (
              <text
                key={lvl}
                x={pt.x + 5}
                y={pt.y + 3}
                className="fill-[var(--text-subtle)] text-[9px] tabular-nums"
              >
                {lvl}
              </text>
            );
          })}

          {/* Target Benchmark Pentagon (Dashed) */}
          <polygon
            points={toPointsAttr(targetPoints)}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.75}
          />

          {/* Actual Studio Performance Pentagon */}
          <polygon
            points={toPointsAttr(actualPoints)}
            fill="var(--chart-1)"
            fillOpacity={0.22}
            stroke="var(--chart-1)"
            strokeWidth={2.25}
            strokeLinejoin="round"
          />

          {/* Interactive Vertex Nodes + Axis Labels */}
          {axes.map((axis, idx) => {
            const pt = actualPoints[idx];
            const labelPos = getPolygonPoint(cx, cy, maxRadius + 24, idx, 5);
            const isActive = activeAxis?.id === axis.id;

            let textAnchor: 'middle' | 'start' | 'end' = 'middle';
            if (idx === 1 || idx === 2) textAnchor = 'start';
            if (idx === 3 || idx === 4) textAnchor = 'end';

            const labelYOffset = idx === 0 ? -4 : idx === 2 || idx === 3 ? 8 : 2;

            return (
              <g
                key={axis.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredAxisId(axis.id)}
                onMouseLeave={() => setHoveredAxisId(null)}
                onClick={() => setHoveredAxisId((prev) => (prev === axis.id ? null : axis.id))}
              >
                <text
                  x={labelPos.x}
                  y={labelPos.y + labelYOffset}
                  textAnchor={textAnchor}
                  className={[
                    'text-[10.5px] font-medium transition-colors',
                    isActive ? 'fill-[var(--text)] font-semibold' : 'fill-[var(--text-muted)]',
                  ].join(' ')}
                >
                  {axis.shortLabel}
                </text>
                <text
                  x={labelPos.x}
                  y={labelPos.y + labelYOffset + 12}
                  textAnchor={textAnchor}
                  className="fill-[var(--text-subtle)] text-[9.5px] tabular-nums"
                >
                  {axis.score}/100
                </text>

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 6 : 4}
                  fill={isActive ? 'var(--chart-1)' : 'var(--surface)'}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>

        <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-[var(--chart-1)]" />
            Aktual Studio ({compositeIndex}/100)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-[var(--chart-2)]" />
            Target Standar
          </span>
        </div>
      </div>

      {/* 5-Axis Diagnostic List */}
      <div className="md:col-span-6 space-y-2">
        <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
          {axes.map((axis) => {
            const isActive = activeAxis?.id === axis.id;
            return (
              <li key={axis.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredAxisId(axis.id)}
                  onMouseLeave={() => setHoveredAxisId(null)}
                  onFocus={() => setHoveredAxisId(axis.id)}
                  onBlur={() => setHoveredAxisId(null)}
                  onClick={() =>
                    setHoveredAxisId((prev) => (prev === axis.id ? null : axis.id))
                  }
                  className={[
                    'w-full px-3 py-2.5 text-left transition-colors cursor-pointer space-y-1',
                    isActive ? 'bg-[var(--surface-muted)]/70' : 'hover:bg-[var(--surface-muted)]/40',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[var(--text)]">{axis.label}</span>
                    <span className="tabular-nums text-[var(--text)] font-semibold">
                      {axis.metricValueLabel} · {axis.score}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--chart-1)] transition-all duration-200"
                      style={{ width: `${axis.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                    {axis.explanation}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

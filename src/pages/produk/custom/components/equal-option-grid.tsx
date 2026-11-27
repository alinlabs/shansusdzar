import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { resolveFittingGridColumns } from '../custom-config';

export interface EqualOptionGridItem {
  id: string;
  label: string;
}

export interface EqualOptionGridProps {
  items: readonly EqualOptionGridItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
  testId?: string;
}

const GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function EqualOptionGrid({
  items,
  selectedId,
  onSelect,
  ariaLabel,
  testId,
}: EqualOptionGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [columns, setColumns] = useState<number>(() =>
    Math.max(1, Math.min(items.length, 4))
  );

  const recomputeColumns = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) {
      setColumns(1);
      return;
    }

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) {
      setColumns(Math.max(1, Math.min(items.length, 4)));
      return;
    }

    const containerStyle = window.getComputedStyle(container);
    const parsedGap = Number.parseFloat(containerStyle.columnGap || containerStyle.gap || '8');
    const gapPx = Number.isFinite(parsedGap) ? parsedGap : 8;

    let horizontalChrome = 24;
    const sampleBtn = buttonRefs.current.find(Boolean);
    if (sampleBtn) {
      const btnStyle = window.getComputedStyle(sampleBtn);
      const padL = Number.parseFloat(btnStyle.paddingLeft || '12') || 12;
      const padR = Number.parseFloat(btnStyle.paddingRight || '12') || 12;
      const borderL = Number.parseFloat(btnStyle.borderLeftWidth || '1') || 1;
      const borderR = Number.parseFloat(btnStyle.borderRightWidth || '1') || 1;
      horizontalChrome = padL + padR + borderL + borderR;
    }

    let maxRequiredItemWidth = 0;
    for (let i = 0; i < items.length; i += 1) {
      const labelEl = labelRefs.current[i];
      if (!labelEl) continue;
      // Add 6px safety margin so medium-weight selected text never clips or wraps
      const needed = labelEl.getBoundingClientRect().width + horizontalChrome + 6;
      if (needed > maxRequiredItemWidth) {
        maxRequiredItemWidth = needed;
      }
    }

    const nextCols = resolveFittingGridColumns({
      itemCount: items.length,
      containerWidth,
      maxRequiredItemWidth,
      gapPx,
      maxColumns: 4,
    });

    setColumns((prev) => (prev === nextCols ? prev : nextCols));
  }, [items]);

  useLayoutEffect(() => {
    recomputeColumns();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      recomputeColumns();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recomputeColumns]);

  const gridColsClass = GRID_COLS_CLASS[columns] ?? 'grid-cols-1';

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`grid ${gridColsClass} gap-2`}
    >
      {items.map((item, idx) => {
        const isSelected = item.id === selectedId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(item.id)}
            className={[
              'w-full min-w-0 inline-flex items-center justify-center h-9 px-2.5 sm:px-3 rounded-[var(--radius-md)] border text-xs leading-none tabular-nums whitespace-nowrap transition-colors cursor-pointer overflow-hidden',
              isSelected
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] font-medium'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
            ].join(' ')}
          >
            <span
              ref={(el) => {
                labelRefs.current[idx] = el;
              }}
              className="whitespace-nowrap"
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

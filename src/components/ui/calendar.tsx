import { useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  INDONESIAN_MONTHS_LONG,
  INDONESIAN_MONTHS_SHORT,
  INDONESIAN_WEEKDAYS_MON_FIRST,
  INDONESIAN_WEEKDAYS_SUN_FIRST,
  buildCalendarMonthGrid,
  getTodayIsoDate,
  isDateDisabled,
  normalizeDateRangeSelection,
  parseIsoDate,
  shiftIsoDays,
  shiftMonth,
} from '../../lib/date-utils';

export interface DateRangeValue {
  start?: string;
  end?: string;
}

export interface CalendarProps {
  mode?: 'single' | 'range';
  value?: string;
  rangeValue?: DateRangeValue;
  onSelect?: (iso: string) => void;
  onRangeSelect?: (range: DateRangeValue) => void;
  minDate?: string;
  maxDate?: string;
  disabledDates?: readonly string[];
  weekStartsOn?: 0 | 1;
  clearable?: boolean;
  onClear?: () => void;
  className?: string;
}

type CalendarViewMode = 'days' | 'months' | 'years';

export function Calendar({
  mode = 'single',
  value,
  rangeValue,
  onSelect,
  onRangeSelect,
  minDate,
  maxDate,
  disabledDates,
  weekStartsOn = 1,
  clearable = false,
  onClear,
  className = '',
}: CalendarProps) {
  const todayIso = getTodayIsoDate();
  const initialRefIso =
    (mode === 'single' ? value : rangeValue?.start || rangeValue?.end) || todayIso;
  const initialParts = parseIsoDate(initialRefIso) ?? parseIsoDate(todayIso)!;

  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('days');
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [focusedIso, setFocusedIso] = useState<string>(() =>
    parseIsoDate(value)?.day ? value! : todayIso
  );

  const cells = useMemo(
    () =>
      buildCalendarMonthGrid({
        year: viewYear,
        month: viewMonth,
        weekStartsOn,
        todayIso,
        minDate,
        maxDate,
        disabledDates,
      }),
    [viewYear, viewMonth, weekStartsOn, todayIso, minDate, maxDate, disabledDates]
  );

  const weekdayLabels =
    weekStartsOn === 1 ? INDONESIAN_WEEKDAYS_MON_FIRST : INDONESIAN_WEEKDAYS_SUN_FIRST;

  const handleDaySelect = (iso: string, isCurrentMonth: boolean) => {
    if (isDateDisabled(iso, { minDate, maxDate, disabledDates })) return;

    const parts = parseIsoDate(iso);
    if (parts && !isCurrentMonth) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
    setFocusedIso(iso);

    if (mode === 'range') {
      const next = normalizeDateRangeSelection(rangeValue?.start, rangeValue?.end, iso);
      onRangeSelect?.(next);
      return;
    }

    onSelect?.(iso);
  };

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (viewMode !== 'days') return;
    let deltaDays = 0;
    if (event.key === 'ArrowLeft') deltaDays = -1;
    else if (event.key === 'ArrowRight') deltaDays = 1;
    else if (event.key === 'ArrowUp') deltaDays = -7;
    else if (event.key === 'ArrowDown') deltaDays = 7;

    if (deltaDays !== 0) {
      event.preventDefault();
      const nextIso = shiftIsoDays(focusedIso, deltaDays);
      setFocusedIso(nextIso);
      const nextParts = parseIsoDate(nextIso);
      if (nextParts && (nextParts.year !== viewYear || nextParts.month !== viewMonth)) {
        setViewYear(nextParts.year);
        setViewMonth(nextParts.month);
      }
      return;
    }

    if (event.key === 'PageUp') {
      event.preventDefault();
      const shifted = shiftMonth(viewYear, viewMonth, -1);
      setViewYear(shifted.year);
      setViewMonth(shifted.month);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      const shifted = shiftMonth(viewYear, viewMonth, 1);
      setViewYear(shifted.year);
      setViewMonth(shifted.month);
    }
  };

  const decadeStart = Math.floor(viewYear / 12) * 12;
  const yearOptions = Array.from({ length: 12 }, (_, idx) => decadeStart + idx);

  const todayDisabled = isDateDisabled(todayIso, { minDate, maxDate, disabledDates });

  const rangeStart = rangeValue?.start;
  const rangeEnd = rangeValue?.end;
  const previewEnd =
    mode === 'range' && rangeStart && !rangeEnd && hoverIso ? hoverIso : rangeEnd;
  const normalizedRangeLow =
    rangeStart && previewEnd ? (rangeStart <= previewEnd ? rangeStart : previewEnd) : rangeStart;
  const normalizedRangeHigh =
    rangeStart && previewEnd ? (rangeStart <= previewEnd ? previewEnd : rangeStart) : undefined;

  return (
    <div className={`w-[296px] max-w-full select-none ${className}`}>
      {/* Header Month/Year Navigation */}
      <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-[var(--border)]">
        <button
          type="button"
          aria-label={
            viewMode === 'years'
              ? 'Dekade sebelumnya'
              : viewMode === 'months'
                ? 'Tahun sebelumnya'
                : 'Bulan sebelumnya'
          }
          onClick={() => {
            if (viewMode === 'years') {
              setViewYear((y) => y - 12);
            } else if (viewMode === 'months') {
              setViewYear((y) => y - 1);
            } else {
              const prev = shiftMonth(viewYear, viewMonth, -1);
              setViewYear(prev.year);
              setViewMonth(prev.month);
            }
          }}
          className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'months' ? 'days' : 'months'))}
            className={[
              'px-2 py-1 rounded-[var(--radius-sm)] text-sm font-semibold transition-colors cursor-pointer',
              viewMode === 'months'
                ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/70',
            ].join(' ')}
          >
            {INDONESIAN_MONTHS_LONG[viewMonth - 1]}
          </button>
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'years' ? 'days' : 'years'))}
            className={[
              'px-2 py-1 rounded-[var(--radius-sm)] text-sm font-semibold tabular-nums transition-colors cursor-pointer',
              viewMode === 'years'
                ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/70',
            ].join(' ')}
          >
            {viewYear}
          </button>
        </div>

        <button
          type="button"
          aria-label={
            viewMode === 'years'
              ? 'Dekade berikutnya'
              : viewMode === 'months'
                ? 'Tahun berikutnya'
                : 'Bulan berikutnya'
          }
          onClick={() => {
            if (viewMode === 'years') {
              setViewYear((y) => y + 12);
            } else if (viewMode === 'months') {
              setViewYear((y) => y + 1);
            } else {
              const next = shiftMonth(viewYear, viewMonth, 1);
              setViewYear(next.year);
              setViewMonth(next.month);
            }
          }}
          className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      {viewMode === 'months' ? (
        <div className="grid grid-cols-3 gap-1.5 py-3">
          {INDONESIAN_MONTHS_SHORT.map((label, idx) => {
            const monthNum = idx + 1;
            const active = monthNum === viewMonth;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setViewMonth(monthNum);
                  setViewMode('days');
                }}
                className={[
                  'py-2.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors cursor-pointer',
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--surface-muted)]',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : viewMode === 'years' ? (
        <div className="grid grid-cols-3 gap-1.5 py-3">
          {yearOptions.map((yr) => {
            const active = yr === viewYear;
            return (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setViewYear(yr);
                  setViewMode('months');
                }}
                className={[
                  'py-2.5 rounded-[var(--radius-md)] text-xs font-medium tabular-nums transition-colors cursor-pointer',
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text)] hover:bg-[var(--surface-muted)]',
                ].join(' ')}
              >
                {yr}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pt-3" onKeyDown={handleGridKeyDown}>
          <div className="grid grid-cols-7 gap-0.5 mb-1.5" role="row">
            {weekdayLabels.map((day) => (
              <div
                key={day}
                className="h-7 flex items-center justify-center text-[11px] font-medium text-[var(--text-subtle)]"
              >
                {day}
              </div>
            ))}
          </div>

          <div
            role="grid"
            aria-label={`${INDONESIAN_MONTHS_LONG[viewMonth - 1]} ${viewYear}`}
            className="grid grid-cols-7 gap-0.5"
            onMouseLeave={() => setHoverIso(null)}
          >
            {cells.map((cell) => {
              const isSelectedSingle = mode === 'single' && value === cell.iso;
              const isRangeStart = mode === 'range' && normalizedRangeLow === cell.iso;
              const isRangeEnd = mode === 'range' && normalizedRangeHigh === cell.iso;
              const isSelected = isSelectedSingle || isRangeStart || isRangeEnd;
              const isInRange =
                mode === 'range' &&
                Boolean(normalizedRangeLow && normalizedRangeHigh) &&
                cell.iso > normalizedRangeLow! &&
                cell.iso < normalizedRangeHigh!;
              const isFocused = cell.iso === focusedIso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-disabled={cell.isDisabled || undefined}
                  aria-current={cell.isToday ? 'date' : undefined}
                  disabled={cell.isDisabled}
                  tabIndex={isFocused ? 0 : -1}
                  onMouseEnter={() => {
                    if (mode === 'range' && rangeStart && !rangeEnd && !cell.isDisabled) {
                      setHoverIso(cell.iso);
                    }
                  }}
                  onClick={() => handleDaySelect(cell.iso, cell.isCurrentMonth)}
                  className={[
                    'relative h-9 w-full flex items-center justify-center rounded-[var(--radius-md)] text-xs tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
                    cell.isDisabled
                      ? 'text-[var(--text-subtle)]/35 cursor-not-allowed'
                      : isSelected
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold cursor-pointer'
                        : isInRange
                          ? 'bg-[var(--surface-muted)] text-[var(--text)] font-medium rounded-none cursor-pointer'
                          : cell.isCurrentMonth
                            ? 'text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer'
                            : 'text-[var(--text-subtle)]/70 hover:bg-[var(--surface-muted)]/60 cursor-pointer',
                    cell.isToday && !isSelected
                      ? 'ring-1 ring-inset ring-[var(--border-strong)] font-semibold'
                      : '',
                  ].join(' ')}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Footer Actions */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          disabled={todayDisabled}
          onClick={() => {
            const parts = parseIsoDate(todayIso);
            if (parts) {
              setViewYear(parts.year);
              setViewMonth(parts.month);
              setViewMode('days');
            }
            handleDaySelect(todayIso, true);
          }}
          className="px-2 py-1 rounded-[var(--radius-sm)] font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Hari Ini
        </button>

        {clearable && onClear && (
          <button
            type="button"
            onClick={() => {
              onClear();
            }}
            className="px-2 py-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors cursor-pointer"
          >
            Kosongkan
          </button>
        )}
      </div>
    </div>
  );
}

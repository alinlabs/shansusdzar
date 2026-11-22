export const INDONESIAN_MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export const INDONESIAN_WEEKDAYS_MON_FIRST = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
export const INDONESIAN_WEEKDAYS_SUN_FIRST = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

export interface IsoDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export interface CalendarCell {
  iso: string;
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function parseIsoDate(iso: string | null | undefined): IsoDateParts | null {
  if (typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day > maxDay) return null;

  return { year, month, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(now: Date = new Date()): string {
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatDisplayDateId(
  iso: string | null | undefined,
  variant: 'short' | 'long' = 'long'
): string {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const monthName =
    variant === 'short'
      ? INDONESIAN_MONTHS_SHORT[parts.month - 1]
      : INDONESIAN_MONTHS_LONG[parts.month - 1];
  return `${parts.day} ${monthName} ${parts.year}`;
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateDisabled(
  iso: string,
  options?: {
    minDate?: string;
    maxDate?: string;
    disabledDates?: readonly string[];
  }
): boolean {
  if (!parseIsoDate(iso)) return true;
  if (options?.minDate && parseIsoDate(options.minDate) && iso < options.minDate) {
    return true;
  }
  if (options?.maxDate && parseIsoDate(options.maxDate) && iso > options.maxDate) {
    return true;
  }
  if (options?.disabledDates && options.disabledDates.includes(iso)) {
    return true;
  }
  return false;
}

export function shiftMonth(year: number, month: number, deltaMonths: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

export function shiftIsoDays(iso: string, deltaDays: number): string {
  const parts = parseIsoDate(iso);
  if (!parts) return getTodayIsoDate();
  const d = new Date(parts.year, parts.month - 1, parts.day + deltaDays);
  return formatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function buildCalendarMonthGrid(params: {
  year: number;
  month: number; // 1..12
  weekStartsOn?: 0 | 1;
  todayIso?: string;
  minDate?: string;
  maxDate?: string;
  disabledDates?: readonly string[];
}): CalendarCell[] {
  const {
    year,
    month,
    weekStartsOn = 1,
    todayIso = getTodayIsoDate(),
    minDate,
    maxDate,
    disabledDates,
  } = params;

  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 (Sun) .. 6 (Sat)
  const leadingDays = (firstDayOfMonth - weekStartsOn + 7) % 7;

  const prev = shiftMonth(year, month, -1);
  const prevDaysCount = getDaysInMonth(prev.year, prev.month);
  const currentDaysCount = getDaysInMonth(year, month);

  const cells: CalendarCell[] = [];

  for (let i = leadingDays - 1; i >= 0; i -= 1) {
    const day = prevDaysCount - i;
    const iso = formatIsoDate(prev.year, prev.month, day);
    cells.push({
      iso,
      year: prev.year,
      month: prev.month,
      day,
      isCurrentMonth: false,
      isToday: iso === todayIso,
      isDisabled: isDateDisabled(iso, { minDate, maxDate, disabledDates }),
    });
  }

  for (let day = 1; day <= currentDaysCount; day += 1) {
    const iso = formatIsoDate(year, month, day);
    cells.push({
      iso,
      year,
      month,
      day,
      isCurrentMonth: true,
      isToday: iso === todayIso,
      isDisabled: isDateDisabled(iso, { minDate, maxDate, disabledDates }),
    });
  }

  const next = shiftMonth(year, month, 1);
  let nextDay = 1;
  while (cells.length < 42) {
    const iso = formatIsoDate(next.year, next.month, nextDay);
    cells.push({
      iso,
      year: next.year,
      month: next.month,
      day: nextDay,
      isCurrentMonth: false,
      isToday: iso === todayIso,
      isDisabled: isDateDisabled(iso, { minDate, maxDate, disabledDates }),
    });
    nextDay += 1;
  }

  return cells;
}

export function normalizeDateRangeSelection(
  currentStart: string | undefined,
  currentEnd: string | undefined,
  clickedIso: string
): { start: string; end: string | undefined } {
  if (!currentStart || (currentStart && currentEnd)) {
    return { start: clickedIso, end: undefined };
  }
  if (clickedIso < currentStart) {
    return { start: clickedIso, end: currentStart };
  }
  return { start: currentStart, end: clickedIso };
}

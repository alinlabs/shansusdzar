import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarMonthGrid,
  formatDisplayDateId,
  formatIsoDate,
  isDateDisabled,
  normalizeDateRangeSelection,
  parseIsoDate,
  shiftMonth,
} from '../../src/lib/date-utils';

test('parseIsoDate validates real calendar dates and rejects invalid ones', () => {
  assert.deepEqual(parseIsoDate('2026-11-21'), { year: 2026, month: 11, day: 21 });
  assert.deepEqual(parseIsoDate('2024-02-29'), { year: 2024, month: 2, day: 29 }); // leap year
  assert.equal(parseIsoDate('2025-02-29'), null); // non-leap year
  assert.equal(parseIsoDate('2026-13-01'), null);
  assert.equal(parseIsoDate('invalid'), null);
  assert.equal(parseIsoDate(''), null);
});

test('formatDisplayDateId renders clean Indonesian dates', () => {
  assert.equal(formatDisplayDateId('2026-11-21', 'long'), '21 November 2026');
  assert.equal(formatDisplayDateId('2026-08-05', 'short'), '5 Agu 2026');
  assert.equal(formatDisplayDateId('bad-date'), '');
});

test('buildCalendarMonthGrid always outputs 42 cells with outside-month days and disabled bounds', () => {
  const grid = buildCalendarMonthGrid({
    year: 2026,
    month: 11,
    weekStartsOn: 1,
    todayIso: '2026-11-21',
    minDate: '2026-11-05',
    maxDate: '2026-11-25',
  });
  assert.equal(grid.length, 42);
  // Nov 1, 2026 is Sunday -> with Monday-first, leading days = 6 (Oct 26..31)
  assert.equal(grid[0].iso, '2026-10-26');
  assert.equal(grid[0].isCurrentMonth, false);
  assert.equal(grid[6].iso, '2026-11-01');
  assert.equal(grid[6].isCurrentMonth, true);
  assert.equal(grid[6].isDisabled, true);

  const todayCell = grid.find((c) => c.iso === '2026-11-21');
  assert.ok(todayCell);
  assert.equal(todayCell.isToday, true);
  assert.equal(todayCell.isDisabled, false);
});

test('shiftMonth wraps years properly', () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.equal(formatIsoDate(2026, 3, 7), '2026-03-07');
});

test('normalizeDateRangeSelection swaps reversed range clicks cleanly', () => {
  assert.deepEqual(normalizeDateRangeSelection(undefined, undefined, '2026-11-10'), {
    start: '2026-11-10',
    end: undefined,
  });
  assert.deepEqual(normalizeDateRangeSelection('2026-11-15', undefined, '2026-11-10'), {
    start: '2026-11-10',
    end: '2026-11-15',
  });
  assert.deepEqual(normalizeDateRangeSelection('2026-11-10', '2026-11-15', '2026-11-20'), {
    start: '2026-11-20',
    end: undefined,
  });
  assert.equal(isDateDisabled('2026-11-10', { disabledDates: ['2026-11-10'] }), true);
});

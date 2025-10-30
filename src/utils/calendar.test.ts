import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addMonths, createCalendarCells, formatMonthKey, getVisibleRange, parseMonthKey } from './calendar';

describe('calendar utilities', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses valid month keys as the first day of that month in UTC', () => {
    const date = parseMonthKey('2030-05');
    expect(date.toISOString()).toBe('2030-05-01T00:00:00.000Z');
  });

  it('falls back to the current month when parsing invalid keys', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2032, 6, 15)));

    const date = parseMonthKey('not-a-month');
    expect(date.toISOString()).toBe('2032-07-01T00:00:00.000Z');
  });

  it('builds calendar cells with leading placeholders respecting the first day of week', () => {
    const monthDate = new Date(Date.UTC(2030, 0, 1));
    const cells = createCalendarCells(monthDate, 1);

    expect(cells).toHaveLength(35);
    expect(cells[0].isoDate).toBe('2029-12-31');
    expect(cells[0].inCurrentMonth).toBe(false);
    expect(cells[1].isoDate).toBe('2030-01-01');
    expect(cells[1].inCurrentMonth).toBe(true);
    expect(cells[cells.length - 1].isoDate).toBe('2030-02-02');
  });

  it('returns a visible range with cloned boundary dates', () => {
    const monthDate = new Date(Date.UTC(2030, 0, 1));
    const cells = createCalendarCells(monthDate, 0);
    const range = getVisibleRange(cells);

    expect(range).not.toBeNull();
    const { start, end } = range!;
    expect(start.toISOString()).toBe(cells[0].isoDate.concat('T00:00:00.000Z'));
    expect(end.toISOString()).toBe(cells[cells.length - 1].isoDate.concat('T00:00:00.000Z'));

    const originalStartTime = cells[0].date.getTime();
    start.setUTCDate(start.getUTCDate() + 1);
    expect(cells[0].date.getTime()).toBe(originalStartTime);
  });

  it('adds months using UTC boundaries', () => {
    const january = new Date(Date.UTC(2030, 0, 1));
    expect(formatMonthKey(addMonths(january, 2))).toBe('2030-03');

    const december = new Date(Date.UTC(2030, 11, 1));
    expect(formatMonthKey(addMonths(december, 1))).toBe('2031-01');
  });

  it('formats month keys with a leading zeroed month', () => {
    expect(formatMonthKey(new Date(Date.UTC(2030, 0, 1)))).toBe('2030-01');
    expect(formatMonthKey(new Date(Date.UTC(2030, 9, 1)))).toBe('2030-10');
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  nowIso,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatDueDate,
  formatFileSize,
  toLocalDateString,
  todayDateString,
  getDueDateStatus,
} from './dateFormat';

describe('formatTimestamp', () => {
  it('returns the original string unchanged for unparseable input', () => {
    expect(formatTimestamp('not a date')).toBe('not a date');
    expect(formatTimestamp('')).toBe('');
  });

  it('renders a valid ISO timestamp into a human string containing the year', () => {
    const out = formatTimestamp('2026-03-15T14:30:00Z');
    expect(out).not.toBe('2026-03-15T14:30:00Z');
    expect(out).toContain('2026');
  });
});

describe('nowIso', () => {
  it('returns a parseable ISO-8601 string ending in Z', () => {
    const iso = nowIso();
    expect(iso.endsWith('Z')).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

describe('toDatetimeLocalValue', () => {
  it('returns an empty string for an invalid date', () => {
    expect(toDatetimeLocalValue('garbage')).toBe('');
  });

  it('produces a value in the YYYY-MM-DDTHH:mm shape', () => {
    const value = toDatetimeLocalValue('2026-03-15T14:30:00Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('zero-pads single-digit months, days, hours, and minutes', () => {
    // Build from a local date so the test is timezone-independent.
    const local = new Date(2026, 0, 5, 3, 7); // Jan 5 2026, 03:07 local
    const value = toDatetimeLocalValue(local.toISOString());
    expect(value).toBe('2026-01-05T03:07');
  });
});

describe('datetime-local round trip', () => {
  it('toDatetimeLocalValue(fromDatetimeLocalValue(x)) === x', () => {
    for (const v of ['2026-03-15T14:30', '2026-01-05T03:07', '1999-12-31T23:59']) {
      expect(toDatetimeLocalValue(fromDatetimeLocalValue(v))).toBe(v);
    }
  });

  it('fromDatetimeLocalValue yields a valid ISO string', () => {
    const iso = fromDatetimeLocalValue('2026-03-15T14:30');
    expect(iso.endsWith('Z')).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });

  // fromDatetimeLocalValue must not throw on empty/invalid input — it falls back to
  // '' like its sibling toDatetimeLocalValue, rather than letting toISOString throw.
  it('does not throw on empty input', () => {
    expect(() => fromDatetimeLocalValue('')).not.toThrow();
    expect(fromDatetimeLocalValue('')).toBe('');
    expect(fromDatetimeLocalValue('garbage')).toBe('');
  });
});

describe('formatDueDate', () => {
  it('formats a YYYY-MM-DD string into a human string with the year', () => {
    const out = formatDueDate('2026-03-15');
    expect(out).toContain('2026');
    expect(out).not.toBe('2026-03-15');
  });

  it('parses the date in local time (no off-by-one from UTC)', () => {
    // 2026-03-15 must render as the 15th, not the 14th, regardless of timezone.
    const out = formatDueDate('2026-03-15');
    expect(out).toMatch(/15/);
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatDueDate('')).toBe('');
    expect(formatDueDate('nope')).toBe('nope');
  });
});

describe('toLocalDateString / todayDateString', () => {
  it('formats a date from its LOCAL calendar parts, zero-padded', () => {
    // Constructed in local time, so the output is timezone-independent.
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 8, 3))).toBe('2026-09-03');
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('does not shift the day across a UTC boundary (uses local, not toISOString)', () => {
    // Late-evening local time would roll over to the next UTC day; the local-parts
    // formatter must still report the local day.
    const lateLocal = new Date(2026, 2, 15, 23, 30); // Mar 15 2026, 23:30 local
    expect(toLocalDateString(lateLocal)).toBe('2026-03-15');
  });

  it('todayDateString matches the local parts of the current date', () => {
    const now = new Date();
    expect(todayDateString()).toBe(toLocalDateString(now));
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatFileSize', () => {
  it('formats bytes below 1 KB as whole bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes with one decimal', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('uses KB right up to the 1 MB boundary', () => {
    expect(formatFileSize(1024 * 1024 - 1)).toContain('KB');
  });
});

describe('getDueDateStatus', () => {
  it('returns "overdue" for a date before today', () => {
    const result = getDueDateStatus('2026-01-01');
    expect(result).toEqual({ label: 'OVERDUE', className: 'overdue' });
  });

  it('returns "today" for today', () => {
    const today = todayDateString();
    const result = getDueDateStatus(today);
    expect(result).toEqual({ label: 'TODAY', className: 'today' });
  });

  it('returns "week" for a date within 7 days from today', () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const dateStr = toLocalDateString(d);
    const result = getDueDateStatus(dateStr);
    expect(result).toEqual({ label: 'DUE SOON', className: 'week' });
  });

  it('returns "future" with no label for dates beyond 7 days', () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const dateStr = toLocalDateString(d);
    const result = getDueDateStatus(dateStr);
    expect(result).toEqual({ label: null, className: 'future' });
  });
});

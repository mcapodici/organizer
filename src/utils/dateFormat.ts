export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Compare two ISO timestamps chronologically. Parses to epoch milliseconds so
// mixed timezone offsets and precision (common in imported data) order by the
// instant they represent rather than by raw string bytes. Returns 0 for equal
// instants so callers keep their stable (insertion) order on ties. Falls back
// to a lexical compare only when a value can't be parsed as a date.
export function compareTimestamps(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!isNaN(ta) && !isNaN(tb)) {
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }
  return a.localeCompare(b);
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

// Local calendar date as YYYY-MM-DD. Due dates are written from local time (see
// DueDatePopover), so "today" and relative cutoffs must use local parts too —
// using a UTC date here would be off by a day near midnight in non-UTC zones.
export function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayDateString(): string {
  return toLocalDateString(new Date());
}

export function formatDueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DueDateStatus {
  label: 'OVERDUE' | 'TODAY' | 'DUE SOON' | null;
  className: 'overdue' | 'today' | 'week' | 'future';
}

export function getDueDateStatus(dueDate: string): DueDateStatus {
  const today = todayDateString();
  if (dueDate < today) {
    return { label: 'OVERDUE', className: 'overdue' };
  }
  if (dueDate === today) {
    return { label: 'TODAY', className: 'today' };
  }
  // Check if due within 7 days (inclusive of today+1 through today+7)
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const in7Days = toLocalDateString(d);
  if (dueDate <= in7Days) {
    return { label: 'DUE SOON', className: 'week' };
  }
  return { label: null, className: 'future' };
}

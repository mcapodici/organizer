import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2 } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import type { Entry, Timeline } from '../../types';
import { formatDueDate, toLocalDateString, todayDateString, getDueDateStatus } from '../../utils/dateFormat';
import { DueDatePopover } from '../DueDatePopover/DueDatePopover';
import styles from './TodoPage.module.css';

interface TodoItem {
  entry: Entry;
  timeline: Timeline | undefined;
}

interface Sections {
  overdue: TodoItem[];
  today: TodoItem[];
  week: TodoItem[];
  month: TodoItem[];
  later: TodoItem[];
}

function buildSections(todos: TodoItem[]): Sections {
  const todayStr = todayDateString();

  const d7 = new Date();
  d7.setDate(d7.getDate() + 7);
  const in7 = toLocalDateString(d7);

  const d30 = new Date();
  d30.setDate(d30.getDate() + 30);
  const in30 = toLocalDateString(d30);

  const result: Sections = { overdue: [], today: [], week: [], month: [], later: [] };

  for (const item of todos) {
    const due = item.entry.dueDate!;
    if (due < todayStr) result.overdue.push(item);
    else if (due === todayStr) result.today.push(item);
    else if (due <= in7) result.week.push(item);
    else if (due <= in30) result.month.push(item);
    else result.later.push(item);
  }

  // Sort each section by dueDate ascending (soonest/most-overdue first)
  for (const key of Object.keys(result) as (keyof Sections)[]) {
    result[key].sort((a, b) => a.entry.dueDate!.localeCompare(b.entry.dueDate!));
  }

  return result;
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || '';
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join('');
  }
  return '';
}

function entryPreview(content: string): string {
  try {
    const json = JSON.parse(content);
    return extractText(json).slice(0, 120);
  } catch {
    return content.slice(0, 120);
  }
}

interface Props {
  onEntryChanged: () => void;
}

export function TodoPage({ onEntryChanged }: Props) {
  const { adapter } = useStorage();
  const navigate = useNavigate();
  const [sections, setSections] = useState<Sections>({ overdue: [], today: [], week: [], month: [], later: [] });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [allEntries, allTimelines] = await Promise.all([
      adapter.getAllEntries(),
      adapter.getAllTimelines(),
    ]);
    const timelinesById = new Map(allTimelines.map((t) => [t.id, t]));
    const todos: TodoItem[] = allEntries
      .filter((e) => e.dueDate && !e.isDone)
      .map((e) => ({ entry: e, timeline: timelinesById.get(e.timelineId) }));
    setSections(buildSections(todos));
    setLoading(false);
  }, [adapter]);

  useEffect(() => { reload(); }, [reload]);

  async function handleToggle(entry: Entry) {
    await adapter.putEntry({ ...entry, isDone: true });
    onEntryChanged();
    await reload();
  }

  async function handleUpdate(entry: Entry) {
    await adapter.putEntry(entry);
    onEntryChanged();
    await reload();
  }

  function goToTimeline(timelineId: string, entryId: string) {
    navigate(`/timelines/${timelineId}`, { state: { scrollToEntryId: entryId } });
  }

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { overdue, today, week, month, later } = sections;
  const isEmpty = !overdue.length && !today.length && !week.length && !month.length && !later.length;

  if (isEmpty) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <div className={styles.emptyIcon}><CheckCircle2 size={44} /></div>
          <h2 className={styles.emptyHeading}>All caught up!</h2>
          <p className={styles.emptyText}>No pending todos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Todos</h1>
      {overdue.length > 0 && (
        <TodoSection title="Overdue" items={overdue} variant="overdue" onToggle={handleToggle} onUpdate={handleUpdate} onGoToTimeline={goToTimeline} />
      )}
      {today.length > 0 && (
        <TodoSection title="Due Today" items={today} variant="today" onToggle={handleToggle} onUpdate={handleUpdate} onGoToTimeline={goToTimeline} />
      )}
      {week.length > 0 && (
        <TodoSection title="Due Within 7 Days" items={week} variant="soon" onToggle={handleToggle} onUpdate={handleUpdate} onGoToTimeline={goToTimeline} />
      )}
      {month.length > 0 && (
        <TodoSection title="Due Within 30 Days" items={month} variant="normal" onToggle={handleToggle} onUpdate={handleUpdate} onGoToTimeline={goToTimeline} />
      )}
      {later.length > 0 && (
        <TodoSection title="Due Later" items={later} variant="normal" onToggle={handleToggle} onUpdate={handleUpdate} onGoToTimeline={goToTimeline} />
      )}
    </div>
  );
}

function TodoSection({
  title,
  items,
  variant,
  onToggle,
  onUpdate,
  onGoToTimeline,
}: {
  title: string;
  items: TodoItem[];
  variant: 'overdue' | 'today' | 'soon' | 'normal';
  onToggle: (entry: Entry) => void;
  onUpdate: (entry: Entry) => void | Promise<void>;
  onGoToTimeline: (timelineId: string, entryId: string) => void;
}) {
  return (
    <section className={styles.section}>
      <h2 className={`${styles.sectionTitle} ${styles[variant]}`}>{title}</h2>
      <div className={styles.list}>
        {items.map(({ entry, timeline }) => (
          <TodoRow
            key={entry.id}
            entry={entry}
            timeline={timeline}
            variant={variant}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onGoToTimeline={onGoToTimeline}
          />
        ))}
      </div>
    </section>
  );
}

function TodoRow({
  entry,
  timeline,
  variant,
  onToggle,
  onUpdate,
  onGoToTimeline,
}: {
  entry: Entry;
  timeline: Timeline | undefined;
  variant: 'overdue' | 'today' | 'soon' | 'normal';
  onToggle: (entry: Entry) => void;
  onUpdate: (entry: Entry) => void | Promise<void>;
  onGoToTimeline: (timelineId: string, entryId: string) => void;
}) {
  const [dueAnchor, setDueAnchor] = useState<DOMRect | null>(null);

  return (
    <div className={styles.todoCard}>
      <button
        className={styles.checkBtn}
        onClick={() => onToggle(entry)}
        type="button"
        title="Mark as done"
        aria-label="Mark as done"
      >
        <Check size={12} className={styles.checkIcon} />
      </button>
      <div
        className={styles.cardBody}
        onClick={() => onGoToTimeline(entry.timelineId, entry.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onGoToTimeline(entry.timelineId, entry.id); }}
      >
        <div className={styles.cardText}>{entryPreview(entry.content)}</div>
        <div className={styles.cardMeta}>
          {timeline && <span className={styles.timelineChip}>{timeline.name}</span>}
          <button
            type="button"
            className={styles.dueDate}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setDueAnchor((prev) => prev ? null : rect);
            }}
            title="Edit due date"
          >
            {!entry.isDone && (() => {
              const status = getDueDateStatus(entry.dueDate!);
              return status.label ? (
                <span className={`${styles.dueStatus} ${styles['dueStatus' + capitalize(status.className)]}`}>
                  {status.label}
                </span>
              ) : null;
            })()}
            <span className={styles.dueDateText}>{formatDueDate(entry.dueDate!)}</span>
          </button>
          {dueAnchor && (
            <DueDatePopover
              entry={entry}
              anchorRect={dueAnchor}
              onUpdate={onUpdate}
              onClose={() => setDueAnchor(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

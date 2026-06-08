import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { Entry } from '../../types';
import styles from './DueDatePopover.module.css';

interface Props {
  entry: Entry;
  anchorRect: DOMRect;
  onUpdate: (entry: Entry) => void | Promise<void>;
  onClose: () => void;
}

const POPOVER_WIDTH = 240;
const GAP = 6;
const EDGE = 8;

function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function DueDatePopover({ entry, anchorRect, onUpdate, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => computePosition(anchorRect, 0));

  // Recompute once we know the popover's real height so it can flip above the
  // anchor when there isn't enough room below.
  useLayoutEffect(() => {
    if (!ref.current) return;
    setPosition(computePosition(anchorRect, ref.current.offsetHeight));
  }, [anchorRect]);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleScroll() { onClose(); }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [onClose]);

  async function setDate(value: string) {
    await onUpdate({ ...entry, dueDate: value });
    onClose();
  }

  async function toggleDone() {
    await onUpdate({ ...entry, isDone: !entry.isDone });
    onClose();
  }

  async function removeDate() {
    await onUpdate({ ...entry, dueDate: undefined, isDone: undefined });
    onClose();
  }

  const today = new Date();
  const todayStr = toLocalDateString(today);
  const isToday = entry.dueDate === todayStr;
  const tomorrowStr = toLocalDateString(addDays(today, 1));
  const isTomorrow = entry.dueDate === tomorrowStr;
  const weekStr = toLocalDateString(addDays(today, 7));
  const isWeek = entry.dueDate === weekStr;

  return createPortal(
    <div
      ref={ref}
      className={styles.popover}
      role="dialog"
      aria-label="Edit due date"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.quickRow}>
        <button
          type="button"
          className={`${styles.quickBtn} ${isToday ? styles.quickBtnActive : ''}`}
          onClick={() => setDate(todayStr)}
        >
          Today
        </button>
        <button
          type="button"
          className={`${styles.quickBtn} ${isTomorrow ? styles.quickBtnActive : ''}`}
          onClick={() => setDate(tomorrowStr)}
        >
          Tomorrow
        </button>
        <button
          type="button"
          className={`${styles.quickBtn} ${isWeek ? styles.quickBtnActive : ''}`}
          onClick={() => setDate(weekStr)}
        >
          Next Week
        </button>
      </div>

      <input
        type="date"
        value={entry.dueDate ?? ''}
        onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
        className={styles.dateInput}
      />

      <div className={styles.footer}>
        <button type="button" className={styles.doneBtn} onClick={toggleDone}>
          <Check size={14} />
          {entry.isDone ? 'Mark not done' : 'Mark done'}
        </button>
        <button type="button" className={styles.removeBtn} onClick={removeDate}>
          <X size={14} />
          Remove
        </button>
      </div>
    </div>,
    document.body,
  );
}

function computePosition(anchor: DOMRect, popoverHeight: number) {
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  // Vertical: prefer below, flip above if it'd overflow.
  let top = anchor.bottom + GAP;
  if (popoverHeight && top + popoverHeight > viewportH - EDGE) {
    const flipped = anchor.top - GAP - popoverHeight;
    if (flipped >= EDGE) top = flipped;
  }

  // Horizontal: right-aligned with the anchor, clamped to the viewport.
  let left = anchor.right - POPOVER_WIDTH;
  if (left < EDGE) left = EDGE;
  if (left + POPOVER_WIDTH > viewportW - EDGE) left = viewportW - POPOVER_WIDTH - EDGE;

  return { top, left };
}

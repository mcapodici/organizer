import { useEffect, useRef, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import type { PendingUndo } from '../../context/UndoContext';
import styles from './UndoBar.module.css';

interface Props {
  pending: PendingUndo | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * Single-slot undo bar. The provider remounts this per registration (via a key
 * on pending.id), so the countdown starts fresh without syncing state in an
 * effect. Expiry itself is owned by the provider's timeout — the countdown is
 * display only, and is aria-hidden so a polite live region isn't re-announced
 * every second.
 */
export function UndoBar({ pending, onUndo, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const undoRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pending]);

  // Move keyboard focus onto Undo as soon as the bar appears, so a keyboard
  // user can reach it within the 10s window (UI_STANDARDS #2) instead of
  // having focus dropped to <body>. The provider remounts this per
  // registration, so this runs once per undoable action.
  useEffect(() => {
    if (pending) undoRef.current?.focus();
  }, [pending]);

  if (!pending) return null;

  const secondsLeft = Math.max(0, Math.ceil((pending.expiresAt - now) / 1000));

  return (
    <div className={styles.bar}>
      <span className={styles.icon}><Undo2 size={16} /></span>
      <span className={styles.label} role="status">{pending.label}</span>
      <span className={styles.countdown} aria-hidden="true">{secondsLeft}s</span>
      <button type="button" className={styles.undoBtn} onClick={onUndo} ref={undoRef}>
        Undo
      </button>
      <button type="button" className={styles.dismissBtn} onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

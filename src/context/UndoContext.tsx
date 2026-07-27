import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UndoBar } from '../components/UndoBar/UndoBar';

/** How long an undoable todo change stays undoable — see issue #14. */
export const UNDO_WINDOW_MS = 10_000;

export interface PendingUndo {
  id: number;
  label: string;
  expiresAt: number;
  undo: () => void | Promise<void>;
}

interface UndoCtxValue {
  registerUndo: (label: string, undo: () => void | Promise<void>) => void;
}

const UndoContext = createContext<UndoCtxValue | null>(null);

// UndoProvider is an app-root provider like StorageProvider, so losing fast
// refresh for this file is not worth splitting the hook into its own module.
// eslint-disable-next-line react-refresh/only-export-components
export function useUndo(): UndoCtxValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be inside UndoProvider');
  return ctx;
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  const clearUndo = useCallback(() => {
    clearTimer();
    setPending(null);
  }, []);

  // A new undoable change supersedes the pending one: the earlier action stays
  // committed and simply stops being undoable, and the new one gets a full
  // fresh window (issue #14).
  const registerUndo = useCallback((label: string, undo: () => void | Promise<void>) => {
    clearTimer();
    seqRef.current += 1;
    setPending({ id: seqRef.current, label, expiresAt: Date.now() + UNDO_WINDOW_MS, undo });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPending(null);
    }, UNDO_WINDOW_MS);
  }, []);

  useEffect(() => clearTimer, []);

  // Clear first so a double click can't run the same undo twice.
  const handleUndo = useCallback(async () => {
    const current = pending;
    if (!current) return;
    clearUndo();
    await current.undo();
  }, [pending, clearUndo]);

  return (
    <UndoContext.Provider value={{ registerUndo }}>
      {children}
      <UndoBar
        key={pending?.id ?? 'none'}
        pending={pending}
        onUndo={() => { void handleUndo(); }}
        onDismiss={clearUndo}
      />
    </UndoContext.Provider>
  );
}

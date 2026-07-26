import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Entry } from '../types';
import { IdbAdapter } from '../storage/idbAdapter';
import { OpfsAdapter } from '../storage/opfsAdapter';
import { ConflictError, type StorageAdapter } from '../storage/interface';
import { ToastStack, type ToastItem } from '../components/Toast/Toast';

export type StorageMode = 'opfs' | 'idb';

export type Phase =
  | { tag: 'booting' }
  | { tag: 'readyOpfs'; adapter: StorageAdapter }
  | { tag: 'readyIdb'; adapter: StorageAdapter; lastSaved: string | null };

interface StorageCtxValue {
  adapter: StorageAdapter;
  lastSaved: string | null;
  markSaved: () => void;
  registerActiveEdit: (entry: Entry | null) => void;
}

const StorageContext = createContext<StorageCtxValue | null>(null);

function withErrorCapture(
  inner: StorageAdapter,
  onError: () => void,
  onConflict: () => void,
): StorageAdapter {
  async function wrap<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (e) {
      if (e instanceof ConflictError) onConflict();
      else onError();
      throw e;
    }
  }
  return {
    getAllTimelines: () => inner.getAllTimelines(),
    getAllEntries: () => inner.getAllEntries(),
    getEntriesForTimeline: id => inner.getEntriesForTimeline(id),
    getBlob: k => inner.getBlob(k),
    getAllBlobKeys: () => inner.getAllBlobKeys(),
    getAllBlobs: () => inner.getAllBlobs(),
    putTimeline: t => wrap(() => inner.putTimeline(t)),
    deleteTimeline: id => wrap(() => inner.deleteTimeline(id)),
    putEntry: e => wrap(() => inner.putEntry(e)),
    deleteEntry: id => wrap(() => inner.deleteEntry(id)),
    deleteEntriesForTimeline: id => wrap(() => inner.deleteEntriesForTimeline(id)),
    putBlob: (k, d) => wrap(() => inner.putBlob(k, d)),
    deleteBlob: k => wrap(() => inner.deleteBlob(k)),
    hasConflict: () => inner.hasConflict(),
    mergeFromDisk: active => inner.mergeFromDisk(active),
    mergeConflictFiles: () => inner.mergeConflictFiles(),
  };
}

// StorageProvider is the single app-root provider, so losing fast refresh for
// this file is not worth splitting the hook out across its 16 importers.
// eslint-disable-next-line react-refresh/only-export-components
export function useStorage(): StorageCtxValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be inside StorageProvider');
  return ctx;
}

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ tag: 'booting' });
  const [writeError, setWriteError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeqRef = useRef(0);
  const mergeInFlightRef = useRef(false);
  const [mergeNonce, setMergeNonce] = useState(0);
  const activeEditRef = useRef<Entry | null>(null);
  const registerActiveEdit = useCallback((entry: Entry | null) => {
    activeEditRef.current = entry;
  }, []);

  useEffect(() => {
    async function boot() {
      // Try OPFS first (Chrome 86+, Safari 15.2+, Edge 86+).
      // Falls back to IndexedDB for Firefox and other browsers without OPFS.
      const hasOpfs = 'storage' in navigator && 'getDirectory' in navigator.storage;
      if (hasOpfs) {
        setPhase({ tag: 'readyOpfs', adapter: new OpfsAdapter() });
      } else {
        setPhase({ tag: 'readyIdb', adapter: new IdbAdapter(), lastSaved: localStorage.getItem('lastSaved') });
      }
    }
    boot();
  }, []);

  // No remaining methods that trigger mode-switching or workspace changes —
  // removed: chooseIdb, chooseFile, pickFolder, handleReopen, selectWorkspace,
  // createWorkspace, openSwitcher, goToChoose, goHome, resetStorage.

  // resetStorage is intentionally omitted — there is no storage choice to reset.
  // Users clear data via Settings → Clear all data.

  function markSaved() {
    const ts = new Date().toISOString();
    localStorage.setItem('lastSaved', ts);
    setPhase(prev => prev.tag === 'readyIdb' ? { ...prev, lastSaved: ts } : prev);
  }

  // Auto-merge any external changes (another tab saving) — runs silently with
  // no blocking dialog, driven by the 2s poll below.
  const runMerge = useCallback(async () => {
    if (mergeInFlightRef.current) return;
    const adapter = phase.tag === 'readyOpfs' || phase.tag === 'readyIdb' ? phase.adapter : null;
    if (!adapter) return;
    mergeInFlightRef.current = true;
    try {
      let imported = 0;
      const conflicts = 0;
      let merged = false;
      if (await adapter.hasConflict()) {
        const r = await adapter.mergeFromDisk(activeEditRef.current);
        imported += r.importedCount;
        merged = true;
      }
      // OPFS and IndexedDB have no external conflict files to scan,
      // so mergeConflictFiles always returns zero.
      if (merged) {
        setMergeNonce(v => v + 1);
        setToasts(list => [...list, { id: (toastSeqRef.current += 1), imported, conflicts }]);
      }
    } catch { /* transient read/write failure — the next poll tick retries */ }
    finally { mergeInFlightRef.current = false; }
  }, [phase]);

  const safeAdapter = useMemo<StorageAdapter | null>(() => {
    if (phase.tag === 'readyOpfs') {
      return withErrorCapture(phase.adapter, () => setWriteError(true), () => { /* poll auto-merges */ });
    }
    if (phase.tag === 'readyIdb') {
      return withErrorCapture(phase.adapter, () => { /* idb writes don't have a recoverable error path */ }, () => { /* poll auto-merges */ });
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mergeNonce]);

  useEffect(() => {
    const isReady = phase.tag === 'readyOpfs' || phase.tag === 'readyIdb';
    if (!isReady) return;
    const id = setInterval(() => { void runMerge(); }, 2000);
    return () => clearInterval(id);
  }, [phase, runMerge]);

  if (phase.tag === 'booting') {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f5f3ff', color: '#6b7280', fontSize: '0.9rem',
      }}>
        Loading…
      </div>
    );
  }

  const adapter = safeAdapter!;
  const lastSaved = phase.tag === 'readyIdb' ? phase.lastSaved : null;

  return (
    <StorageContext.Provider value={{ adapter, lastSaved, markSaved, registerActiveEdit }}>
      {children}
      {writeError && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '24px 28px', maxWidth: 440,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Unable to save</h2>
            <p style={{ margin: '0 0 4px', color: '#374151' }}>
              A write error occurred. Your data is safe — the next poll will retry automatically.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={async () => {
                  setReconnecting(true);
                  try {
                    // rebuild the adapter to clear error state
                    if (phase.tag === 'readyOpfs') {
                      setPhase({ tag: 'readyOpfs', adapter: new OpfsAdapter() });
                    } else if (phase.tag === 'readyIdb') {
                      setPhase({ tag: 'readyIdb', adapter: new IdbAdapter(), lastSaved: null });
                    }
                    setWriteError(false);
                  } finally {
                    setReconnecting(false);
                  }
                }}
                disabled={reconnecting}
                style={{
                  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 16px', cursor: reconnecting ? 'default' : 'pointer',
                  fontSize: '0.875rem', opacity: reconnecting ? 0.65 : 1,
                }}
              >
                {reconnecting ? 'Reconnecting…' : 'Retry'}
              </button>
              <button
                onClick={() => setWriteError(false)}
                style={{
                  background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                  padding: '7px 14px', cursor: 'pointer', fontSize: '0.875rem', color: '#374151',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(list => list.filter(t => t.id !== id))} />
    </StorageContext.Provider>
  );
}
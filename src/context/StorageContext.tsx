import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { IdbAdapter } from '../storage/idbAdapter';
import { OpfsAdapter } from '../storage/opfsAdapter';
import type { StorageAdapter } from '../storage/interface';
import { createChangeChannel } from '../storage/changeChannel';
import { ToastStack, type ToastItem } from '../components/Toast/Toast';

export type Phase =
  | { tag: 'booting' }
  | { tag: 'readyOpfs'; adapter: StorageAdapter }
  | { tag: 'readyIdb'; adapter: StorageAdapter };

interface StorageCtxValue {
  adapter: StorageAdapter;
  lastSaved: string | null;
  markSaved: () => void;
  notifyMergedCopy: () => void;
}

const StorageContext = createContext<StorageCtxValue | null>(null);

function withWriteTracking(
  inner: StorageAdapter,
  onError: () => void,
  onWrite: () => void,
): StorageAdapter {
  async function wrap<T>(fn: () => Promise<T>): Promise<T> {
    let result: T;
    try { result = await fn(); }
    catch (e) {
      onError();
      throw e;
    }
    onWrite();
    return result;
  }
  return {
    getAllTimelines: () => inner.getAllTimelines(),
    getAllEntries: () => inner.getAllEntries(),
    getEntry: id => inner.getEntry(id),
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
    refresh: () => inner.refresh(),
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
  const [lastSaved, setLastSaved] = useState(() => localStorage.getItem('lastSaved'));
  const [storeVersion, setStoreVersion] = useState(0);
  // One handle for the life of the provider. It re-opens itself after the
  // subscribe effect below closes it, so a StrictMode remount is harmless.
  const [channel] = useState(createChangeChannel);

  const notifyMergedCopy = useCallback(() => {
    setToasts(list => [...list, { id: (toastSeqRef.current += 1) }]);
  }, []);

  useEffect(() => {
    async function boot() {
      // Try OPFS first (Chrome 86+, Safari 15.2+, Edge 86+).
      // Falls back to IndexedDB for Firefox and other browsers without OPFS.
      const hasOpfs = 'storage' in navigator && 'getDirectory' in navigator.storage;
      if (hasOpfs) {
        setPhase({ tag: 'readyOpfs', adapter: new OpfsAdapter() });
      } else {
        setPhase({ tag: 'readyIdb', adapter: new IdbAdapter() });
      }
    }
    boot();
  }, []);

  function markSaved() {
    const ts = new Date().toISOString();
    localStorage.setItem('lastSaved', ts);
    setLastSaved(ts);
  }

  // Pull in whatever another tab wrote. Bumping storeVersion is what makes the
  // hooks re-read — see the safeAdapter memo below.
  const refreshFromStore = useCallback(async () => {
    const adapter = phase.tag === 'readyOpfs' || phase.tag === 'readyIdb' ? phase.adapter : null;
    if (!adapter) return;
    try {
      await adapter.refresh();
      setStoreVersion(v => v + 1);
    } catch { /* transient read failure — the next message or focus retries */ }
  }, [phase]);

  // A new adapter *object* is what re-runs the useCallback-memoized reload() in
  // useEntries / useTimelines / useTodoCounts, so bumping storeVersion here is
  // how a cross-tab change reaches the UI. Don't "clean up" this dependency list.
  const safeAdapter = useMemo<StorageAdapter | null>(() => {
    if (phase.tag === 'readyOpfs') {
      return withWriteTracking(phase.adapter, () => setWriteError(true), () => channel.post());
    }
    if (phase.tag === 'readyIdb') {
      return withWriteTracking(phase.adapter, () => { /* idb writes don't have a recoverable error path */ }, () => channel.post());
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, storeVersion]);

  // Live path: a message from another tab. Catch-up path: coming back to a tab
  // that was backgrounded (and may have been suspended, missing the message).
  useEffect(() => {
    const isReady = phase.tag === 'readyOpfs' || phase.tag === 'readyIdb';
    if (!isReady) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshFromStore(); };
    const onFocus = () => { void refreshFromStore(); };
    const unsubscribe = channel.subscribe(() => { void refreshFromStore(); });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      channel.close();
    };
  }, [phase, refreshFromStore, channel]);

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

  return (
    <StorageContext.Provider value={{ adapter, lastSaved, markSaved, notifyMergedCopy }}>
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
              A write error occurred, so your most recent change may not have been
              saved. Everything saved before it is safe — try the change again.
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
                      setPhase({ tag: 'readyIdb', adapter: new IdbAdapter() });
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

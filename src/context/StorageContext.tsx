import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Entry } from '../types';
import { IdbAdapter } from '../storage/idbAdapter';
import { FileAdapter, listWorkspaces } from '../storage/fileAdapter';
import { saveHandle, loadHandle } from '../storage/handleStore';
import { ConflictError, type StorageAdapter } from '../storage/interface';
import { WorkspacePicker } from '../components/WorkspacePicker/WorkspacePicker';
import { Modal } from '../components/Modal/Modal';

export type StorageMode = 'file' | 'idb';

export type Phase =
  | { tag: 'booting' }
  | { tag: 'choose' }
  | { tag: 'pickFolder' }
  | { tag: 'reopen'; handle: FileSystemDirectoryHandle; name: string }
  | { tag: 'pickWorkspace'; handle: FileSystemDirectoryHandle; list: string[] }
  | { tag: 'readyIdb'; adapter: StorageAdapter; lastSaved: string | null }
  | { tag: 'readyFile'; adapter: FileAdapter; handle: FileSystemDirectoryHandle; list: string[] };

interface StorageCtxValue {
  adapter: StorageAdapter;
  mode: StorageMode;
  workspaceName: string | null;
  workspaces: string[];
  openSwitcher: () => void;
  resetStorage: () => void;
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
  };
}

export function useStorage(): StorageCtxValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be inside StorageProvider');
  return ctx;
}

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ tag: 'booting' });
  const [writeError, setWriteError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [merging, setMerging] = useState(false);
  // Bumped after a merge so `safeAdapter` is rebuilt with a fresh identity, which
  // makes every adapter-keyed data hook refetch the merged state.
  const [mergeNonce, setMergeNonce] = useState(0);
  // The note currently open in the editor, so a merge can preserve both it and a
  // disk-side version of the same note. A ref (not state) since it only matters at
  // merge time and shouldn't trigger re-renders.
  const activeEditRef = useRef<Entry | null>(null);
  const registerActiveEdit = useCallback((entry: Entry | null) => {
    activeEditRef.current = entry;
  }, []);

  useEffect(() => {
    async function boot() {
      const hasFileAPI = 'showDirectoryPicker' in window;
      const savedMode = localStorage.getItem('storageMode') as 'file' | 'idb' | null;

      if (savedMode === 'idb') {
        setPhase({ tag: 'readyIdb', adapter: new IdbAdapter(), lastSaved: localStorage.getItem('lastSaved') });
        return;
      }
      if (savedMode === 'file' && hasFileAPI) {
        const handle = await loadHandle();
        if (!handle) { setPhase({ tag: 'pickFolder' }); return; }
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const list = await listWorkspaces(handle);
          const last = localStorage.getItem('lastWorkspace');
          if (last && list.includes(last)) {
            const adapter = await FileAdapter.load(handle, last);
            setPhase({ tag: 'readyFile', adapter, handle, list });
          } else {
            setPhase({ tag: 'pickWorkspace', handle, list });
          }
        } else {
          setPhase({ tag: 'reopen', handle, name: handle.name });
        }
        return;
      }
      // No saved choice yet: go straight to the storage chooser. The marketing
      // landing now lives on the docs site, so there's no in-app home screen.
      if (hasFileAPI) {
        setPhase({ tag: 'choose' });
      } else {
        localStorage.setItem('storageMode', 'idb');
        setPhase({ tag: 'readyIdb', adapter: new IdbAdapter(), lastSaved: localStorage.getItem('lastSaved') });
      }
    }
    boot();
  }, []);

  async function chooseIdb() {
    localStorage.setItem('storageMode', 'idb');
    setPhase({ tag: 'readyIdb', adapter: new IdbAdapter(), lastSaved: localStorage.getItem('lastSaved') });
  }

  function goToChoose() {
    if ('showDirectoryPicker' in window) {
      setPhase({ tag: 'choose' });
    } else {
      chooseIdb();
    }
  }

  function goHome() {
    localStorage.removeItem('storageMode');
    goToChoose();
  }

  async function chooseFile() {
    localStorage.setItem('storageMode', 'file');
    try {
      const handle = await showDirectoryPicker({ mode: 'readwrite' });
      await saveHandle(handle);
      const list = await listWorkspaces(handle);
      setPhase({ tag: 'pickWorkspace', handle, list });
    } catch {
      localStorage.removeItem('storageMode');
      setPhase({ tag: 'choose' });
    }
  }

  async function pickFolder() {
    try {
      const handle = await showDirectoryPicker({ mode: 'readwrite' });
      await saveHandle(handle);
      const list = await listWorkspaces(handle);
      setPhase({ tag: 'pickWorkspace', handle, list });
    } catch { /* user cancelled */ }
  }

  function handleReopen() {
    if (phase.tag !== 'reopen') return;
    const handle = phase.handle;
    handle.requestPermission({ mode: 'readwrite' }).then(async (perm) => {
      if (perm === 'granted') {
        const list = await listWorkspaces(handle);
        setPhase({ tag: 'pickWorkspace', handle, list });
      }
    }).catch(() => { /* denied */ });
  }

  async function selectWorkspace(name: string) {
    if (phase.tag !== 'pickWorkspace') return;
    const { handle, list } = phase;
    localStorage.setItem('lastWorkspace', name);
    const adapter = await FileAdapter.load(handle, name);
    setPhase({ tag: 'readyFile', adapter, handle, list });
  }

  async function createWorkspace(name: string) {
    if (phase.tag !== 'pickWorkspace') return;
    const { handle, list } = phase;
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('lastWorkspace', trimmed);
    const adapter = await FileAdapter.load(handle, trimmed);
    const updated = list.includes(trimmed) ? list : [...list, trimmed].sort();
    setPhase({ tag: 'readyFile', adapter, handle, list: updated });
  }

  function openSwitcher() {
    if (phase.tag === 'readyFile') {
      setPhase({ tag: 'pickWorkspace', handle: phase.handle, list: phase.list });
    }
  }

  function resetStorage() {
    localStorage.removeItem('storageMode');
    goToChoose();
  }

  function markSaved() {
    const ts = new Date().toISOString();
    localStorage.setItem('lastSaved', ts);
    setPhase(prev => prev.tag === 'readyIdb' ? { ...prev, lastSaved: ts } : prev);
  }

  async function reconnect() {
    if (phase.tag !== 'readyFile') return;
    const { handle, adapter: fileAdapter } = phase;
    setReconnecting(true);
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await fileAdapter.flush();
        setWriteError(false);
      }
    } catch { /* stay on error screen */ }
    finally { setReconnecting(false); }
  }

  async function mergeInChanges() {
    const adapter = phase.tag === 'readyFile' || phase.tag === 'readyIdb' ? phase.adapter : null;
    if (!adapter || merging) return;
    setMerging(true);
    try {
      await adapter.mergeFromDisk(activeEditRef.current);
      setConflict(false);
      setMergeNonce(v => v + 1);
    } catch { /* leave the conflict dialog up so the user can retry */ }
    finally { setMerging(false); }
  }

  // Wrap the adapter so failed writes surface the appropriate modal.
  // useMemo keyed on phase so it is only recreated when storage mode changes.
  const safeAdapter = useMemo<StorageAdapter | null>(() => {
    if (phase.tag === 'readyFile') {
      return withErrorCapture(phase.adapter, () => setWriteError(true), () => setConflict(true));
    }
    if (phase.tag === 'readyIdb') {
      return withErrorCapture(phase.adapter, () => { /* idb writes don't have a recoverable error path */ }, () => setConflict(true));
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mergeNonce]);

  // Poll the active storage every 2s for an external saveId change.
  // Must stay above any early return so the hook order is stable across phases.
  useEffect(() => {
    if (conflict) return;
    const adapter = phase.tag === 'readyFile' ? phase.adapter
      : phase.tag === 'readyIdb' ? phase.adapter
      : null;
    if (!adapter) return;
    const id = setInterval(async () => {
      try {
        if (await adapter.hasConflict()) setConflict(true);
      } catch { /* transient read failure — try again next tick */ }
    }, 2000);
    return () => clearInterval(id);
  }, [phase, conflict]);

  if (phase.tag !== 'readyIdb' && phase.tag !== 'readyFile') {
    return (
      <WorkspacePicker
        phase={phase}
        onGoHome={goHome}
        onChooseIdb={chooseIdb}
        onChooseFile={chooseFile}
        onPickFolder={pickFolder}
        onReopen={handleReopen}
        onSelectWorkspace={selectWorkspace}
        onCreateWorkspace={createWorkspace}
      />
    );
  }

  const adapter = safeAdapter!;
  const mode: StorageMode = phase.tag === 'readyFile' ? 'file' : 'idb';
  const workspaceName = phase.tag === 'readyFile' ? phase.adapter.workspaceName : null;
  const workspaces = phase.tag === 'readyFile' ? phase.list : [];
  const lastSaved = phase.tag === 'readyIdb' ? phase.lastSaved : null;

  return (
    <StorageContext.Provider value={{ adapter, mode, workspaceName, workspaces, openSwitcher, resetStorage, lastSaved, markSaved, registerActiveEdit }}>
      {children}
      {writeError && (
        <Modal title="Unable to save" onClose={() => setWriteError(false)}>
          <p style={{ marginTop: 0 }}>
            Your changes could not be written to the connected folder. This usually happens
            when the browser's permission to access the folder has expired.
          </p>
          <p>
            <strong>Your data is safe in memory.</strong> Reconnecting will save all
            pending changes automatically.
          </p>
          <p style={{ marginBottom: 6 }}><strong>To reconnect:</strong></p>
          <ol style={{ margin: '0 0 16px', paddingLeft: '1.4em', lineHeight: 1.8 }}>
            <li>Click <strong>Reconnect</strong> below</li>
            <li>When the browser prompts, select the <strong>same folder</strong> you originally connected</li>
            <li>Your pending changes will be saved automatically</li>
          </ol>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 16px' }}>
            If the folder has been moved or deleted, use <strong>Export</strong> from the
            header to save a backup, then reconnect to a new folder.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={reconnect}
              disabled={reconnecting}
              style={{
                background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6,
                padding: '7px 16px', cursor: reconnecting ? 'default' : 'pointer',
                fontSize: '0.875rem', fontWeight: 500, opacity: reconnecting ? 0.65 : 1,
              }}
            >
              {reconnecting ? 'Reconnecting…' : 'Reconnect'}
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
        </Modal>
      )}
      {conflict && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="File edited elsewhere"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 8, padding: '24px 28px',
            width: 'min(440px, 90vw)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem', color: '#b91c1c' }}>
              Edited in another window
            </h2>
            <p style={{ margin: '0 0 10px', color: '#374151', lineHeight: 1.5 }}>
              Another window or device saved changes to this workspace. Merge them
              in to load the latest version and keep working.
            </p>
            <p style={{ margin: '0 0 18px', color: '#6b7280', lineHeight: 1.5, fontSize: '0.85rem' }}>
              A note you're editing won't be lost — if it also changed elsewhere,
              the other version is kept as a duplicate.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={mergeInChanges}
                disabled={merging}
                style={{
                  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 16px', cursor: merging ? 'default' : 'pointer',
                  fontSize: '0.875rem', fontWeight: 500, opacity: merging ? 0.65 : 1,
                }}
              >
                {merging ? 'Merging…' : 'Merge in changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StorageContext.Provider>
  );
}

import { useState } from 'react';
import { Folder, Globe, FileText } from 'lucide-react';
import type { Phase } from '../../context/StorageContext';
import { AppBanner } from '../AppBanner/AppBanner';
import styles from './WorkspacePicker.module.css';

interface Props {
  phase: Phase;
  onGoHome: () => void;
  onChooseIdb: () => void;
  onChooseFile: () => Promise<void>;
  onPickFolder: () => Promise<void>;
  onReopen: () => void;
  onSelectWorkspace: (name: string) => Promise<void>;
  onCreateWorkspace: (name: string) => Promise<void>;
}

export function WorkspacePicker({ phase, onGoHome, onChooseIdb, onChooseFile, onPickFolder, onReopen, onSelectWorkspace, onCreateWorkspace }: Props) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(phase.tag === 'pickWorkspace' && phase.list.length === 0);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => void | Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  return (
    <div className={styles.overlay}>
      <AppBanner onLogoClick={onGoHome} />
      <div className={styles.cardWrap}>
        <div className={styles.card}>

        {phase.tag === 'booting' && (
          <p className={styles.loading}>Loading…</p>
        )}

        {phase.tag === 'choose' && (
          <>
            <h1 className={styles.heading}>Choose storage</h1>
            <p className={styles.sub}>How should Organizer store your data?</p>
            <div className={styles.options}>
              <button className={styles.optionBtn} onClick={() => run(onChooseFile)} disabled={busy}>
                <span className={styles.optionIcon}><Folder size={22} /></span>
                <strong className={styles.optionTitle}>Folder storage</strong>
                <span className={styles.optionDesc}>Saved to a folder on your device. Auto-saves on every change. Works with Dropbox, iCloud, and multiple workspaces.</span>
              </button>
              <button className={styles.optionBtn} onClick={onChooseIdb} disabled={busy}>
                <span className={styles.optionIcon}><Globe size={22} /></span>
                <strong className={styles.optionTitle}>Browser storage</strong>
                <span className={styles.optionDesc}>Stored in this browser only. Simple to start, use Export to back up manually.</span>
              </button>
            </div>
          </>
        )}

        {phase.tag === 'pickFolder' && (
          <>
            <h1 className={styles.heading}>Pick a folder</h1>
            <p className={styles.sub}>Choose a folder where your timelines will be saved. You can point to a Dropbox or iCloud folder for automatic cloud sync.</p>
            <button className={styles.primaryBtn} onClick={() => run(onPickFolder)} disabled={busy}>
              {busy ? 'Opening…' : 'Pick folder'}
            </button>
            <button className={styles.linkBtn} onClick={onChooseIdb}>Use browser storage instead</button>
          </>
        )}

        {phase.tag === 'reopen' && (
          <>
            <h1 className={styles.heading}>Re-open folder</h1>
            <p className={styles.sub}>Grant access to <strong>{phase.name}</strong> to continue.</p>
            <button className={styles.primaryBtn} onClick={() => run(onReopen)} disabled={busy}>
              {busy ? 'Opening…' : `Open "${phase.name}"`}
            </button>
            <button className={styles.linkBtn} onClick={() => run(onPickFolder)}>Pick a different folder</button>
            <button className={styles.linkBtn} onClick={onChooseIdb}>Switch to browser storage</button>
          </>
        )}

        {phase.tag === 'pickWorkspace' && (
          <>
            <h1 className={styles.heading}>
              {phase.list.length === 0 ? 'Create your first workspace' : 'Select workspace'}
            </h1>
            {phase.list.length > 0 && !creating && (
              <ul className={styles.workspaceList}>
                {phase.list.map(name => (
                  <li key={name}>
                    <button
                      className={styles.workspaceItem}
                      onClick={() => run(() => onSelectWorkspace(name))}
                      disabled={busy}
                    >
                      <span className={styles.wsIcon}><FileText size={16} /></span>
                      <span className={styles.wsName}>{name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {creating ? (
              <form
                className={styles.newForm}
                onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(() => onCreateWorkspace(newName)); }}
              >
                <input
                  className={styles.newInput}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Workspace name, e.g. work or personal"
                  autoFocus
                />
                <div className={styles.newActions}>
                  <button type="submit" className={styles.primaryBtn} disabled={!newName.trim() || busy}>
                    {busy ? 'Creating…' : 'Create'}
                  </button>
                  {phase.list.length > 0 && (
                    <button type="button" className={styles.linkBtn} onClick={() => setCreating(false)}>Cancel</button>
                  )}
                </div>
              </form>
            ) : (
              <button className={styles.secondaryBtn} onClick={() => setCreating(true)}>
                + New workspace
              </button>
            )}
            <button className={styles.linkBtn} onClick={() => run(onPickFolder)}>Pick a different folder</button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

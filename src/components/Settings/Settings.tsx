import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, RotateCcw, Folder, Globe, FolderSync, BookOpen } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { Modal } from '../Modal/Modal';
import { exportData, importData } from '../../utils/exportImport';
import styles from './Settings.module.css';

interface Props {
  onDataChanged: () => void | Promise<void>;
}

export function Settings({ onDataChanged }: Props) {
  const { adapter, mode, workspaceName, markSaved, resetStorage, openSwitcher } = useStorage();
  const navigate = useNavigate();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    await exportData(adapter);
    if (mode === 'idb') markSaved();
  }

  async function handleImport(importMode: 'replace' | 'merge') {
    if (!importFile) return;
    setImporting(true);
    try {
      await importData(adapter, importFile, importMode);
      await onDataChanged();
    } finally {
      setImporting(false);
      setImportModalOpen(false);
      setImportFile(null);
    }
  }

  function handleReset() {
    setResetModalOpen(false);
    navigate('/', { replace: true });
    resetStorage();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Storage</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Current</div>
              <div className={styles.rowDesc}>
                {mode === 'file'
                  ? <><Folder size={14} /> Folder · <strong>{workspaceName}</strong></>
                  : <><Globe size={14} /> Browser storage</>}
              </div>
            </div>
            {mode === 'file' && (
              <button className={styles.btnSecondary} onClick={openSwitcher}>
                <FolderSync size={14} />Switch folder
              </button>
            )}
          </div>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Reset storage choice</div>
              <div className={styles.rowDesc}>
                Pick a different storage location. Your existing data is not deleted —
                choose the same option again to get back to it.
              </div>
            </div>
            <button className={styles.btnSecondary} onClick={() => setResetModalOpen(true)}>
              <RotateCcw size={14} />Reset
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Backup</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Export</div>
              <div className={styles.rowDesc}>Download all your data as a single JSON file.</div>
            </div>
            <button className={styles.btn} onClick={handleExport}>
              <Download size={14} />Export
            </button>
          </div>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Import</div>
              <div className={styles.rowDesc}>Restore from a previous export, or merge it in.</div>
            </div>
            <label className={styles.btn}>
              <Upload size={14} />Import
              <input
                type="file"
                accept=".json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setImportFile(file); setImportModalOpen(true); }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Help</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Documentation</div>
              <div className={styles.rowDesc}>Guides and help for using Organizer.</div>
            </div>
            <a
              className={styles.btnSecondary}
              href="https://www.useorganizer.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <BookOpen size={14} />Docs
            </a>
          </div>
        </div>
      </section>

      {importModalOpen && (
        <Modal title="Import Data" onClose={() => { if (!importing) { setImportModalOpen(false); setImportFile(null); } }}>
          <p>Import <strong>{importFile?.name}</strong></p>
          <p>Choose how to import:</p>
          <div className={styles.modalActions}>
            <button className={styles.dangerBtn} onClick={() => handleImport('replace')} disabled={importing}>
              Replace all data
            </button>
            <button className={styles.btn} onClick={() => handleImport('merge')} disabled={importing}>
              Merge (skip duplicates)
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => { setImportModalOpen(false); setImportFile(null); }}
              disabled={importing}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {resetModalOpen && (
        <Modal title="Reset storage choice" onClose={() => setResetModalOpen(false)}>
          <p style={{ marginTop: 0 }}>
            You'll be taken back to the storage selection screen.
          </p>
          <p>
            <strong>Your data is not deleted.</strong> If you pick the same storage
            again, you'll find your timelines exactly where you left them.
          </p>
          <div className={styles.modalActions}>
            <button className={styles.btn} onClick={handleReset}>Reset</button>
            <button className={styles.btnSecondary} onClick={() => setResetModalOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

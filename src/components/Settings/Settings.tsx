import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, RotateCcw, Globe, BookOpen } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { Modal } from '../Modal/Modal';
import { exportData, importData, clearAllData } from '../../utils/exportImport';
import styles from './Settings.module.css';

interface Props {
  onDataChanged: () => void | Promise<void>;
}

export function Settings({ onDataChanged }: Props) {
  const { adapter, lastSaved, markSaved } = useStorage();
  const navigate = useNavigate();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleExport() {
    await exportData(adapter);
    markSaved();
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

  async function handleReset() {
    setClearing(true);
    try {
      await clearAllData(adapter);
      await onDataChanged();
    } finally {
      setClearing(false);
      setResetModalOpen(false);
    }
    navigate('/', { replace: true });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Storage</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Backend</div>
              <div className={styles.rowDesc}>
                <Globe size={14} /> App storage on this device
                {lastSaved !== null && (
                  <span style={{ opacity: 0.6, fontSize: '0.8rem', marginLeft: 8 }}>
                    · Last backup export: {new Date(lastSaved).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>Clear all data</div>
              <div className={styles.rowDesc}>
                Remove all timelines, entries, and attachments from this device.
              </div>
            </div>
            <button className={styles.btnSecondary} onClick={() => setResetModalOpen(true)}>
              <RotateCcw size={14} />Clear
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
        <Modal title="Clear all data" onClose={() => { if (!clearing) setResetModalOpen(false); }}>
          <p style={{ marginTop: 0 }}>
            This will delete <strong>all</strong> your timelines, entries, and attachments
            from this device permanently.
          </p>
          <p>
            Export your data first if you want to keep it.
          </p>
          <div className={styles.modalActions}>
            <button className={styles.dangerBtn} onClick={handleReset} disabled={clearing}>
              {clearing ? 'Clearing…' : 'Clear everything'}
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => setResetModalOpen(false)}
              disabled={clearing}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
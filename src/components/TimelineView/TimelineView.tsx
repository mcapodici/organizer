import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import type { Timeline, Entry } from '../../types';
import { useStorage } from '../../context/StorageContext';
import { EntryCard } from '../EntryCard/EntryCard';
import { EntryComposer } from '../EntryComposer/EntryComposer';
import { Modal } from '../Modal/Modal';
import { TagInput } from '../TagInput/TagInput';
import styles from './TimelineView.module.css';

interface Props {
  timeline: Timeline;
  entries: Entry[];
  allTags: string[];
  onUpdateTimeline: (t: Timeline) => void;
  onAddEntry: (data: { content: string; timestamp: string; attachments: Entry['attachments']; dueDate?: string; isDone?: boolean }) => Promise<Entry>;
  onUpdateEntry: (entry: Entry) => Promise<void>;
  onDeleteEntry: (entry: Entry) => void | Promise<void>;
}

export function TimelineView({
  timeline,
  entries,
  allTags,
  onUpdateTimeline,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(timeline.name);
  const [editingTags, setEditingTags] = useState(false);
  const { registerActiveEdit } = useStorage();
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [composerHasContent, setComposerHasContent] = useState(false);
  const [loadContent, setLoadContent] = useState<string | null>(null);
  const [copyConfirmContent, setCopyConfirmContent] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; block: ScrollLogicalPosition } | null>(null);
  const entriesRef = useRef<HTMLDivElement>(null);
  const scrolledTimelineRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // When arriving from the Todos page, scroll the clicked entry to the top of the pane.
  useEffect(() => {
    const targetId = (location.state as { scrollToEntryId?: string } | null)?.scrollToEntryId;
    if (targetId) {
      // Router-state-driven scroll orchestration; the target comes from history state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrollTarget({ id: targetId, block: 'start' });
      // Clear the history state so a refresh or back-navigation doesn't re-scroll.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  // Scroll to a specific saved note, or to the latest entry when switching timelines.
  useEffect(() => {
    if (scrollTarget) {
      const el = document.getElementById(`entry-${scrollTarget.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: scrollTarget.block });
        // Clearing the consumed scroll target after the DOM scroll has been issued.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScrollTarget(null);
      }
      return;
    }
    // Only scroll to latest once per timeline, after that timeline's entries have loaded.
    if (
      scrolledTimelineRef.current !== timeline.id &&
      entries.length > 0 &&
      entries[0].timelineId === timeline.id
    ) {
      scrolledTimelineRef.current = timeline.id;
      const container = entriesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [entries, timeline.id, scrollTarget]);

  // Tell the storage layer which note is open in the editor so a merge can
  // preserve both the in-progress edit and any disk-side version of the same note.
  useEffect(() => {
    registerActiveEdit(editingEntry);
    return () => registerActiveEdit(null);
  }, [editingEntry, registerActiveEdit]);

  function handleCopy(entry: Entry) {
    if (composerHasContent || editingEntry) {
      setCopyConfirmContent(entry.content);
    } else {
      setLoadContent(entry.content);
    }
  }

  function confirmCopy() {
    setEditingEntry(null);
    setLoadContent(copyConfirmContent);
    setCopyConfirmContent(null);
  }

  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== timeline.name) onUpdateTimeline({ ...timeline, name: trimmed });
    setEditingName(false);
  }

  async function handleSave(data: { content: string; timestamp: string; attachments: Entry['attachments']; dueDate?: string; isDone?: boolean }) {
    if (editingEntry) {
      await onUpdateEntry({ ...editingEntry, ...data });
      setScrollTarget({ id: editingEntry.id, block: 'center' });
      setEditingEntry(null);
    } else {
      const created = await onAddEntry(data);
      setScrollTarget({ id: created.id, block: 'center' });
    }
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className={styles.nameForm}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className={styles.nameInput}
                autoFocus
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingName(false); }}
              />
            </form>
          ) : (
            <>
              <h1 className={styles.name} onClick={() => { setNameInput(timeline.name); setEditingName(true); }}>
                {timeline.name}
              </h1>
              <button
                className={styles.editNameBtn}
                aria-label="Rename timeline"
                onClick={() => { setNameInput(timeline.name); setEditingName(true); }}
              >
                <Pencil size={14} /> Rename
              </button>
            </>
          )}
        </div>
        <div className={styles.tagsRow}>
          {timeline.tags.map((tag) => (
            <span key={tag} className={styles.tagChip}>{tag}</span>
          ))}
          <button className={styles.editTagsBtn} onClick={() => setEditingTags(true)}>
            {timeline.tags.length === 0
              ? <><Plus size={14} /> Add tags</>
              : <><Pencil size={14} /> Edit tags</>}
          </button>
        </div>
      </div>

      <div className={styles.entries} ref={entriesRef}>
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            domId={`entry-${entry.id}`}
            isEditing={editingEntry?.id === entry.id}
            onEdit={() => setEditingEntry(entry)}
            onDelete={() => setDeleteTarget(entry)}
            onCopy={() => handleCopy(entry)}
            onUpdate={onUpdateEntry}
          />
        ))}
      </div>

      <EntryComposer
        editing={editingEntry}
        loadContent={loadContent}
        onLoadConsumed={() => setLoadContent(null)}
        onEditorEmptyChange={(isEmpty) => setComposerHasContent(!isEmpty)}
        onSave={handleSave}
        onCancel={() => setEditingEntry(null)}
      />

      {copyConfirmContent && (
        <div className={styles.copyConfirm}>
          <span className={styles.copyConfirmText}>Replace your current draft?</span>
          <button className={styles.copyConfirmReplace} onClick={confirmCopy}>Replace</button>
          <button className={styles.copyConfirmCancel} onClick={() => setCopyConfirmContent(null)}>Keep editing</button>
        </div>
      )}

      {deleteTarget && (
        <Modal title="Delete Entry" onClose={() => setDeleteTarget(null)}>
          <p>Delete this entry? This cannot be undone.</p>
          <div className={styles.modalActions}>
            <button
              className={styles.dangerBtn}
              onClick={() => { onDeleteEntry(deleteTarget); setDeleteTarget(null); }}
            >
              Delete
            </button>
            <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {editingTags && (
        <EditTagsModal
          timeline={timeline}
          allTags={allTags}
          onSave={(tags) => { onUpdateTimeline({ ...timeline, tags }); setEditingTags(false); }}
          onClose={() => setEditingTags(false)}
        />
      )}
    </div>
  );
}

function EditTagsModal({ timeline, allTags, onSave, onClose }: {
  timeline: Timeline;
  allTags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}) {
  const [tags, setTags] = useState(timeline.tags);
  return (
    <Modal title="Edit Tags" onClose={onClose}>
      <TagInput tags={tags} allTags={allTags} onChange={setTags} />
      <div className={styles.modalActions} style={{ marginTop: 12 }}>
        <button className={styles.btn} onClick={() => onSave(tags)}>Save</button>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Filter, AlertTriangle } from 'lucide-react';
import type { Timeline } from '../../types';
import type { TodoCount } from '../../hooks/useTodoCounts';
import { TagFilter } from '../TagFilter/TagFilter';
import { Modal } from '../Modal/Modal';
import { EditTagsModal } from '../EditTagsModal/EditTagsModal';
import styles from './TimelineList.module.css';

interface Props {
  timelines: Timeline[];
  allTags: string[];
  activeId: string | null;
  todoCounts: Record<string, TodoCount>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onUpdate: (timeline: Timeline) => void;
  onDelete: (id: string) => void;
  triggerCreate?: boolean;
  onTriggerCreateHandled?: () => void;
  showFilter: boolean;
  onToggleFilter: () => void;
}

export function TimelineList({ timelines, allTags, activeId, todoCounts, onSelect, onCreate, onUpdate, onDelete, triggerCreate, onTriggerCreateHandled, showFilter, onToggleFilter }: Props) {
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Timeline | null>(null);
  const [editTagsTarget, setEditTagsTarget] = useState<Timeline | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Timeline | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (triggerCreate) {
      // triggerCreate is a one-shot signal prop, consumed by entering create mode.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreating(true);
      onTriggerCreateHandled?.();
    }
  // onTriggerCreateHandled is an unmemoized parent callback; including it would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCreate]);

  const filtered = filterTags.length === 0
    ? timelines
    : timelines.filter((t) => t.tags.some((tag) => filterTags.includes(tag)));

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name) { onCreate(name); setNewName(''); setCreating(false); }
  }

  function handleMenuKey(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuId(id === menuId ? null : id); }
  }

  useEffect(() => {
    function close() { setMenuId(null); }
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <aside className={styles.panel}>
      {creating ? (
        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Timeline name"
            className={styles.createInput}
            onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
          />
          <div className={styles.createActions}>
            <button type="submit" className={styles.btn}>Add</button>
            <button type="button" className={styles.btnSecondary} onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className={styles.header}>
          <button className={styles.newTimelineBtn} onClick={() => setCreating(true)}>
            <Plus size={16} />New Timeline
          </button>
          <button
            className={`${styles.filterBtn} ${showFilter || filterTags.length > 0 ? styles.filterBtnActive : ''}`}
            onClick={onToggleFilter}
            aria-label="Filter by tags"
            aria-pressed={showFilter}
            title="Filter by tags"
          >
            <Filter size={16} />Filter
            {filterTags.length > 0 && <span className={styles.filterCount}>{filterTags.length}</span>}
          </button>
        </div>
      )}

      {showFilter && <TagFilter allTags={allTags} selected={filterTags} onChange={setFilterTags} />}

      <ul className={styles.list}>
        {filtered.map((t) => (
          <li
            key={t.id}
            className={`${styles.item} ${t.id === activeId ? styles.active : ''}`}
          >
            <div className={styles.itemRow}>
              <button className={styles.name} onClick={() => onSelect(t.id)}>
                <span className={styles.nameText}>{t.name}</span>
                {todoCounts[t.id] ? (
                  <span
                    className={`${styles.todoBadge} ${todoCounts[t.id].overdue > 0 ? styles.todoBadgeOverdue : ''}`}
                    aria-label={todoBadgeLabel(todoCounts[t.id])}
                  >
                    {todoCounts[t.id].overdue > 0 && (
                      <AlertTriangle size={11} aria-hidden="true" className={styles.todoBadgeIcon} />
                    )}
                    {todoCounts[t.id].count}
                  </span>
                ) : null}
              </button>
              <button
                className={styles.kebab}
                aria-label="Timeline options"
                onClick={(e) => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id); }}
                onKeyDown={(e) => handleMenuKey(e, t.id)}
              >
                <MoreVertical size={16} />
              </button>
              {menuId === t.id && (
                <ul className={styles.menu} onClick={(e) => e.stopPropagation()}>
                  <li><button onClick={() => { setRenameTarget(t); setMenuId(null); }}>Rename</button></li>
                  <li><button onClick={() => { setEditTagsTarget(t); setMenuId(null); }}>Edit Tags</button></li>
                  <li><button className={styles.danger} onClick={() => { setDeleteTarget(t); setMenuId(null); }}>Delete</button></li>
                </ul>
              )}
            </div>
            {t.tags.length > 0 && (
              <div className={styles.itemTags}>
                {t.tags.map((tag) => <span key={tag} className={styles.itemTag}>{tag}</span>)}
              </div>
            )}
          </li>
        ))}
      </ul>


      {renameTarget && (
        <RenameModal
          timeline={renameTarget}
          onSave={(name) => { onUpdate({ ...renameTarget, name }); setRenameTarget(null); }}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {editTagsTarget && (
        <EditTagsModal
          timeline={editTagsTarget}
          allTags={allTags}
          onSave={(tags) => { onUpdate({ ...editTagsTarget, tags }); setEditTagsTarget(null); }}
          onClose={() => setEditTagsTarget(null)}
        />
      )}

      {deleteTarget && (
        <Modal title="Delete Timeline" onClose={() => setDeleteTarget(null)}>
          <p>Delete <strong>{deleteTarget.name}</strong> and all its entries? This cannot be undone.</p>
          <div className={styles.modalActions}>
            <button className={styles.dangerBtn} onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}>
              Delete
            </button>
            <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </aside>
  );
}

function todoBadgeLabel({ count, overdue }: TodoCount): string {
  const todos = `${count} ${count === 1 ? 'todo' : 'todos'}`;
  return overdue > 0 ? `${todos}, ${overdue} overdue` : todos;
}

function RenameModal({ timeline, onSave, onClose }: { timeline: Timeline; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(timeline.name);
  return (
    <Modal title="Rename Timeline" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.createInput}
          autoFocus
        />
        <div className={styles.modalActions} style={{ marginTop: 12 }}>
          <button type="submit" className={styles.btn}>Save</button>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

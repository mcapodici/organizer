import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { EntryLink } from './linkExtension';
import { Modal } from '../Modal/Modal';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Link as LinkIcon,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, ListTodo, Quote, SeparatorHorizontal, Table as TableIcon,
  Plus, Minus, Rows3, Columns3, TableCellsMerge, Grid3x3, Trash2,
  Maximize2, Minimize2, X,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useStorage } from '../../context/StorageContext';
import type { Entry, Attachment } from '../../types';
import { toDatetimeLocalValue, fromDatetimeLocalValue, nowIso, formatFileSize } from '../../utils/dateFormat';
import styles from './EntryComposer.module.css';

interface Props {
  editing: Entry | null;
  loadContent: string | null;
  onLoadConsumed: () => void;
  onEditorEmptyChange: (isEmpty: boolean) => void;
  onSave: (data: { content: string; timestamp: string; attachments: Attachment[]; dueDate?: string; isDone?: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function EntryComposer({ editing, loadContent, onLoadConsumed, onEditorEmptyChange, onSave, onCancel }: Props) {
  const { adapter } = useStorage();
  const [expanded, setExpanded] = useState(false);
  const [customTime, setCustomTime] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [dueDateActive, setDueDateActive] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [staged, setStaged] = useState<{ file: File; id: string }[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [inTable, setInTable] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      EntryLink,
      TableExtension.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
    ],
    enableInputRules: false,
    content: '',
    onUpdate({ editor }) {
      const empty = editor.isEmpty;
      setEditorEmpty(empty);
      onEditorEmptyChange(empty);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const sync = () => setInTable(editor.isActive('table'));
    editor.on('selectionUpdate', sync);
    editor.on('update', sync);
    return () => {
      editor.off('selectionUpdate', sync);
      editor.off('update', sync);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (editing) {
      // Snapshot the current new-note draft before entering edit mode
      if (!editor.isEmpty) {
        draftRef.current = JSON.stringify(editor.getJSON());
      }
      editor.commands.setContent(JSON.parse(editing.content));
      const empty = editor.isEmpty;
      // Syncing the TipTap editor instance's content into React state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditorEmpty(empty);
      onEditorEmptyChange(empty);
      setTimestamp(toDatetimeLocalValue(editing.timestamp));
      setCustomTime(true);
      setDueDateActive(!!editing.dueDate);
      setDueDate(editing.dueDate ?? '');
      setIsDone(editing.isDone ?? false);
      setExistingAttachments(editing.attachments);
      setStaged([]);
      setExpanded(true);
    } else {
      // Restore the new-note draft (if any) when returning from edit
      const draft = draftRef.current;
      draftRef.current = null;
      setCustomTime(false);
      setTimestamp('');
      setDueDateActive(false);
      setDueDate('');
      setIsDone(false);
      setExistingAttachments([]);
      setStaged([]);
      setExpanded(false);
      if (draft) {
        editor.commands.setContent(JSON.parse(draft));
        const empty = editor.isEmpty;
        setEditorEmpty(empty);
        onEditorEmptyChange(empty);
      } else {
        editor.commands.clearContent();
        setEditorEmpty(true);
        onEditorEmptyChange(true);
      }
    }
  // onEditorEmptyChange is an unmemoized parent callback; including it would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editor]);

  useEffect(() => {
    if (!editor || !loadContent) return;
    editor.commands.setContent(JSON.parse(loadContent));
    const empty = editor.isEmpty;
    // Syncing the TipTap editor instance's content into React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditorEmpty(empty);
    onEditorEmptyChange(empty);
    onLoadConsumed();
  // onEditorEmptyChange/onLoadConsumed are unmemoized parent callbacks; including them would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadContent, editor]);

  function enableCustomTime() {
    setTimestamp(toDatetimeLocalValue(nowIso()));
    setCustomTime(true);
  }

  function cancelCustomTime() {
    setCustomTime(false);
    setTimestamp('');
  }

  function openLinkDialog() {
    if (!editor) return;
    // Prefill with the URL of the link under the caret, if any.
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const resolvedTimestamp = customTime ? fromDatetimeLocalValue(timestamp) : nowIso();
      const newAttachments: Attachment[] = await Promise.all(
        staged.map(async ({ file, id }) => {
          const buf = await file.arrayBuffer();
          const blobKey = `blob-${id}`;
          await adapter.putBlob(blobKey, buf);
          return { id, name: file.name, mimeType: file.type, size: file.size, blobKey };
        })
      );
      await onSave({
        content: JSON.stringify(editor.getJSON()),
        timestamp: resolvedTimestamp,
        attachments: [...existingAttachments, ...newAttachments],
        dueDate: dueDateActive && dueDate ? dueDate : undefined,
        isDone: dueDateActive && dueDate ? isDone : undefined,
      });
      editor.commands.clearContent();
      setEditorEmpty(true);
      setCustomTime(false);
      setTimestamp('');
      setDueDateActive(false);
      setDueDate('');
      setIsDone(false);
      setStaged([]);
      setExistingAttachments([]);
      // Return to normal size so the saved note is visible in the timeline.
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newStaged = Array.from(files).map((file) => ({ file, id: uuid() }));
    setStaged((prev) => [...prev, ...newStaged]);
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  function removeExisting(attId: string) {
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attId));
  }

  return (
    <div className={`${styles.composer} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.composerLabel}>
        <span>{editing ? 'Editing Note' : 'New Note'}</span>
        <button
          className={styles.expandBtn}
          onClick={() => setExpanded((e) => !e)}
          type="button"
          aria-label={expanded ? 'Collapse editor' : 'Expand editor'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div className={styles.toolbar}>
        {editor && (
          <>
            <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={14} /></ToolbarBtn>
            <span className={styles.sep} />
            <ToolbarBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code"><Code size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight"><Highlighter size={14} /></ToolbarBtn>
            <span className={styles.linkWrap}>
              <ToolbarBtn active={editor.isActive('link')} onClick={openLinkDialog} title="Link"><LinkIcon size={14} /></ToolbarBtn>
              {linkOpen && (
                <Modal title="Link" onClose={() => setLinkOpen(false)}>
                  <div className={styles.linkModal}>
                    <input
                      className={styles.linkInput}
                      type="url"
                      placeholder="https://example.com"
                      aria-label="Link URL"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                      }}
                    />
                    <div className={styles.linkActions}>
                      <button className={styles.linkRemove} type="button" onClick={removeLink}>Remove</button>
                      <button className={styles.linkApply} type="button" onClick={applyLink}>Apply</button>
                    </div>
                  </div>
                </Modal>
              )}
            </span>
            <span className={styles.sep} />
            <ToolbarBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4"><Heading4 size={14} /></ToolbarBtn>
            <span className={styles.sep} />
            <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={14} /></ToolbarBtn>
            <ToolbarBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list"><ListTodo size={14} /></ToolbarBtn>
            <span className={styles.sep} />
            <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote"><Quote size={14} /></ToolbarBtn>
            <ToolbarBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><SeparatorHorizontal size={14} /></ToolbarBtn>
            <ToolbarBtn active={inTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon size={14} /></ToolbarBtn>
          </>
        )}
      </div>
      {editor && inTable && (
        <div className={styles.tableToolbar}>
          <span className={styles.tableToolbarLabel}>Table:</span>
          <button className={styles.tableBtn} type="button" title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={10} strokeWidth={2.5} /><Rows3 size={14} /></button>
          <button className={styles.tableBtn} type="button" title="Remove row" onClick={() => editor.chain().focus().deleteRow().run()}><Minus size={10} strokeWidth={2.5} /><Rows3 size={14} /></button>
          <button className={styles.tableBtn} type="button" title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={10} strokeWidth={2.5} /><Columns3 size={14} /></button>
          <button className={styles.tableBtn} type="button" title="Remove column" onClick={() => editor.chain().focus().deleteColumn().run()}><Minus size={10} strokeWidth={2.5} /><Columns3 size={14} /></button>
          <button className={styles.tableBtn} type="button" title="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()}><TableCellsMerge size={14} /></button>
          <button className={styles.tableBtn} type="button" title="Split cell" onClick={() => editor.chain().focus().splitCell().run()}><Grid3x3 size={14} /></button>
          <button className={`${styles.tableBtn} ${styles.tableBtnDanger}`} type="button" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /></button>
        </div>
      )}
      <EditorContent editor={editor} className={styles.editorContent} />
      <div className={styles.meta}>
        <div className={styles.timeRow}>
          {customTime ? (
            <label className={styles.label}>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className={styles.dateInput}
                aria-label="Custom time"
              />
              {!editing && (
                <button
                  className={styles.cancelTimeBtn}
                  onClick={cancelCustomTime}
                  type="button"
                  aria-label="Remove custom time"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          ) : (
            <button
              className={styles.customTimeBtn}
              onClick={enableCustomTime}
              type="button"
            >
              Set custom time
            </button>
          )}
          <span className={styles.metaSep}>·</span>
          {dueDateActive ? (
            <label className={styles.label}>
              <span className={styles.dueDateLabel}>Due:</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={styles.dateInput}
                aria-label="Due date"
              />
              <label className={styles.doneLabel}>
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => setIsDone(e.target.checked)}
                  className={styles.doneCheck}
                />
                Done
              </label>
              <button
                className={styles.cancelTimeBtn}
                onClick={() => { setDueDateActive(false); setDueDate(''); setIsDone(false); }}
                type="button"
                aria-label="Remove due date"
              >
                <X size={14} />
              </button>
            </label>
          ) : (
            <button
              className={styles.customTimeBtn}
              onClick={() => setDueDateActive(true)}
              type="button"
            >
              Set due date
            </button>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.attachBtn}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            Attach
          </button>
          {editing && (
            <button className={styles.cancelBtn} onClick={onCancel} type="button">
              Cancel
            </button>
          )}
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={editorEmpty || saving}
            type="button"
          >
            {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {(staged.length > 0 || existingAttachments.length > 0) && (
        <ul className={styles.staged}>
          {existingAttachments.map((att) => (
            <li key={att.id} className={styles.stagedItem}>
              <span>{att.name}</span>
              <span className={styles.size}>{formatFileSize(att.size)}</span>
              <button onClick={() => removeExisting(att.id)} aria-label="Remove"><X size={14} /></button>
            </li>
          ))}
          {staged.map(({ file, id }) => (
            <li key={id} className={styles.stagedItem}>
              <span>{file.name}</span>
              <span className={styles.size}>{formatFileSize(file.size)}</span>
              <button onClick={() => removeStaged(id)} aria-label="Remove"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

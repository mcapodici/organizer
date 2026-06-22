import { useState, useEffect } from 'react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import { Check, Circle, Paperclip } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import type { Entry, Attachment } from '../../types';
import { formatTimestamp, formatFileSize, formatDueDate, todayDateString } from '../../utils/dateFormat';
import { DueDatePopover } from '../DueDatePopover/DueDatePopover';
import styles from './EntryCard.module.css';

interface Props {
  entry: Entry;
  isEditing?: boolean;
  domId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onUpdate?: (entry: Entry) => void | Promise<void>;
}

export function EntryCard({ entry, isEditing, domId, onEdit, onDelete, onCopy, onUpdate }: Props) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [dueAnchor, setDueAnchor] = useState<DOMRect | null>(null);

  let html = '';
  try {
    const json = JSON.parse(entry.content);
    html = generateHTML(json, [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline, Link,
      Table, TableRow, TableHeader, TableCell,
      TaskList, TaskItem,
      Highlight,
    ]);
  } catch {
    html = entry.content;
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!onUpdate) return;
    // The checkbox is an <input> wrapped in a <label> (with a styler <span>);
    // accept a click anywhere on that label, but not on the task text.
    const label = target.closest('li[data-type="taskItem"] > label');
    if (!label) return;
    const item = label.closest('li[data-type="taskItem"]');
    if (!item) return;
    const container = e.currentTarget;
    const items = Array.from(container.querySelectorAll('li[data-type="taskItem"]'));
    const index = items.indexOf(item);
    if (index < 0) return;
    // Prevent the native checkbox toggle; React re-renders from the saved JSON.
    e.preventDefault();
    let json: TiptapNode;
    try {
      json = JSON.parse(entry.content);
    } catch {
      return;
    }
    if (toggleTaskItem(json, index)) {
      onUpdate({ ...entry, content: JSON.stringify(json) });
    }
  }

  return (
    <div id={domId} className={`${styles.card} ${isEditing ? styles.editing : ''}`}>
      <div className={styles.dot} />
      <div className={styles.body}>
        <div className={styles.meta}>
          <time className={styles.time}>{formatTimestamp(entry.timestamp)}</time>
          {entry.dueDate && (
            <span
              className={`${styles.todoLozenge} ${entry.isDone ? styles.todoDone : isOverdue(entry.dueDate) ? styles.todoOverdue : ''}`}
            >
              <button
                type="button"
                className={styles.todoCheckBtn}
                onClick={() => onUpdate?.({ ...entry, isDone: !entry.isDone })}
                title={entry.isDone ? 'Mark as not done' : 'Mark as done'}
                aria-label={entry.isDone ? 'Mark as not done' : 'Mark as done'}
              >
                <span className={styles.todoCheck}>{entry.isDone ? <Check size={12} /> : <Circle size={11} />}</span>
              </button>
              <button
                type="button"
                className={styles.todoDueBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDueAnchor((prev) => prev ? null : rect);
                }}
                title="Edit due date"
              >
                <span className={styles.todoDueText}>{formatDueDate(entry.dueDate)}</span>
              </button>
              {dueAnchor && onUpdate && (
                <DueDatePopover
                  entry={entry}
                  anchorRect={dueAnchor}
                  onUpdate={onUpdate}
                  onClose={() => setDueAnchor(null)}
                />
              )}
            </span>
          )}
          {isEditing && <em className={styles.editingLabel}>Editing…</em>}
          {(onEdit || onDelete || onCopy) && (
            <div className={styles.actions}>
              {onCopy && <button className={styles.actionBtn} onClick={onCopy} aria-label="Copy entry">Copy</button>}
              {onEdit && <button className={styles.actionBtn} onClick={onEdit} aria-label="Edit entry">Edit</button>}
              {onDelete && <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onDelete} aria-label="Delete entry">Delete</button>}
            </div>
          )}
        </div>
        <div
          className={styles.content}
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {entry.attachments.length > 0 && (
          <AttachmentList
            attachments={entry.attachments}
            onLightbox={setLightboxSrc}
          />
        )}
      </div>
      {lightboxSrc && (
        <div className={styles.lightbox} onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Full size" className={styles.lightboxImg} />
        </div>
      )}
    </div>
  );
}

function isOverdue(dueDate: string): boolean {
  return dueDate < todayDateString();
}

interface TiptapNode {
  type?: string;
  attrs?: { checked?: boolean; [k: string]: unknown };
  content?: TiptapNode[];
}

// Walks the Tiptap JSON document in order, toggling the `checked` attr of the
// task item at the given index (matching the DOM order of rendered checkboxes).
function toggleTaskItem(node: TiptapNode, targetIndex: number): boolean {
  let counter = 0;
  function walk(n: TiptapNode): boolean {
    if (n.type === 'taskItem') {
      if (counter === targetIndex) {
        n.attrs = { ...(n.attrs ?? {}), checked: !n.attrs?.checked };
        return true;
      }
      counter++;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        if (walk(child)) return true;
      }
    }
    return false;
  }
  return walk(node);
}

function AttachmentList({ attachments, onLightbox }: { attachments: Attachment[]; onLightbox: (src: string) => void }) {
  return (
    <div className={styles.attachments}>
      {attachments.map((att) => (
        <AttachmentItem key={att.id} attachment={att} onLightbox={onLightbox} />
      ))}
    </div>
  );
}

function AttachmentItem({ attachment, onLightbox }: { attachment: Attachment; onLightbox: (src: string) => void }) {
  const { adapter } = useStorage();
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.mimeType.startsWith('image/');
  const isVideo = attachment.mimeType === 'video/mp4' || attachment.mimeType.startsWith('video/');

  useEffect(() => {
    let objectUrl: string;
    adapter.getBlob(attachment.blobKey).then((buf) => {
      if (!buf) return;
      const blob = new Blob([buf], { type: attachment.mimeType });
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.blobKey, attachment.mimeType]);

  if (!url) return <span className={styles.attPlaceholder}>{attachment.name}</span>;

  if (isImage) {
    return (
      <img
        src={url}
        alt={attachment.name}
        className={styles.thumbnail}
        onClick={() => onLightbox(url)}
        title={attachment.name}
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        className={styles.thumbnail}
        controls
        title={attachment.name}
      />
    );
  }

  return (
    <a href={url} download={attachment.name} className={styles.fileLink}>
      <Paperclip size={13} /> {attachment.name} <span className={styles.fileSize}>({formatFileSize(attachment.size)})</span>
    </a>
  );
}

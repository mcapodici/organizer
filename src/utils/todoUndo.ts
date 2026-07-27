import type { Entry } from '../types';
import type { StorageAdapter } from '../storage/interface';
import { formatDueDate } from './dateFormat';

/**
 * Describes a todo-field change for the undo bar, or returns null when the save
 * isn't a todo action at all. Content or timestamp edits mean this came from the
 * composer (or an inline task-list checkbox), which keeps its own editing flow —
 * only pure dueDate/isDone changes get an undo window.
 */
export function describeTodoChange(prev: Entry, next: Entry): string | null {
  if (prev.content !== next.content) return null;
  if (prev.timestamp !== next.timestamp) return null;

  const dueChanged = (prev.dueDate ?? '') !== (next.dueDate ?? '');
  const doneChanged = !!prev.isDone !== !!next.isDone;
  if (!dueChanged && !doneChanged) return null;
  if (dueChanged && doneChanged) return 'Todo updated';

  if (doneChanged) return next.isDone ? 'Marked done' : 'Marked not done';
  if (!next.dueDate) return 'Due date removed';
  if (!prev.dueDate) return `Due date set to ${formatDueDate(next.dueDate)}`;
  return `Due date changed to ${formatDueDate(next.dueDate)}`;
}

/**
 * Puts dueDate/isDone back to their pre-change values. Deliberately field-scoped
 * rather than a full snapshot restore: within the undo window the same entry can
 * be edited in the composer or overwritten by the cross-device merge poll, and
 * undoing a due-date change must not discard that. A deleted entry is a no-op.
 */
export async function revertTodoFields(adapter: StorageAdapter, prev: Entry): Promise<void> {
  const entries = await adapter.getEntriesForTimeline(prev.timelineId);
  const current = entries.find((e) => e.id === prev.id);
  if (!current) return;
  await adapter.putEntry({ ...current, dueDate: prev.dueDate, isDone: prev.isDone });
}

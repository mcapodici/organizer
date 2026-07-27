import { describe, it, expect } from 'vitest';
import { describeTodoChange, revertTodoFields } from './todoUndo';
import { formatDueDate } from './dateFormat';
import { FakeAdapter } from '../test-utils/fakeAdapter';
import type { Entry } from '../types';

const en = (over: Partial<Entry> = {}): Entry => ({
  id: 'e1',
  timelineId: 't1',
  content: 'body',
  timestamp: '2026-01-01T00:00:00Z',
  attachments: [],
  isStart: false,
  ...over,
});

describe('describeTodoChange', () => {
  it('returns null for identical entries', () => {
    expect(describeTodoChange(en(), en())).toBeNull();
  });

  it('returns null for a content-only change', () => {
    expect(describeTodoChange(en({ dueDate: '2026-02-01' }), en({ dueDate: '2026-02-01', content: 'edited' }))).toBeNull();
  });

  it('returns null for a timestamp-only change', () => {
    const prev = en({ dueDate: '2026-02-01' });
    const next = en({ dueDate: '2026-02-01', timestamp: '2026-03-03T09:00:00Z' });
    expect(describeTodoChange(prev, next)).toBeNull();
  });

  it('labels marking done', () => {
    expect(describeTodoChange(en({ dueDate: '2026-02-01' }), en({ dueDate: '2026-02-01', isDone: true })))
      .toBe('Marked done');
  });

  it('labels marking not done', () => {
    expect(describeTodoChange(en({ dueDate: '2026-02-01', isDone: true }), en({ dueDate: '2026-02-01', isDone: false })))
      .toBe('Marked not done');
  });

  it('labels a due date being set for the first time', () => {
    expect(describeTodoChange(en(), en({ dueDate: '2026-02-01' })))
      .toBe(`Due date set to ${formatDueDate('2026-02-01')}`);
  });

  it('labels a due date moving to a different day', () => {
    expect(describeTodoChange(en({ dueDate: '2026-02-01' }), en({ dueDate: '2026-02-08' })))
      .toBe(`Due date changed to ${formatDueDate('2026-02-08')}`);
  });

  it('labels a due date being removed', () => {
    expect(describeTodoChange(en({ dueDate: '2026-02-01' }), en({ dueDate: undefined }))).toBe('Due date removed');
  });

  it('falls back to a generic label when both fields change at once', () => {
    // The popover's Remove clears dueDate and isDone together.
    const prev = en({ dueDate: '2026-02-01', isDone: true });
    const next = en({ dueDate: undefined, isDone: undefined });
    expect(describeTodoChange(prev, next)).toBe('Todo updated');
  });
});

describe('revertTodoFields', () => {
  it('restores dueDate and isDone', async () => {
    const adapter = new FakeAdapter();
    const prev = en({ dueDate: '2026-02-01' });
    await adapter.putEntry({ ...prev, isDone: true });

    await revertTodoFields(adapter, prev);

    expect(adapter.entries[0].dueDate).toBe('2026-02-01');
    expect(adapter.entries[0].isDone).toBeUndefined();
  });

  it('keeps a content edit written between the change and the undo', async () => {
    const adapter = new FakeAdapter();
    const prev = en({ dueDate: '2026-02-01' });
    // Marked done, then the body was edited in the composer.
    await adapter.putEntry({ ...prev, isDone: true, content: 'edited in the meantime' });

    await revertTodoFields(adapter, prev);

    expect(adapter.entries[0].content).toBe('edited in the meantime');
    expect(adapter.entries[0].isDone).toBeUndefined();
  });

  it('is a silent no-op when the entry was deleted', async () => {
    const adapter = new FakeAdapter();
    const prev = en({ dueDate: '2026-02-01' });

    await revertTodoFields(adapter, prev);

    expect(adapter.entries).toEqual([]);
  });
});

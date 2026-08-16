import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Timeline, Entry } from '../../types';

const registerActiveEdit = vi.fn();
const H = vi.hoisted(() => ({
  typed: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'typed' }] }] }),
}));

vi.mock('../../context/StorageContext', () => ({
  useStorage: () => ({ registerActiveEdit }),
}));

// TipTap does not render meaningfully in jsdom, so stand in a lightweight
// composer that exposes the Save/Cancel handlers TimelineView wires up.
vi.mock('../EntryComposer/EntryComposer', () => ({
  EntryComposer: ({ editing, onSave, onCancel }: {
    editing: Entry | null;
    onSave: (d: { content: string; timestamp: string; attachments: Entry['attachments'] }) => Promise<void>;
    onCancel: () => void;
  }) => (
    <div data-testid="composer">
      <span>{editing ? 'Editing Note' : 'New Note'}</span>
      <button onClick={() => onSave({ content: H.typed, timestamp: '2026-02-02T00:00:00Z', attachments: [] })}>
        ComposerSave
      </button>
      <button onClick={onCancel}>ComposerCancel</button>
    </div>
  ),
}));

// EntryCard's real render pulls in the full ProseMirror schema; a stub keeps the
// TimelineView test about TimelineView, exposing the row-level actions it wires.
vi.mock('../EntryCard/EntryCard', () => ({
  EntryCard: ({ entry, onEdit, onDelete }: {
    entry: Entry; onEdit: () => void; onDelete: () => void;
  }) => (
    <div data-testid={`card-${entry.id}`}>
      <button onClick={onEdit}>Edit {entry.id}</button>
      <button onClick={onDelete}>Delete {entry.id}</button>
    </div>
  ),
}));

import { TimelineView } from './TimelineView';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

const tl = (over: Partial<Timeline> = {}): Timeline => ({
  id: 't1', name: 'Tasks', createdAt: '2026-01-01T00:00:00Z', tags: [], ...over,
});
const en = (id: string, over: Partial<Entry> = {}): Entry => ({
  id, timelineId: 't1', content: doc(id), timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
});

interface Handlers {
  onUpdateTimeline: Mock<(t: Timeline) => void>;
  onAddEntry: Mock<(data: { content: string; timestamp: string; attachments: Entry['attachments']; dueDate?: string; isDone?: boolean }) => Promise<Entry>>;
  onUpdateEntry: Mock<(entry: Entry) => Promise<void>>;
  onDeleteEntry: Mock<(entry: Entry) => void | Promise<void>>;
}

function renderView(timeline: Timeline, entries: Entry[]): Handlers {
  const handlers: Handlers = {
    onUpdateTimeline: vi.fn(),
    onAddEntry: vi.fn(async (data) => en('created', data)),
    onUpdateEntry: vi.fn(async () => {}),
    onDeleteEntry: vi.fn(),
  };
  render(
    <MemoryRouter>
      <TimelineView
        timeline={timeline}
        entries={entries}
        allTags={['work', 'home']}
        onUpdateTimeline={handlers.onUpdateTimeline}
        onAddEntry={handlers.onAddEntry}
        onUpdateEntry={handlers.onUpdateEntry}
        onDeleteEntry={handlers.onDeleteEntry}
      />
    </MemoryRouter>,
  );
  return handlers;
}

beforeEach(() => { registerActiveEdit.mockReset(); });

describe('TimelineView — rename', () => {
  it('saves a trimmed, changed name', () => {
    const { onUpdateTimeline } = renderView(tl(), []);

    fireEvent.click(screen.getByRole('button', { name: 'Rename timeline' }));
    const input = screen.getByDisplayValue('Tasks');
    fireEvent.change(input, { target: { value: '  Chores  ' } });
    fireEvent.blur(input);

    expect(onUpdateTimeline).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chores' }));
  });

  it('does not save when the name is unchanged', () => {
    const { onUpdateTimeline } = renderView(tl(), []);

    fireEvent.click(screen.getByRole('button', { name: 'Rename timeline' }));
    fireEvent.blur(screen.getByDisplayValue('Tasks'));

    expect(onUpdateTimeline).not.toHaveBeenCalled();
  });
});

describe('TimelineView — create', () => {
  it('adds a new entry from the composer', async () => {
    const { onAddEntry } = renderView(tl(), []);

    fireEvent.click(screen.getByRole('button', { name: 'ComposerSave' }));

    await waitFor(() => expect(onAddEntry).toHaveBeenCalled());
    expect(onAddEntry.mock.calls[0][0]).toMatchObject({ content: H.typed });
  });
});

describe('TimelineView — edit', () => {
  it('updates the entry being edited rather than adding a new one', async () => {
    const { onUpdateEntry, onAddEntry } = renderView(tl(), [en('e1')]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit e1' }));
    expect(screen.getByText('Editing Note')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ComposerSave' }));

    await waitFor(() => expect(onUpdateEntry).toHaveBeenCalled());
    expect(onUpdateEntry.mock.calls[0][0]).toMatchObject({ id: 'e1', content: H.typed });
    expect(onAddEntry).not.toHaveBeenCalled();
  });

  it('registers the active edit with the storage layer', async () => {
    renderView(tl(), [en('e1')]);
    registerActiveEdit.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Edit e1' }));

    await waitFor(() =>
      expect(registerActiveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' })),
    );
  });
});

describe('TimelineView — delete', () => {
  it('deletes only after the confirmation modal is accepted', () => {
    const { onDeleteEntry } = renderView(tl(), [en('e1')]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete e1' }));
    expect(onDeleteEntry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDeleteEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('does not delete when the modal is cancelled', () => {
    const { onDeleteEntry } = renderView(tl(), [en('e1')]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete e1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDeleteEntry).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete this entry? This cannot be undone.')).toBeNull();
  });
});

describe('TimelineView — tags', () => {
  it('saves the current tags from the edit-tags modal', () => {
    const { onUpdateTimeline } = renderView(tl({ tags: ['work'] }), []);

    fireEvent.click(screen.getByRole('button', { name: /Edit tags/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateTimeline).toHaveBeenCalledWith(expect.objectContaining({ tags: ['work'] }));
  });
});

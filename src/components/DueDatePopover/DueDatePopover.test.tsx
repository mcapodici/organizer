import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Entry } from '../../types';
import { toLocalDateString } from '../../utils/dateFormat';
import { DueDatePopover } from './DueDatePopover';

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', timelineId: 't1', content: doc('task'),
    timestamp: '2026-01-01T00:00:00Z', attachments: [], isStart: false, ...over,
  };
}

const anchorRect = { top: 100, bottom: 120, left: 50, right: 250, width: 200, height: 20 } as DOMRect;

function renderPopover(over: Partial<Entry> = {}) {
  const onUpdate = vi.fn();
  const onClose = vi.fn();
  render(<DueDatePopover entry={entry(over)} anchorRect={anchorRect} onUpdate={onUpdate} onClose={onClose} />);
  return { onUpdate, onClose };
}

describe('DueDatePopover', () => {
  it('sets the due date to today and closes', async () => {
    const { onUpdate, onClose } = renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0].dueDate).toBe(toLocalDateString(new Date()));
    expect(onClose).toHaveBeenCalled();
  });

  it('sets the due date a week out via Next Week', async () => {
    const { onUpdate } = renderPopover();
    const week = new Date();
    week.setDate(week.getDate() + 7);

    fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0].dueDate).toBe(toLocalDateString(week));
  });

  it('accepts a date typed into the date input', async () => {
    const { onUpdate } = renderPopover();

    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2030-06-15' } });

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0].dueDate).toBe('2030-06-15');
  });

  it('toggles an undone item to done', async () => {
    const { onUpdate } = renderPopover({ dueDate: '2000-01-01', isDone: false });

    fireEvent.click(screen.getByRole('button', { name: /Mark done/ }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0].isDone).toBe(true);
  });

  it('offers to un-mark an already-done item', () => {
    renderPopover({ dueDate: '2000-01-01', isDone: true });
    expect(screen.getByRole('button', { name: /Mark not done/ })).toBeTruthy();
  });

  it('clears the due date and done flag on Remove', async () => {
    const { onUpdate } = renderPopover({ dueDate: '2000-01-01', isDone: true });

    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0].dueDate).toBeUndefined();
    expect(onUpdate.mock.calls[0][0].isDone).toBeUndefined();
  });

  it('closes when Escape is pressed', () => {
    const { onClose } = renderPopover();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('highlights the quick option matching the current due date', () => {
    renderPopover({ dueDate: toLocalDateString(new Date()) });
    const today = screen.getByRole('button', { name: 'Today' });
    expect(today.className).toContain('quickBtnActive');
  });
});

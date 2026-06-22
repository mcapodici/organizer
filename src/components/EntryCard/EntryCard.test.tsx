import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Entry } from '../../types';

vi.mock('../../context/StorageContext', () => ({
  useStorage: () => ({ adapter: { getBlob: vi.fn() } }),
}));

import { EntryCard } from './EntryCard';

// Builds a Tiptap doc with a task list. Each item is [text, checked].
function taskDoc(items: Array<[string, boolean]>): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: items.map(([text, checked]) => ({
          type: 'taskItem',
          attrs: { checked },
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
    ],
  });
}

function entry(content: string, over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    timelineId: 't1',
    content,
    timestamp: '2026-01-01T00:00:00Z',
    attachments: [],
    isStart: false,
    ...over,
  };
}

function checkboxes(container: HTMLElement): HTMLInputElement[] {
  return Array.from(
    container.querySelectorAll('li[data-type="taskItem"] > label input[type="checkbox"]'),
  ) as HTMLInputElement[];
}

function checkedFlags(content: string): boolean[] {
  const json = JSON.parse(content);
  const list = json.content.find((n: { type: string }) => n.type === 'taskList');
  return list.content.map((item: { attrs: { checked: boolean } }) => item.attrs.checked);
}

describe('EntryCard inline task checkboxes', () => {
  it('ticks an unchecked item and saves the toggled content', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <EntryCard entry={entry(taskDoc([['buy milk', false]]))} onUpdate={onUpdate} />,
    );

    fireEvent.click(checkboxes(container)[0]);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(checkedFlags(onUpdate.mock.calls[0][0].content)).toEqual([true]);
  });

  it('unticks a checked item', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <EntryCard entry={entry(taskDoc([['done thing', true]]))} onUpdate={onUpdate} />,
    );

    fireEvent.click(checkboxes(container)[0]);

    expect(checkedFlags(onUpdate.mock.calls[0][0].content)).toEqual([false]);
  });

  it('toggles only the clicked item among several', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <EntryCard
        entry={entry(taskDoc([['a', false], ['b', false], ['c', true]]))}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(checkboxes(container)[1]);

    expect(checkedFlags(onUpdate.mock.calls[0][0].content)).toEqual([false, true, true]);
  });

  it('maps DOM order to JSON order for nested task items', () => {
    // parent "a" (unchecked) contains a nested item "a1" (unchecked), then "b".
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
                {
                  type: 'taskList',
                  content: [
                    {
                      type: 'taskItem',
                      attrs: { checked: false },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a1' }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
            },
          ],
        },
      ],
    });
    const onUpdate = vi.fn();
    const { container } = render(<EntryCard entry={entry(doc)} onUpdate={onUpdate} />);

    // DOM order is pre-order: [a, a1, b]; click the nested item (index 1).
    fireEvent.click(checkboxes(container)[1]);

    const json = JSON.parse(onUpdate.mock.calls[0][0].content);
    const parent = json.content[0].content[0];
    const nested = parent.content.find((n: { type: string }) => n.type === 'taskList').content[0];
    expect(parent.attrs.checked).toBe(false); // parent untouched
    expect(nested.attrs.checked).toBe(true); // nested toggled
  });

  it('does not save when the task text (not the checkbox) is clicked', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <EntryCard entry={entry(taskDoc([['hello', false]]))} onUpdate={onUpdate} />,
    );

    const textDiv = container.querySelector('li[data-type="taskItem"] > div') as HTMLElement;
    fireEvent.click(textDiv);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not throw when no onUpdate handler is provided', () => {
    const { container } = render(<EntryCard entry={entry(taskDoc([['x', false]]))} />);
    expect(() => fireEvent.click(checkboxes(container)[0])).not.toThrow();
  });

  it('preserves the rest of the entry when saving', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <EntryCard
        entry={entry(taskDoc([['x', false]]), { id: 'keep-me', timelineId: 'tl-9' })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(checkboxes(container)[0]);

    const saved = onUpdate.mock.calls[0][0];
    expect(saved.id).toBe('keep-me');
    expect(saved.timelineId).toBe('tl-9');
  });
});

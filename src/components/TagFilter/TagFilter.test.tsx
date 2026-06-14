import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagFilter } from './TagFilter';

describe('TagFilter', () => {
  it('shows an empty-state message when there are no tags', () => {
    render(<TagFilter allTags={[]} selected={[]} onChange={() => {}} />);
    expect(screen.getByText(/no tags yet/i)).toBeTruthy();
  });

  it('renders a button per tag', () => {
    render(<TagFilter allTags={['work', 'home']} selected={[]} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'work' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'home' })).toBeTruthy();
  });

  it('selects an unselected tag on click', async () => {
    const onChange = vi.fn();
    render(<TagFilter allTags={['work', 'home']} selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'work' }));
    expect(onChange).toHaveBeenCalledWith(['work']);
  });

  it('deselects an already-selected tag on click', async () => {
    const onChange = vi.fn();
    render(<TagFilter allTags={['work', 'home']} selected={['work']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'work' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows a Clear button only when something is selected, and clears all on click', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TagFilter allTags={['work']} selected={[]} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    rerender(<TagFilter allTags={['work']} selected={['work']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

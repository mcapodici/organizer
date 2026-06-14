import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput } from './TagInput';

describe('TagInput', () => {
  it('adds a typed tag when Enter is pressed', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} allTags={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'newtag{Enter}');
    expect(onChange).toHaveBeenCalledWith(['newtag']);
  });

  it('adds a typed tag when a comma is pressed', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['existing']} allTags={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'another,');
    expect(onChange).toHaveBeenCalledWith(['existing', 'another']);
  });

  it('does not add a duplicate tag', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['dup']} allTags={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'dup{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('trims whitespace around a new tag', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} allTags={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '  spaced  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['spaced']);
  });

  it('removes a tag via its remove button', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['a', 'b']} allTags={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('removes the last tag on Backspace when the input is empty', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['a', 'b']} allTags={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('shows matching suggestions that are not already applied', async () => {
    render(<TagInput tags={['banana']} allTags={['apple', 'apricot', 'banana']} onChange={() => {}} />);
    await userEvent.type(screen.getByRole('textbox'), 'ap');
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.getByText('apricot')).toBeTruthy();
    // 'banana' is already applied → never offered as a suggestion
    expect(screen.queryByRole('listitem', { name: 'banana' })).toBeNull();
  });

  it('adds a suggestion when it is clicked', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} allTags={['apple']} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'ap');
    await userEvent.click(screen.getByText('apple'));
    expect(onChange).toHaveBeenCalledWith(['apple']);
  });

  it('commits a typed-but-unconfirmed tag when the input loses focus', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} allTags={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'mytag');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(['mytag']);
  });
});

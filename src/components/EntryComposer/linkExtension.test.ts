import { describe, it, expect, afterEach } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EntryLink } from './linkExtension';

function makeEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, EntryLink],
    content,
  });
}

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('EntryLink', () => {
  it('does not extend the link when typing immediately after it', () => {
    editor = makeEditor('<p><a href="https://example.com">https://example.com</a></p>');

    // Put the cursor at the very end of the link, then type the rest of the sentence.
    editor.commands.focus('end');
    editor.commands.insertContent(' and then more text');

    const nodes: JSONContent[] = editor.getJSON().content?.[0]?.content ?? [];
    const linkedText = nodes
      .filter((node) => node.marks?.some((mark) => mark.type === 'link'))
      .map((node) => node.text ?? '')
      .join('');

    expect(linkedText).toBe('https://example.com');
    expect(editor.getText()).toBe('https://example.com and then more text');
    // The trailing text must not be wrapped in an anchor tag.
    expect(editor.getHTML()).toContain('</a> and then more text');
  });

  it('still keeps text inside the link when typing in the middle of it', () => {
    editor = makeEditor('<p><a href="https://example.com">https://example.com</a></p>');

    // Place the cursor inside the link (after "https://exa") and type.
    editor.commands.setTextSelection(12);
    editor.commands.insertContent('X');

    const node: JSONContent | undefined = editor.getJSON().content?.[0]?.content?.[0];
    expect(node?.marks?.some((mark) => mark.type === 'link')).toBe(true);
    expect(node?.text ?? '').toContain('X');
  });
});

// Prepend a visible marker paragraph to a note's TipTap JSON content so a merged
// duplicate is easy to spot in the timeline. No-ops if the content can't be parsed.
export function markMergedCopy(content: string): string {
  try {
    const doc = JSON.parse(content);
    const banner = {
      type: 'paragraph',
      content: [{
        type: 'text',
        marks: [{ type: 'bold' }],
        text: '⚠ Merged copy from another device',
      }],
    };
    doc.content = [banner, ...(Array.isArray(doc.content) ? doc.content : [])];
    return JSON.stringify(doc);
  } catch {
    return content;
  }
}

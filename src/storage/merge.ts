import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';

export interface MergeOutcome {
  timelines: Timeline[];
  entries: Entry[];
  duplicatedEntryId: string | null;
}

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

// Produce the merged entry/timeline set after another instance saved changes.
//
// Because writes flush immediately and a conflict freezes further writes, the
// warned tab never holds divergent *saved* changes — so we adopt the disk state
// wholesale. The one local change that can't be on disk is an unsaved note open
// in the editor (`activeBase`). If that note was also changed on disk, we keep
// the editor's note under its own id (so the in-progress edit saves cleanly) and
// preserve the disk version as a marked duplicate.
export function mergeDiskState(
  diskTimelines: Timeline[],
  diskEntries: Entry[],
  activeBase: Entry | null,
): MergeOutcome {
  if (!activeBase) {
    return { timelines: diskTimelines, entries: diskEntries, duplicatedEntryId: null };
  }
  const diskActive = diskEntries.find((e) => e.id === activeBase.id);
  if (!diskActive || diskActive.content === activeBase.content) {
    return { timelines: diskTimelines, entries: diskEntries, duplicatedEntryId: null };
  }
  const dupId = uuid();
  const dup: Entry = { ...diskActive, id: dupId, content: markMergedCopy(diskActive.content) };
  const entries = diskEntries
    .map((e) => (e.id === activeBase.id ? activeBase : e))
    .concat(dup);
  return { timelines: diskTimelines, entries, duplicatedEntryId: dupId };
}

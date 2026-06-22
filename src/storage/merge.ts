import { v4 as uuid } from 'uuid';
import type { Timeline, Entry } from '../types';

export interface MergeOutcome {
  timelines: Timeline[];
  entries: Entry[];
  duplicatedEntryId: string | null;
}

export interface ForeignMergeOutcome {
  timelines: Timeline[];
  entries: Entry[];
  importedCount: number;
  conflictCount: number;
}

// ISO timestamps compare correctly lexicographically. A missing incoming stamp
// never wins; a missing current stamp always loses to a present incoming one.
function isNewer(incoming?: string, current?: string): boolean {
  if (!incoming) return false;
  if (!current) return true;
  return incoming > current;
}

// Merge an independently-saved ("foreign") set of timelines/entries — e.g. a
// Syncthing `.sync-conflict-*` file — into the current set without losing data.
//
// Entries: a brand-new id is added; an id whose content matches is skipped; an
// id whose content differs is kept BOTH ways — the current note is left as-is and
// the incoming version is added under a fresh id with a visible "merged copy"
// banner. Timelines: missing ones are added (so imported notes aren't orphaned);
// an existing id keeps whichever side has the later `updatedAt` so a rename made
// elsewhere survives.
export function mergeForeignState(
  currentTimelines: Timeline[],
  currentEntries: Entry[],
  incomingTimelines: Timeline[],
  incomingEntries: Entry[],
): ForeignMergeOutcome {
  const timelines = [...currentTimelines];
  const tlIndex = new Map(timelines.map((t, i) => [t.id, i]));
  for (const inc of incomingTimelines) {
    const idx = tlIndex.get(inc.id);
    if (idx === undefined) {
      tlIndex.set(inc.id, timelines.length);
      timelines.push(inc);
    } else if (isNewer(inc.updatedAt, timelines[idx].updatedAt)) {
      timelines[idx] = inc;
    }
  }

  const entries = [...currentEntries];
  const byId = new Map(entries.map((e) => [e.id, e]));
  let importedCount = 0;
  let conflictCount = 0;
  for (const inc of incomingEntries) {
    const current = byId.get(inc.id);
    if (!current) {
      entries.push(inc);
      importedCount++;
    } else if (current.content !== inc.content) {
      entries.push({ ...inc, id: uuid(), content: markMergedCopy(inc.content) });
      importedCount++;
      conflictCount++;
    }
  }

  return { timelines, entries, importedCount, conflictCount };
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

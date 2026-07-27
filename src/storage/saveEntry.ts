import { v4 as uuid } from 'uuid';
import type { Entry } from '../types';
import type { StorageAdapter } from './interface';
import { markMergedCopy } from './merge';

export interface SaveEntryResult {
  /** Set when the stored note had moved on under us and was preserved as a copy. */
  duplicatedEntryId: string | null;
}

// The single place that owns write policy for a note.
//
// Every write mints a fresh `rev`. If the stored note's `rev` no longer matches
// the one the caller loaded, another tab changed it in the meantime — so instead
// of clobbering it we keep BOTH: the stored version is re-filed under a new id
// with a visible "merged copy" banner, and the caller's version is written under
// its own id as usual.
//
// This lives here rather than inside an adapter deliberately: OPFS cannot do a
// cross-file atomic transaction, so the read-then-write cannot be pushed down
// into a single IDB transaction without forking the two backends. It is
// narrowly TOCTOU as a result — two tabs saving the same note inside one tick
// still last-write-win (see SYNC_REVIEW.md).
//
// Entries with no `rev` (data written before the field existed) fail open to
// last-write-wins, and self-heal after one save.
export async function saveEntry(adapter: StorageAdapter, entry: Entry): Promise<SaveEntryResult> {
  const stored = await adapter.getEntry(entry.id);

  let duplicatedEntryId: string | null = null;
  if (stored && stored.rev && entry.rev && stored.rev !== entry.rev) {
    duplicatedEntryId = uuid();
    await adapter.putEntry({
      ...stored,
      id: duplicatedEntryId,
      content: markMergedCopy(stored.content),
      rev: uuid(),
    });
  }

  await adapter.putEntry({ ...entry, rev: uuid() });
  return { duplicatedEntryId };
}

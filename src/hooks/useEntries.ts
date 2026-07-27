import { useState, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useStorage } from '../context/StorageContext';
import { saveEntry } from '../storage/saveEntry';
import type { Entry } from '../types';

export function useEntries(timelineId: string | null) {
  const { adapter, notifyMergedCopy } = useStorage();
  const [entries, setEntries] = useState<Entry[]>([]);

  const reload = useCallback(async () => {
    if (!timelineId) { setEntries([]); return; }
    const all = await adapter.getEntriesForTimeline(timelineId);
    // localeCompare returns 0 for equal timestamps, so same-timestamp entries keep
    // their original (insertion) order rather than being reversed.
    all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setEntries(all);
  }, [timelineId, adapter]);

  // reload() is async and setStates past an await; the rule can't see that.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  const addEntry = useCallback(async (
    partial: Omit<Entry, 'id' | 'timelineId' | 'isStart'>
  ): Promise<Entry> => {
    if (!timelineId) throw new Error('No timeline selected');
    const entry: Entry = { id: uuid(), timelineId, isStart: false, ...partial };
    await saveEntry(adapter, entry);
    await reload();
    return entry;
  }, [timelineId, adapter, reload]);

  // saveEntry keeps a version another tab wrote rather than clobbering it; when
  // it does, the user ends up with a note they didn't create, so say so.
  const updateEntry = useCallback(async (entry: Entry) => {
    const { duplicatedEntryId } = await saveEntry(adapter, entry);
    if (duplicatedEntryId) notifyMergedCopy();
    await reload();
  }, [adapter, reload, notifyMergedCopy]);

  const removeEntry = useCallback(async (entry: Entry) => {
    for (const att of entry.attachments) {
      await adapter.deleteBlob(att.blobKey);
    }
    await adapter.deleteEntry(entry.id);
    await reload();
  }, [adapter, reload]);

  return { entries, addEntry, updateEntry, removeEntry, reload };
}

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useStorage } from '../context/StorageContext';
import type { Entry } from '../types';

export function useEntries(timelineId: string | null) {
  const { adapter } = useStorage();
  const [entries, setEntries] = useState<Entry[]>([]);

  const reload = useCallback(async () => {
    if (!timelineId) { setEntries([]); return; }
    const all = await adapter.getEntriesForTimeline(timelineId);
    // localeCompare returns 0 for equal timestamps, so same-timestamp entries keep
    // their original (insertion) order rather than being reversed.
    all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setEntries(all);
  }, [timelineId, adapter]);

  useEffect(() => { reload(); }, [reload]);

  const addEntry = useCallback(async (
    partial: Omit<Entry, 'id' | 'timelineId' | 'isStart'>
  ): Promise<Entry> => {
    if (!timelineId) throw new Error('No timeline selected');
    const entry: Entry = { id: uuid(), timelineId, isStart: false, ...partial };
    await adapter.putEntry(entry);
    await reload();
    return entry;
  }, [timelineId, adapter, reload]);

  const updateEntry = useCallback(async (entry: Entry) => {
    await adapter.putEntry(entry);
    await reload();
  }, [adapter, reload]);

  const removeEntry = useCallback(async (entry: Entry) => {
    for (const att of entry.attachments) {
      await adapter.deleteBlob(att.blobKey);
    }
    await adapter.deleteEntry(entry.id);
    await reload();
  }, [adapter, reload]);

  return { entries, addEntry, updateEntry, removeEntry, reload };
}

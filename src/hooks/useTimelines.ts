import { useState, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useStorage } from '../context/StorageContext';
import type { Timeline } from '../types';
import { nowIso, compareTimestamps } from '../utils/dateFormat';

export function useTimelines() {
  const { adapter } = useStorage();
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await adapter.getAllTimelines();
    // Most recently changed first. Fall back to createdAt for data saved before
    // updatedAt existed.
    const changed = (t: Timeline) => t.updatedAt ?? t.createdAt;
    // compareTimestamps orders by instant and returns 0 for ties, keeping
    // equal-"changed" timelines in their original order instead of reversing.
    all.sort((a, b) => compareTimestamps(changed(b), changed(a)));
    setTimelines(all);
    setLoading(false);
  }, [adapter]);

  // reload() is async and setStates past an await; the rule can't see that.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  const createTimeline = useCallback(async (name: string): Promise<Timeline> => {
    const now = nowIso();
    const t: Timeline = { id: uuid(), name, createdAt: now, updatedAt: now, tags: [] };
    await adapter.putTimeline(t);
    await reload();
    return t;
  }, [adapter, reload]);

  // Any rename, tag edit, or entry change routes through here, so this is where
  // we stamp updatedAt to drive the "recently changed" ordering in the sidebar.
  const updateTimeline = useCallback(async (timeline: Timeline) => {
    await adapter.putTimeline({ ...timeline, updatedAt: nowIso() });
    await reload();
  }, [adapter, reload]);

  const removeTimeline = useCallback(async (id: string) => {
    const entries = await adapter.getEntriesForTimeline(id);
    for (const entry of entries) {
      for (const att of entry.attachments) {
        await adapter.deleteBlob(att.blobKey);
      }
    }
    await adapter.deleteEntriesForTimeline(id);
    await adapter.deleteTimeline(id);
    await reload();
  }, [adapter, reload]);

  return { timelines, loading, createTimeline, updateTimeline, removeTimeline, reload };
}

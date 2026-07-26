import { useState, useEffect, useCallback } from 'react';
import { useStorage } from '../context/StorageContext';
import { todayDateString } from '../utils/dateFormat';

export interface TodoCount {
  count: number;
  overdue: number;
}

export function useTodoCounts() {
  const { adapter } = useStorage();
  const [todoCounts, setTodoCounts] = useState<Record<string, TodoCount>>({});

  const reloadTodoCounts = useCallback(async () => {
    const today = todayDateString();
    const all = await adapter.getAllEntries();
    const result: Record<string, TodoCount> = {};
    for (const entry of all) {
      if (entry.dueDate && !entry.isDone) {
        const rec = result[entry.timelineId] ?? { count: 0, overdue: 0 };
        rec.count += 1;
        if (entry.dueDate < today) rec.overdue += 1;
        result[entry.timelineId] = rec;
      }
    }
    setTodoCounts(result);
  }, [adapter]);

  // reloadTodoCounts() is async and setStates past an await; the rule can't see that.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadTodoCounts(); }, [reloadTodoCounts]);

  return { todoCounts, reloadTodoCounts };
}

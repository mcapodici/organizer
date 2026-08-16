import { useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { NavigateFunction } from 'react-router-dom';
import type { StorageAdapter } from '../storage/interface';
import type { Timeline } from '../types';
import { WELCOME_KEY, WELCOME_CONTENT } from '../utils/welcome';

interface UseWelcomeSeedParams {
  loading: boolean;
  timelineCount: number;
  adapter: StorageAdapter;
  createTimeline: (name: string) => Promise<Timeline>;
  navigate: NavigateFunction;
}

// First-run welcome timeline. Runs once on an empty store (guarded by
// WELCOME_KEY) and also exposes the seeder so the empty-state "Restore welcome
// guide" button can replay it on demand.
export function useWelcomeSeed({
  loading,
  timelineCount,
  adapter,
  createTimeline,
  navigate,
}: UseWelcomeSeedParams) {
  async function seedWelcomeTimeline() {
    localStorage.setItem(WELCOME_KEY, '1');
    const timeline = await createTimeline('Getting Started');
    await adapter.putEntry({
      id: uuid(),
      timelineId: timeline.id,
      content: JSON.stringify(WELCOME_CONTENT),
      timestamp: timeline.createdAt,
      attachments: [],
      isStart: true,
    });
    navigate(`/timelines/${timeline.id}`, { replace: true });
  }

  useEffect(() => {
    if (loading || timelineCount > 0) return;
    if (localStorage.getItem(WELCOME_KEY)) return;
    seedWelcomeTimeline();
  // seedWelcomeTimeline is stable enough for this once-per-empty-store effect,
  // guarded by WELCOME_KEY.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timelineCount]);

  return { seedWelcomeTimeline };
}

// Route parsing for the app shell. App used to string-match `location.pathname`
// inline; centralising it keeps the shell declarative and the regex in one place.
export interface AppRoute {
  isTodoPage: boolean;
  isSettingsPage: boolean;
  /** Timeline id from `/timelines/:id`, or null on any other route. */
  urlId: string | null;
}

export function parseRoute(pathname: string): AppRoute {
  const timelineMatch = pathname.match(/^\/timelines\/([^/]+)$/);
  return {
    isTodoPage: pathname === '/todos',
    isSettingsPage: pathname === '/settings',
    urlId: timelineMatch ? timelineMatch[1] : null,
  };
}

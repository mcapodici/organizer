# Active tag filter keeps hiding timelines after its panel is collapsed, with no way to clear

- Area: tags
- Type: UX
- Severity: Medium
- Screen/route: Sidebar filter — `src/components/TimelineList/TimelineList.tsx` (lines 92-105) + `src/components/TagFilter/TagFilter.tsx`.
- Repro:
  1. Boot the seeded app.
  2. Click **Filter** at the top of the sidebar to open the tag panel.
  3. Click **personal** — the timeline list narrows to 2 timelines (Marathon training, Journal).
  4. Click **Filter** again to collapse the panel.
- Observed: Collapsing the panel unmounts the whole `TagFilter` — including the selected-tag chips and the **Clear** button — but `filterTags` state stays applied, so the list is still filtered down to 2 of 5 timelines. The only remaining cue is a small `1` count badge on the Filter button; the three "missing" timelines look deleted. There is no way to see *which* tag is active or to clear it without reopening the panel. Verified in the DOM: after collapsing, `panelOpen=false`, list = `[Marathon training, Journal]`, and no `Clear` button exists anywhere on the page. See ./issue.webm and ./issue-1.png.
- Expected / proposed: When a filter is active but the panel is collapsed, keep a lightweight, always-visible indicator of the active tag(s) with an inline **Clear filters** control (or reveal Clear next to the Filter button). Removing the filter should not require reopening the panel.
- Improved demo: ./improved.webm (throwaway tweak: injected a persistent "Filtering by: personal · Clear filters" bar above the list while the panel stays collapsed). Also ./improved-1.png. Reverted with `reload`.
- Fix pointer: `src/components/TimelineList/TimelineList.tsx` — render a compact active-filter summary + Clear whenever `filterTags.length > 0`, independent of `showFilter`; or lift the Clear affordance out of `TagFilter` so it survives panel collapse.
- Effort: M

#!/usr/bin/env bash
# ── Todo watcher for Organizer ──────────────────────────────────────────
# Polls .llm/todo.md for the presence of an undone task (a line starting
# with "- [ ]"). When found, runs
# `claude -p /markdown-tasks:markdown-do-all-tasks --dangerously-skip-permissions`
# in the foreground so only one run is ever active at a time — the watch
# loop is paused for the whole duration of the run, by construction.
#
# Usage:  scripts/watch-todo.sh [poll-seconds]
#         (default poll interval: 5s)
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

POLL_SECONDS="${1:-5}"
TODO_FILE=".llm/todo.md"
LOG_FILE=".llm/watch-todo.log"
UNDONE_PATTERN='^- \[ \]'

mkdir -p .llm

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

has_undone_tasks() {
  [ -f "$TODO_FILE" ] && grep -qE "$UNDONE_PATTERN" "$TODO_FILE"
}

log "watch-todo started (poll every ${POLL_SECONDS}s)."

while true; do
  sleep "$POLL_SECONDS"

  if has_undone_tasks; then
    log "undone task found in $TODO_FILE — running do-all-tasks"

    if claude -p "/markdown-tasks:markdown-do-all-tasks" --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE"; then
      log "do-all-tasks run finished"
    else
      log "do-all-tasks run exited non-zero"
    fi

    log "resuming watch."
  fi
done

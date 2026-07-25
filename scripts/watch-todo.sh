#!/usr/bin/env bash
# ── Todo watcher for Organizer ──────────────────────────────────────────
# Polls .llm/todo.md for creation/changes. When it changes, runs
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

mkdir -p .llm

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

hash_of() {
  if [ -f "$TODO_FILE" ]; then
    shasum -a 256 "$TODO_FILE" | awk '{print $1}'
  else
    echo "MISSING"
  fi
}

last_hash="$(hash_of)"
log "watch-todo started (poll every ${POLL_SECONDS}s). baseline: $last_hash"

while true; do
  sleep "$POLL_SECONDS"

  current_hash="$(hash_of)"

  if [ "$current_hash" != "$last_hash" ] && [ -f "$TODO_FILE" ]; then
    log "change detected in $TODO_FILE (was: $last_hash, now: $current_hash) — running do-all-tasks"

    if claude -p "/markdown-tasks:markdown-do-all-tasks" --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE"; then
      log "do-all-tasks run finished"
    else
      log "do-all-tasks run exited non-zero"
    fi

    # Re-baseline on whatever state the file is in after the run (it may
    # have been archived/renamed away, or have more tasks marked done) so
    # the run's own edits don't immediately retrigger another pass.
    last_hash="$(hash_of)"
    log "resuming watch. new baseline: $last_hash"
  else
    last_hash="$current_hash"
  fi
done

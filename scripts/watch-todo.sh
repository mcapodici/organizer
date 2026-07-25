#!/usr/bin/env bash
# ── Todo watcher for Organizer ──────────────────────────────────────────
# Polls .llm/todo.md for the presence of an undone task (a line starting
# with "- [ ]"). When found, runs
# `claude -p /markdown-tasks:markdown-do-all-tasks --dangerously-skip-permissions`
# in the foreground so only one run is ever active at a time — the watch
# loop is paused for the whole duration of the run, by construction.
#
# Each run gets its own --session-id, and is invoked with
# --output-format json so the watcher can log a structured one-line
# summary (turns/cost/duration/result) instead of raw chat text. The full
# turn-by-turn transcript is still available afterward — Claude Code
# writes it to ~/.claude/projects/<sanitized-cwd>/<session-id>.jsonl —
# and its path is logged so it can be dug into if a run looks off.
#
# Usage:  scripts/watch-todo.sh [poll-seconds]
#         (default poll interval: 5s)
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

for bin in jq uuidgen; do
  command -v "$bin" >/dev/null 2>&1 || { echo "watch-todo.sh requires '$bin' on PATH" >&2; exit 1; }
done

POLL_SECONDS="${1:-5}"
TODO_FILE=".llm/todo.md"
LOG_FILE=".llm/watch-todo.log"
UNDONE_PATTERN='^- \[ \]'
TRANSCRIPT_DIR="$HOME/.claude/projects/$(pwd | tr '/' '-')"

mkdir -p .llm

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

has_undone_tasks() {
  [ -f "$TODO_FILE" ] && grep -qE "$UNDONE_PATTERN" "$TODO_FILE"
}

task_progress() {
  if [ -f "$TODO_FILE" ]; then
    local done total
    done="$(grep -cE '^- \[x\]' "$TODO_FILE" || true)"
    total="$(grep -cE '^- \[[ x]\]' "$TODO_FILE" || true)"
    echo "${done}/${total} tasks done"
  else
    echo "no todo file"
  fi
}

log "watch-todo started (poll every ${POLL_SECONDS}s)."

while true; do
  sleep "$POLL_SECONDS"

  if has_undone_tasks; then
    log "undone task found in $TODO_FILE ($(task_progress)) — running do-all-tasks"

    session_id="$(uuidgen)"
    transcript="$TRANSCRIPT_DIR/$session_id.jsonl"

    if run_json="$(claude -p "/markdown-tasks:markdown-do-all-tasks" \
        --dangerously-skip-permissions \
        --output-format json \
        --session-id "$session_id" \
        2>>"$LOG_FILE")"; then
      cli_status="exited 0"
    else
      cli_status="exited non-zero"
    fi

    echo "$run_json" >>"$LOG_FILE"

    summary="$(echo "$run_json" | jq -r '
      "is_error=\(.is_error) turns=\(.num_turns) duration_ms=\(.duration_ms) cost_usd=\(.total_cost_usd) result=\(.result | tostring | .[0:200])"
    ' 2>/dev/null || echo "(unparseable json output — see raw entry above)")"

    log "do-all-tasks run finished ($cli_status): $summary"
    log "transcript: $transcript"
    log "task progress after run: $(task_progress)"
    log "resuming watch."
  fi
done

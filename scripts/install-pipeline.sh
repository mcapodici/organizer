#!/usr/bin/env bash
# Install the organizer pipeline as a launchd agent (runs every 5 minutes)
# Usage: bash scripts/install-pipeline.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$REPO_DIR/scripts/com.organizer.pipeline.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.organizer.pipeline.plist"
LOG_FILE="$REPO_DIR/.pipeline.log"

# Detect claude binary location
CLAUDE_BIN=$(which claude 2>/dev/null || echo "")
if [ -z "$CLAUDE_BIN" ]; then
  echo "Error: 'claude' not found in PATH. Install Claude Code first."
  exit 1
fi

echo "Installing organizer pipeline..."
echo "  Repo:   $REPO_DIR"
echo "  Claude: $CLAUDE_BIN"
echo "  Log:    $LOG_FILE"
echo ""

# Unload existing agent if present
if launchctl list com.organizer.pipeline &>/dev/null; then
  echo "Unloading existing agent..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Substitute paths into plist
sed \
  -e "s|ORGANIZER_PATH|$REPO_DIR|g" \
  -e "s|HOME_PATH|$HOME|g" \
  -e "s|/usr/local/bin/claude|$CLAUDE_BIN|g" \
  "$PLIST_SRC" > "$PLIST_DEST"

# Load the agent
launchctl load "$PLIST_DEST"

echo "Pipeline installed and running."
echo ""
echo "Commands:"
echo "  tail -f $REPO_DIR/.pipeline.log    # watch pipeline output"
echo "  launchctl unload $PLIST_DEST       # stop pipeline"
echo "  launchctl load   $PLIST_DEST       # start pipeline"
echo "  node .claude/chat/server.js        # start question UI (http://localhost:7331)"
echo ""
echo "To uninstall: launchctl unload $PLIST_DEST && rm $PLIST_DEST"

#!/usr/bin/env bash
# ── Preview Deploy for Organizer ──────────────────────────────────────
# Deploys the current branch to a Vercel preview environment and opens
# the preview URL in the default browser for human review.
#
# Usage:  ./scripts/deploy-preview.sh
#         npm run deploy:preview
#
# Prerequisites: Vercel CLI installed, project linked (via `vercel link`).
# Uses `--no-wait` so it returns instantly; the URL is valid even before
# the build completes (Vercel shows a build-status page).
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1. TypeScript check (tsc --noEmit) ==="
npx tsc --noEmit

echo ""
echo "=== 2. Running test suite ==="
npm test

echo ""
echo "=== 3. Building (vite) ==="
npx vite build

echo ""
echo "=== 4. Deploying to Vercel preview ==="
DEPLOY_OUTPUT=$(vercel deploy --no-wait --yes 2>&1)
echo "$DEPLOY_OUTPUT"

DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

if [ -n "$DEPLOY_URL" ]; then
  echo ""
  echo "=== 5. Opening preview: $DEPLOY_URL ==="
  open "$DEPLOY_URL"
  echo ""
  echo "✅ Preview deployed: $DEPLOY_URL"
else
  echo ""
  echo "⚠️  Could not extract preview URL. Check output above."
fi

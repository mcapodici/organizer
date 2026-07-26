#!/usr/bin/env bash
# ── Checks for Organizer ───────────────────────────────────────────────
# Runs all local checks before deploying or completing a task:
#   lint, tests, TypeScript, VitePress docs build, Vite app build.
# Exits non-zero on first failure.
#
# Usage:  bash scripts/check.sh
#         npm run check
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1. Lint ==="
npm run lint

echo ""
echo "=== 2. Running tests ==="
npx vitest run --no-file-parallelism

echo ""
echo "=== 3. TypeScript check ==="
npm run typecheck

echo ""
echo "=== 4. Building VitePress docs ==="
npx vitepress build docs

echo ""
echo "=== 5. Building Vite app ==="
npx vite build

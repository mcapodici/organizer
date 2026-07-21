#!/usr/bin/env bash
# ── Checks for Organizer ───────────────────────────────────────────────
# Runs all local checks before deploying or completing a task:
#   tests, TypeScript, VitePress docs build, Vite app build.
# Exits non-zero on first failure.
#
# Usage:  bash scripts/check.sh
#         npm run check
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1. Running tests ==="
npx vitest run --no-file-parallelism

echo ""
echo "=== 2. TypeScript check ==="
npx tsc -b

echo ""
echo "=== 3. Building VitePress docs ==="
npx vitepress build docs

echo ""
echo "=== 4. Building Vite app ==="
npx vite build

#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DOC_FILES=$(git ls-files 'docs/index.md' 'docs/guide/*' 'docs/tutorials/*' 'docs/use-cases/*')

for doc in $DOC_FILES; do
  last_commit=$(git log -1 --format='%H|%ad|%s' --date=short -- "$doc")
  hash="${last_commit%%|*}"
  echo "=== $doc ==="
  echo "last updated: $last_commit"
  echo "src/ changes since:"
  git log --oneline "$hash"..HEAD -- src/ || true
  echo
done

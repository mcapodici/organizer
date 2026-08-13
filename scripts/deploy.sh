#!/usr/bin/env bash
set -euo pipefail

# Run the full local check gate first; only deploy to prod if it passes.
cd "$(dirname "$0")/.."
bash scripts/check.sh

vercel deploy --prod

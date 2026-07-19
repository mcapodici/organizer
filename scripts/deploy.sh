#!/usr/bin/env bash
set -euo pipefail

# Run the test suite first; only deploy if it passes.
npm test

vercel deploy --prod

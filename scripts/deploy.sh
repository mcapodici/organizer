#!/usr/bin/env bash
set -euo pipefail

# Run TypeScript check first, then the test suite; only deploy if both pass.
npx tsc --noEmit
npm test

vercel deploy --prod

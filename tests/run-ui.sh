#!/usr/bin/env bash
# Menjalankan uji UI end-to-end (React SPA di jsdom).
# Prasyarat: Worker dev di http://127.0.0.1:8787 (npm run worker:dev) dan Vite dev di http://127.0.0.1:3000 (npm run dev).
set -euo pipefail
cd "$(dirname "$0")/.."
npx esbuild tests/ui-entry.jsx --bundle --platform=browser --format=cjs --jsx=automatic --loader:.css=empty --outfile=tests/ui-entry.bundle.cjs --log-level=error
if [ ! -d /tmp/harness/node_modules/jsdom ]; then
  mkdir -p /tmp/harness && npm install --prefix /tmp/harness jsdom@24 --no-audit --no-fund --silent
fi
node tests/ui-test.mjs

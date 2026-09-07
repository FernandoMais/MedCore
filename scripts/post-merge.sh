#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -x node_modules/.bin/vite ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci --ignore-scripts --no-audit --no-fund
  else
    npm install --ignore-scripts --no-audit --no-fund
  fi
fi

npm run build
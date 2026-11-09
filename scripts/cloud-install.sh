#!/usr/bin/env bash
set -euo pipefail
cd /workspace/qualcom
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run db:up
npm run seed
npm run build

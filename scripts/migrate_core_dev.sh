#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

if [ -z "${DATABASE_URL_DEV:-}" ]; then
  echo "❌ DATABASE_URL_DEV not set"
  exit 1
fi

echo "Applying core schema..."
psql "$DATABASE_URL_DEV" -v ON_ERROR_STOP=1 -f database/core_v1.sql
echo "✅ core schema applied."
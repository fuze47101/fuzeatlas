#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Loading .env from: $(pwd)/.env"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in repo root"
  exit 1
fi

set -a
source ".env"
set +a

if [ -z "${DATABASE_URL_DEV:-}" ]; then
  echo "ERROR: DATABASE_URL_DEV is empty or not set in .env"
  echo "Fix: open .env and add DATABASE_URL_DEV=... (Railway dev connection string)"
  exit 1
fi

echo "✅ Targeting DEV database (showing host only):"
python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL_DEV"])
print(f"host={u.hostname} port={u.port} db={u.path.lstrip('/')}")
PY

echo "Applying schema: database/schema_v1.sql"
psql "$DATABASE_URL_DEV" -v ON_ERROR_STOP=1 -f database/schema_v1.sql

echo "✅ DEV migration complete."
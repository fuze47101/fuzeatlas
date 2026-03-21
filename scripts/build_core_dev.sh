#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f ".env" ]]; then
  echo "❌ .env not found in $(pwd)"
  exit 1
fi

echo "Loading .env from: $(pwd)/.env"
set -a
source .env
set +a

if [[ -z "${DATABASE_URL_DEV:-}" ]]; then
  echo "❌ DATABASE_URL_DEV not set in .env"
  exit 1
fi

echo "✅ Targeting DEV database (host only):"
psql "$DATABASE_URL_DEV" -c "SELECT 'host='||inet_server_addr()||' port='||inet_server_port()||' db='||current_database();" -q

echo
echo "0) Sanity check: stg schema exists?"
psql "$DATABASE_URL_DEV" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name='stg';"

echo
echo "1) Applying core schema: database/core_v1.sql"
psql "$DATABASE_URL_DEV" -f database/core_v1.sql

echo
echo "2) Importing core data from stg.*"
python scripts/import_core_dev.py

echo
if [[ -f "scripts/qa_report_dev.py" ]]; then
  echo "3) QA report"
  python scripts/qa_report_dev.py
else
  echo "3) QA report skipped (scripts/qa_report_dev.py not found yet)"
fi

echo
echo "✅ CORE build complete."
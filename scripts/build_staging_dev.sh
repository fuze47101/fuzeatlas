#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
OUT_SQL="$ROOT/database/staging_from_raw_auto.sql"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ .env not found at: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL_DEV:-}" ]]; then
  echo "❌ DATABASE_URL_DEV is not set in .env"
  exit 1
fi

echo "Loading .env from: $ENV_FILE"
echo "✅ Targeting DEV database (host only):"
psql "$DATABASE_URL_DEV" -c "SELECT 'host='||inet_server_addr()||' port='||inet_server_port()||' db='||current_database();"

echo ""
echo "1) Generating STAGING SQL from DB raw.* (guaranteed column match)..."
python3 "$ROOT/scripts/gen_staging_sql_from_db.py"

echo ""
echo "2) Creating stg.* + inserting from raw.* (no giant transaction)..."
psql -v ON_ERROR_STOP=1 "$DATABASE_URL_DEV" -f "$OUT_SQL"

echo ""
echo "3) Row counts (raw.*):"
psql "$DATABASE_URL_DEV" -c "
SELECT table_name,
       (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM raw.%I', table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_schema='raw'
ORDER BY table_name;
"

echo ""
echo "4) Row counts (stg.*):"
psql "$DATABASE_URL_DEV" -c "
SELECT table_name,
       (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM stg.%I', table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_schema='stg'
ORDER BY table_name;
"

echo ""
echo "✅ STAGING build complete."
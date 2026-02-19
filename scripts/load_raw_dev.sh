#!/usr/bin/env bash
set -euo pipefail

echo "Loading .env from: $(pwd)/.env"
set -a
source .env
set +a

if [ -z "${DATABASE_URL_DEV:-}" ]; then
  echo "❌ DATABASE_URL_DEV not set"
  exit 1
fi

echo "✅ Targeting DEV database (host only):"
psql "$DATABASE_URL_DEV" -c "SELECT 'host='||inet_server_addr()||' port='||inet_server_port()||' db='||current_database();"

echo
echo "1) Generating raw staging SQL from CSV headers..."
python3 scripts/gen_raw_staging_sql.py \
  --csv-dir data/csv \
  --out database/raw_staging_auto.sql

echo "✅ Wrote: database/raw_staging_auto.sql"

echo
echo "2) Creating raw schema + tables..."
psql "$DATABASE_URL_DEV" -v ON_ERROR_STOP=1 -f database/raw_staging_auto.sql

echo
echo "3) Loading CSVs into raw schema..."
python3 scripts/load_csvs_to_raw.py \
  --csv-dir data/csv \
  --database-url "$DATABASE_URL_DEV"

echo
echo "4) Row counts (raw.*):"
psql "$DATABASE_URL_DEV" -c "
SELECT
  table_name,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM raw.%I', table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_schema = 'raw'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo
echo "✅ Raw load complete."
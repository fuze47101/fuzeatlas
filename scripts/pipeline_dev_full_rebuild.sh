#!/usr/bin/env bash
set -euo pipefail

# Full deterministic DEV rebuild:
# - Drops raw/stg/core schemas
# - Reloads raw from CSVs
# - Rebuilds staging from raw
# - Rebuilds core from stg
#
# Requires:
#   - .env with DATABASE_URL_DEV set to PUBLIC Railway URL
#   - CSVs in ./data/*.csv
#   - scripts/load_raw_dev.sh
#   - scripts/build_staging_dev.sh
#   - scripts/build_core_dev.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

echo "Loading .env from: ${ENV_FILE}"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${DATABASE_URL_DEV:?Missing DATABASE_URL_DEV in .env}"

echo "✅ Targeting DEV database (host only):"
psql "$DATABASE_URL_DEV" -X -q -c "SELECT 'host='||inet_server_addr()||' port='||inet_server_port()||' db='||current_database();"

echo ""
echo "0) Dropping schemas raw/stg/core (CASCADE)..."
psql "$DATABASE_URL_DEV" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS raw CASCADE;
DROP SCHEMA IF EXISTS stg CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
SQL
echo "✅ Dropped raw/stg/core"

echo ""
echo "1) RAW load (create raw.* tables + copy CSVs)..."
bash "${ROOT_DIR}/scripts/load_raw_dev.sh"

echo ""
echo "2) STAGING build (create stg.* from raw.*)..."
bash "${ROOT_DIR}/scripts/build_staging_dev.sh"

echo ""
echo "3) CORE build (create core.* from stg.* + QA)..."
bash "${ROOT_DIR}/scripts/build_core_dev.sh"

echo ""
echo "✅ DEV full rebuild complete."
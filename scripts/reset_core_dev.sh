#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

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
echo "✅ Resetting DEV core schema..."

psql "$DATABASE_URL_DEV" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA IF EXISTS core CASCADE;
CREATE SCHEMA core;
SQL

echo "✅ core schema reset complete."
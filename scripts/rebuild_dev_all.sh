#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Activating venv..."
source .venv/bin/activate

echo "Loading .env..."
set -a
source .env
set +a

echo "2) load_raw_dev.sh"
./scripts/load_raw_dev.sh

echo "3) build_staging_dev.sh"
./scripts/build_staging_dev.sh

echo "4) build_core_dev.sh"
./scripts/build_core_dev.sh

echo "✅ DEV rebuild complete."
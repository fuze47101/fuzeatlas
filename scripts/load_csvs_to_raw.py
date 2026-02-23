#!/usr/bin/env python3
import argparse
import subprocess
from pathlib import Path

def run(cmd: list[str]) -> None:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise SystemExit(
            "Command failed:\n"
            + " ".join(cmd)
            + "\n\nSTDOUT:\n"
            + p.stdout
            + "\n\nSTDERR:\n"
            + p.stderr
        )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", required=True)
    ap.add_argument("--database-url", required=True)
    args = ap.parse_args()

    csv_dir = Path(args.csv_dir)
    db = args.database_url

    csv_files = sorted([p for p in csv_dir.glob("*.csv") if p.is_file()])
    if not csv_files:
        raise SystemExit(f"No .csv files found in {csv_dir}")

    # Quick connectivity check
    run(["psql", db, "-v", "ON_ERROR_STOP=1", "-c", "SELECT 1;"])

    for p in csv_files:
        table = p.stem.lower()
        print(f"➡️  Loading {p.name} -> raw.{table}")

        # Use \copy (client-side) so it reads your local file path reliably
        copy_cmd = (
            f"\\copy raw.\"{table}\" "
            f"FROM '{p.as_posix()}' "
            f"WITH (FORMAT csv, HEADER true, QUOTE '\"', ESCAPE '\"')"
        )

        run(["psql", db, "-v", "ON_ERROR_STOP=1", "-c", copy_cmd])

        print(f"✅ Loaded {p.name}")

    print("✅ All CSVs loaded into raw.*")

if __name__ == "__main__":
    main()
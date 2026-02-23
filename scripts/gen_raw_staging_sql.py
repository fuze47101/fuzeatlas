#!/usr/bin/env python3
import argparse
import csv
import os
import re
from pathlib import Path

def sanitize_identifier(name: str) -> str:
    # Keep it stable and safe:
    # - trim
    # - replace spaces/slashes with underscores
    # - remove weird characters
    # - lower-case
    s = name.strip()
    s = s.replace("\ufeff", "")  # BOM if present
    s = re.sub(r"[\/\s]+", "_", s)
    s = re.sub(r"[^a-zA-Z0-9_#]+", "", s)
    s = s.strip("_")
    if not s:
        s = "col"
    s = s.lower()
    # can't start with digit
    if re.match(r"^\d", s):
        s = f"c_{s}"
    return s

def read_header(csv_path: Path) -> list[str]:
    with csv_path.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, [])
    return header

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    csv_dir = Path(args.csv_dir)
    out_path = Path(args.out)

    csv_files = sorted([p for p in csv_dir.glob("*.csv") if p.is_file()])
    if not csv_files:
        raise SystemExit(f"No .csv files found in {csv_dir}")

    lines = []
    lines.append("-- AUTO-GENERATED: raw staging tables from CSV headers")
    lines.append("CREATE SCHEMA IF NOT EXISTS raw;")
    lines.append("")

    for p in csv_files:
        table = p.stem.lower()
        header = read_header(p)
        if not header:
            raise SystemExit(f"Empty header in CSV: {p.name}")

        # sanitize + dedupe
        seen = {}
        cols = []
        for col in header:
            base = sanitize_identifier(col)
            if base in seen:
                seen[base] += 1
                base = f"{base}_{seen[base]}"
            else:
                seen[base] = 1
            cols.append(base)

        lines.append(f'DROP TABLE IF EXISTS raw."{table}" CASCADE;')
        lines.append(f'CREATE TABLE raw."{table}" (')
        for i, c in enumerate(cols):
            comma = "," if i < len(cols) - 1 else ""
            lines.append(f'  "{c}" TEXT{comma}')
        lines.append(");")
        lines.append("")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_path}")

if __name__ == "__main__":
    main()
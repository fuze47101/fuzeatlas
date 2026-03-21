#!/usr/bin/env python3
import argparse
import csv
import os
import re
from pathlib import Path

def slugify(name: str) -> str:
    s = name.strip().lower()
    s = s.replace("#", " num ")
    s = re.sub(r"[%/()]+", " ", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = "col"
    if s[0].isdigit():
        s = f"c_{s}"
    # avoid a few common reserved-ish words
    if s in {"user", "order", "group"}:
        s = f"{s}_col"
    return s

def infer_type(col: str) -> str:
    c = col.lower()

    # dates
    if "date" in c:
        return "date"

    # integers (washes, counts, etc.)
    if any(k in c for k in [
        "wash", "washes", "count", "progress_count", "ptc", "serial", "num"
    ]):
        # exclude things that are clearly percent or gsm
        if "percent" not in c and "percentage" not in c and "gsm" not in c:
            return "int"

    # numeric (icp, %, gsm, sales, width, results)
    if any(k in c for k in [
        "icp", "result", "percentage", "percent", "progress", "gsm", "weight", "width",
        "annual_sales", "sales", "forecast"
    ]):
        return "numeric"

    return "text"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    csv_dir = Path(args.csv_dir).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()

    if not csv_dir.exists():
        raise SystemExit(f"CSV dir not found: {csv_dir}")

    lines = []
    lines.append("BEGIN;")
    lines.append("CREATE SCHEMA IF NOT EXISTS stg;")
    lines.append("")

    # helper SQL functions inside the transaction (simple + portable)
    lines.append(r"""
CREATE OR REPLACE FUNCTION stg.clean_numeric(x text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;
  -- remove commas and percent signs and spaces
  v := replace(v, ',', '');
  v := replace(v, '%', '');
  v := replace(v, ' ', '');
  -- keep leading minus and one dot if present
  IF v !~ '^-?[0-9]*\.?[0-9]+$' THEN
    RETURN NULL;
  END IF;
  RETURN v::numeric;
END $$;

CREATE OR REPLACE FUNCTION stg.clean_int(x text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, ',', '');
  v := replace(v, ' ', '');
  IF v !~ '^-?[0-9]+$' THEN
    RETURN NULL;
  END IF;
  RETURN v::int;
END $$;

CREATE OR REPLACE FUNCTION stg.clean_date(x text)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;

  -- Try ISO first
  IF v ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN v::date;
  END IF;

  -- Try MM/DD/YYYY
  IF v ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    RETURN to_date(v, 'MM/DD/YYYY');
  END IF;

  -- Try MM/DD/YY
  IF v ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN
    RETURN to_date(v, 'MM/DD/YY');
  END IF;

  RETURN NULL;
END $$;
""".strip())
    lines.append("")

    # generate per CSV file
    for csv_file in sorted(csv_dir.glob("*.csv")):
        table = slugify(csv_file.stem)
        with csv_file.open("r", newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if not header:
                continue

        cols = []
        for h in header:
            cols.append((h, slugify(h), infer_type(h)))

        lines.append(f'DROP TABLE IF EXISTS stg."{table}" CASCADE;')
        lines.append(f'CREATE TABLE stg."{table}" (')
        col_defs = []
        for _, colname, ctype in cols:
            if ctype == "date":
                col_defs.append(f'  "{colname}" date')
            elif ctype == "int":
                col_defs.append(f'  "{colname}" integer')
            elif ctype == "numeric":
                col_defs.append(f'  "{colname}" numeric')
            else:
                col_defs.append(f'  "{colname}" text')
        lines.append(",\n".join(col_defs))
        lines.append(");")
        lines.append("")

        # Insert-select with cleaning from raw."table"
        lines.append(f'TRUNCATE TABLE stg."{table}";')
        select_exprs = []
        for _, colname, ctype in cols:
            if ctype == "date":
                select_exprs.append(f'stg.clean_date(r."{colname}") AS "{colname}"')
            elif ctype == "int":
                select_exprs.append(f'stg.clean_int(r."{colname}") AS "{colname}"')
            elif ctype == "numeric":
                select_exprs.append(f'stg.clean_numeric(r."{colname}") AS "{colname}"')
            else:
                select_exprs.append(f'r."{colname}" AS "{colname}"')

        lines.append(f'INSERT INTO stg."{table}"')
        lines.append("SELECT")
        lines.append("  " + ",\n  ".join(select_exprs))
        lines.append(f'FROM raw."{table}" r;')
        lines.append("")

    lines.append("COMMIT;")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ Wrote: {out_path}")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
import os
import re
from pathlib import Path
import psycopg

ROOT = Path(__file__).resolve().parents[1]
OUT_SQL = ROOT / "database" / "staging_from_raw_auto.sql"

def infer_type(colname: str) -> str:
    c = colname.lower()

    # dates
    if "date" in c:
        return "date"

    # integers (counts / washes / serials)
    if any(k in c for k in [
        "wash", "washes", "count", "progress_count", "ptc", "serial", "num"
    ]):
        if "percent" not in c and "percentage" not in c and "gsm" not in c:
            return "int"

    # numeric
    if any(k in c for k in [
        "icp", "result", "percentage", "percent", "progress", "gsm", "weight", "width",
        "annual_sales", "sales", "forecast"
    ]):
        return "numeric"

    return "text"

def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'

def main():
    db_url = os.environ.get("DATABASE_URL_DEV") or os.environ.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("❌ DATABASE_URL_DEV (or DATABASE_URL) is not set in environment")

    lines = []
    lines.append("-- AUTO-GENERATED: stg.* from raw.* (names from DB, not CSV)")
    lines.append("CREATE SCHEMA IF NOT EXISTS stg;")
    lines.append("")

    # cleaning functions
    lines.append(r"""
CREATE OR REPLACE FUNCTION stg.clean_numeric(x text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF x IS NULL THEN RETURN NULL; END IF;
  v := btrim(x);
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, ',', '');
  v := replace(v, '%', '');
  v := replace(v, ' ', '');
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

  IF v ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN v::date;
  END IF;

  IF v ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    RETURN to_date(v, 'MM/DD/YYYY');
  END IF;

  IF v ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN
    RETURN to_date(v, 'MM/DD/YY');
  END IF;

  RETURN NULL;
END $$;
""".strip())
    lines.append("")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema='raw'
                ORDER BY table_name;
            """)
            tables = [r[0] for r in cur.fetchall()]

            for table in tables:
                cur.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema='raw' AND table_name=%s
                    ORDER BY ordinal_position;
                """, (table,))
                cols = [r[0] for r in cur.fetchall()]

                lines.append(f'DROP TABLE IF EXISTS stg.{qident(table)} CASCADE;')
                lines.append(f'CREATE TABLE stg.{qident(table)} (')
                defs = []
                for c in cols:
                    t = infer_type(c)
                    if t == "date":
                        defs.append(f'  {qident(c)} date')
                    elif t == "int":
                        defs.append(f'  {qident(c)} integer')
                    elif t == "numeric":
                        defs.append(f'  {qident(c)} numeric')
                    else:
                        defs.append(f'  {qident(c)} text')
                lines.append(",\n".join(defs))
                lines.append(");")
                lines.append("")

                # insert with cleaning from raw -> stg
                select_exprs = []
                for c in cols:
                    t = infer_type(c)
                    if t == "date":
                        select_exprs.append(f'stg.clean_date(r.{qident(c)}) AS {qident(c)}')
                    elif t == "int":
                        select_exprs.append(f'stg.clean_int(r.{qident(c)}) AS {qident(c)}')
                    elif t == "numeric":
                        select_exprs.append(f'stg.clean_numeric(r.{qident(c)}) AS {qident(c)}')
                    else:
                        select_exprs.append(f'r.{qident(c)} AS {qident(c)}')

                lines.append(f'TRUNCATE TABLE stg.{qident(table)};')
                lines.append(f'INSERT INTO stg.{qident(table)}')
                lines.append("SELECT")
                lines.append("  " + ",\n  ".join(select_exprs))
                lines.append(f'FROM raw.{qident(table)} r;')
                lines.append("")

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ Wrote: {OUT_SQL}")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
import os
import sys
from psycopg import connect, sql

DB_URL = os.environ.get("DATABASE_URL_DEV")
if not DB_URL:
    print("❌ DATABASE_URL_DEV not set. Run: set -a; source .env; set +a", file=sys.stderr)
    sys.exit(1)

STG_SCHEMA = "stg"
CORE_SCHEMA = "core"

LEGACY_CANDIDATES = [
    "record_id",
    "Record ID",
    "record id",
    "recordid",
    "knack_record_id",
    "Knack Record ID",
]

def fetch_cols(cur, schema: str, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema=%s AND table_name=%s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )
    return [r[0] for r in cur.fetchall()]

def table_exists(cur, schema: str, table: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema=%s AND table_name=%s
        """,
        (schema, table),
    )
    return cur.fetchone() is not None

def pick_legacy_col(stg_cols: list[str]) -> str | None:
    lc = {c.lower(): c for c in stg_cols}
    for cand in LEGACY_CANDIDATES:
        if cand.lower() in lc:
            return lc[cand.lower()]
    return None

def copy_table(cur, stg_table: str, core_table: str):
    if not table_exists(cur, STG_SCHEMA, stg_table):
        print(f"⚠️ Missing {STG_SCHEMA}.{stg_table}, skipping")
        return
    if not table_exists(cur, CORE_SCHEMA, core_table):
        print(f"⚠️ Missing {CORE_SCHEMA}.{core_table}, skipping")
        return

    stg_cols = fetch_cols(cur, STG_SCHEMA, stg_table)
    core_cols = fetch_cols(cur, CORE_SCHEMA, core_table)

    legacy_stg = pick_legacy_col(stg_cols)
    legacy_core = "legacy_record_id" if "legacy_record_id" in core_cols else None
    if not legacy_core:
        raise RuntimeError(f"core.{core_table} missing legacy_record_id (expected by importer)")

    excluded = {"id", "created_at", "updated_at", "legacy_record_id"}
    common = [c for c in stg_cols if c in core_cols and c not in excluded]

    insert_cols = list(common) + ["legacy_record_id"]
    select_cols = [sql.Identifier("s", c) for c in common]
    select_cols.append(sql.Identifier("s", legacy_stg) if legacy_stg else sql.SQL("NULL"))

    print(f"➡️  Import {STG_SCHEMA}.{stg_table} -> {CORE_SCHEMA}.{core_table}")
    print(f"    - common cols: {len(common)} | legacy: stg={legacy_stg} -> core=legacy_record_id")

    # Upsert by legacy_record_id
    updatable = [c for c in insert_cols if c not in {"id", "legacy_record_id"}]
    ins = sql.SQL("""
        INSERT INTO {}.{} ({})
        SELECT {} FROM {}.{} s
        ON CONFLICT (legacy_record_id) DO UPDATE SET {}
    """).format(
        sql.Identifier(CORE_SCHEMA),
        sql.Identifier(core_table),
        sql.SQL(", ").join(sql.Identifier(c) for c in insert_cols),
        sql.SQL(", ").join(select_cols),
        sql.Identifier(STG_SCHEMA),
        sql.Identifier(stg_table),
        sql.SQL(", ").join(
            sql.SQL("{}=EXCLUDED.{}").format(sql.Identifier(c), sql.Identifier(c))
            for c in updatable
        ) if updatable else sql.SQL("legacy_record_id=EXCLUDED.legacy_record_id")
    )

    cur.execute(ins)

    cur.execute(sql.SQL("SELECT count(*) FROM {}.{}").format(
        sql.Identifier(CORE_SCHEMA), sql.Identifier(core_table)
    ))
    print(f"    ✅ core.{core_table} rows: {cur.fetchone()[0]}")

def main():
    with connect(DB_URL) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            print("✅ Connecting to DEV DB...")
            cur.execute("SELECT current_database(), inet_server_addr(), inet_server_port()")
            db, host, port = cur.fetchone()
            print(f"✅ Connected: db={db} host={host} port={port}")

            # Ensure stg exists
            cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name=%s", (STG_SCHEMA,))
            if not cur.fetchone():
                print("❌ stg schema not found. Build staging first.", file=sys.stderr)
                sys.exit(1)

            mappings = [
                ("brands", "brands"),
                ("textilemills", "textile_mills"),
                ("distributors", "distributors"),
                ("labratories", "labs"),
                ("fabricdatabase", "fabrics"),
                ("testreports", "test_reports"),
                ("notes", "notes"),
            ]

            for stg_t, core_t in mappings:
                copy_table(cur, stg_t, core_t)

            print("✅ Core import done.")

if __name__ == "__main__":
    main()
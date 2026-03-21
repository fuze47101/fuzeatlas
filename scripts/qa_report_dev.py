#!/usr/bin/env python3
import os, sys
import psycopg

DB_URL = os.environ.get("DATABASE_URL_DEV")
if not DB_URL:
    print("❌ DATABASE_URL_DEV not set", file=sys.stderr)
    sys.exit(1)

def main():
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema='core'
                ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]

            print("# QA Report (DEV)\n")
            for t in tables:
                cur.execute(f"SELECT count(*) FROM core.{t}")
                c = cur.fetchone()[0]
                print(f"- core.{t}: {c}")

            # placeholder / pre_atlas if your schema includes these fields
            try:
                cur.execute("SELECT count(*) FROM core.fabrics WHERE pre_atlas=true")
                print(f"\n- core.fabrics pre_atlas=true: {cur.fetchone()[0]}")
            except Exception:
                pass

if __name__ == "__main__":
    main()
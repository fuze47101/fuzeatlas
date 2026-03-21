import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TableRow = { table_schema: string; table_name: string; row_estimate: bigint };

export async function GET() {
  try {
    // List all tables in the public schema with row estimates
    const tables = await prisma.$queryRaw<TableRow[]>`
      SELECT
        t.table_schema,
        t.table_name,
        COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s
        ON s.schemaname = t.table_schema
       AND s.relname = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;

    // Convert bigint to number for JSON serialization
    const rows = tables.map((r) => ({
      schema: r.table_schema,
      table: r.table_name,
      rowEstimate: typeof r.row_estimate === "bigint" ? Number(r.row_estimate) : r.row_estimate,
    }));

    return NextResponse.json({ ok: true, ts: new Date().toISOString(), tables: rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "inspect_error", ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}

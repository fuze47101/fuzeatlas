import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Row = { table_schema: string; table_name: string };

export async function GET() {
  try {
    const tables = await prisma.$queryRaw<Row[]>`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('core','stg')
      ORDER BY table_schema, table_name
    `;

    return NextResponse.json({ ok: true, ts: new Date().toISOString(), tables });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "inspect_error", ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}

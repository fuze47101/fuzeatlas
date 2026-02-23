import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Row = { n: bigint | number };

async function safeCount(schema: string, table: string): Promise<number | null> {
  const sql = `SELECT COUNT(*)::bigint AS n FROM ${schema}."${table}"`;
  try {
    const r = await prisma.$queryRawUnsafe<Row[]>(sql);
    const v = r?.[0]?.n ?? 0;
    return typeof v === "bigint" ? Number(v) : Number(v);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const data = {
      ts: new Date().toISOString(),
      core: {
        brands: await safeCount("core", "brands"),
        distributors: await safeCount("core", "distributors"),
        fabrics: await safeCount("core", "fabrics"),
        labs: await safeCount("core", "labs"),
        test_reports: await safeCount("core", "test_reports"),
        textile_mills: await safeCount("core", "textile_mills"),
        notes: await safeCount("core", "notes"),
        import_runs: await safeCount("core", "import_runs"),
        import_errors: await safeCount("core", "import_errors"),
      },
      stg: {
        brands: await safeCount("stg", "brands"),
        distributors: await safeCount("stg", "distributors"),
        notes: await safeCount("stg", "notes"),
        textilemills: await safeCount("stg", "textilemills"),
        testreports: await safeCount("stg", "testreports"),
        fabricdatabase: await safeCount("stg", "fabricdatabase"),
        fabricmanager: await safeCount("stg", "fabricmanager"),
        factorymanager: await safeCount("stg", "factorymanager"),
        labratories: await safeCount("stg", "labratories"),
        testingmanager: await safeCount("stg", "testingmanager"),
        salesmanagers: await safeCount("stg", "salesmanagers"),
        salesreps: await safeCount("stg", "salesreps"),
      },
    };

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "stats_error", ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}

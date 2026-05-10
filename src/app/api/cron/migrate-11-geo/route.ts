// @ts-nocheck
/**
 * Bearer-authed runtime migration — Phase 11A geo columns.
 * Adds lat/lng to Factory, Brand, Lab, Distributor.
 * Idempotent.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const steps: { sql: string; ok: boolean; error?: string }[] = [];
  const run = async (label: string, sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      steps.push({ sql: label, ok: true });
    } catch (e: any) {
      steps.push({ sql: label, ok: false, error: e?.message || String(e) });
    }
  };
  for (const table of ["Factory", "Brand", "Lab", "Distributor"]) {
    for (const col of ["lat", "lng"]) {
      await run(
        `${table}.${col}`,
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" DOUBLE PRECISION`,
      );
    }
  }
  const failed = steps.filter((s) => !s.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    totalSteps: steps.length,
    failed: failed.length,
    steps,
  });
}

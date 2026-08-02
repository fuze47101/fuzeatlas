// @ts-nocheck
/**
 * seed-red-rover — Red Rover Track 2.
 *
 * POST (or GET, so `fzcron seed-red-rover` works) /api/cron/seed-red-rover
 * Bearer $CRON_SECRET.
 *
 * Idempotent upsert-by-name. Seeds the 14-target Red Rover book, all owned
 * by Josh Lujan, ranked per the LOCKED RANKING (2026-08-01, Andrew). The
 * seed data + logic live in src/lib/red-rover-seed.ts so this route and the
 * local runner (scripts/seed-red-rover.ts) can't drift.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedRedRover } from "@/lib/red-rover-seed";

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const out = await seedRedRover(prisma);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}

// GET delegates so `fzcron seed-red-rover` (a curl GET) works too.
export async function GET(req: Request) {
  return handle(req);
}

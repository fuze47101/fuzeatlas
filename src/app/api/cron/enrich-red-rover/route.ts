// @ts-nocheck
/**
 * enrich-red-rover — Red Rover Phase 2, Track 1 (REAL DATA LOAD).
 *
 * POST (or GET, so `fzcron enrich-red-rover` works) /api/cron/enrich-red-rover
 * Bearer $CRON_SECRET.
 *
 * Loads the real dossier data (deliverables/Red_Rover_Dossier_Notes.md) into
 * the module: per-target fields + correct stages, contacts (side/role), and
 * the activity timeline. Idempotent (contacts upsert-by-name; activities
 * dedupe by target+occurredAt+body). Data + logic live in
 * src/lib/red-rover-enrich.ts.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichRedRover } from "@/lib/red-rover-enrich";

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const out = await enrichRedRover(prisma);
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

export async function GET(req: Request) {
  return handle(req);
}

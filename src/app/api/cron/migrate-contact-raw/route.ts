// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-contact-raw
 *
 * Adds Contact.raw (JSONB) for the verification + research feature.
 * Idempotent — IF NOT EXISTS. Fire from Andrew's Mac:
 *   fzcron migrate-contact-raw
 */

const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const t = Date.now();
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "raw" JSONB;`,
    );
    return NextResponse.json({
      ok: true,
      verdict: 'Contact."raw" JSONB column present.',
      ms: Date.now() - t,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

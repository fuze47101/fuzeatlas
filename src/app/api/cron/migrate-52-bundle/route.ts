// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/migrate-52-bundle
 *
 * Phase 52 idempotent runtime migration:
 *   T1 — TestRequestLine.organisms (TEXT)
 *   T1 — TestRequestLine.washCount (INT)
 *   T2 — Lab.regionalApproverId (TEXT) + index
 *   T2 — backfill Lab.regionalApproverId for Asia labs → Tina's user.id
 *        (matched by email = tina@fuze47.com)
 *
 * Re-runnable. Bearer-authed via CRON_SECRET.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const TINA_EMAIL = "tina@fuze47.com";
const ASIA_REGIONS = new Set(["Asia", "Asia Pacific"]);
const ASIA_COUNTRIES = new Set([
  "Taiwan",
  "China",
  "Korea",
  "South Korea",
  "Japan",
  "Vietnam",
  "Thailand",
  "Indonesia",
  "Malaysia",
  "India",
  "Pakistan",
  "Bangladesh",
  "Philippines",
  "Cambodia",
  "Hong Kong",
]);

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const log: string[] = [];
  try {
    // T1 — TestRequestLine columns
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TestRequestLine" ADD COLUMN IF NOT EXISTS "organisms" TEXT;`,
    );
    log.push("ensured TestRequestLine.organisms");
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TestRequestLine" ADD COLUMN IF NOT EXISTS "washCount" INTEGER;`,
    );
    log.push("ensured TestRequestLine.washCount");

    // T2 — Lab.regionalApproverId + index
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "regionalApproverId" TEXT;`,
    );
    log.push("ensured Lab.regionalApproverId");
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Lab_regionalApproverId_idx" ON "Lab"("regionalApproverId");`,
    );
    log.push("indexed Lab.regionalApproverId");
    // FK (best-effort; ignore "already exists")
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Lab" ADD CONSTRAINT "Lab_regionalApproverId_fkey" FOREIGN KEY ("regionalApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
      );
      log.push("attached Lab.regionalApproverId FK");
    } catch (e: any) {
      if (!String(e?.message).includes("already exists")) log.push(`fk: ${e?.message}`);
    }

    // T2 — backfill Tina for Asia labs
    const tina = await prisma.user.findUnique({
      where: { email: TINA_EMAIL },
      select: { id: true, name: true, email: true },
    });
    if (!tina) {
      log.push(`backfill skipped: no user with email ${TINA_EMAIL}`);
    } else {
      const labs = await prisma.lab.findMany({
        select: { id: true, name: true, country: true, region: true, regionalApproverId: true },
      });
      let assigned = 0;
      let skippedExisting = 0;
      for (const lab of labs) {
        if (lab.regionalApproverId) {
          skippedExisting++;
          continue;
        }
        const isAsia =
          (lab.region && ASIA_REGIONS.has(lab.region.trim())) ||
          (lab.country && ASIA_COUNTRIES.has(lab.country.trim()));
        if (!isAsia) continue;
        await prisma.lab.update({
          where: { id: lab.id },
          data: { regionalApproverId: tina.id } as any,
        });
        assigned++;
      }
      log.push(
        `backfill: ${assigned} Asia lab(s) routed to ${tina.email}; ${skippedExisting} already had an approver`,
      );
    }

    return NextResponse.json({
      ok: true,
      verdict: "Phase 52 migration bundle applied.",
      log,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "migration failed", log },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;

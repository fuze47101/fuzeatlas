// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTrackingToken } from "@/lib/test-tracking";

/**
 * POST /api/cron/backfill-tracking-tokens
 *
 * Phase 17 follow-up — generate TestTrackingToken rows for every
 * pre-existing TestRequest that doesn't have one yet, so legacy
 * in-flight tests are shareable via /track/<token>.
 *
 * Idempotent: re-runnable. Only touches TestRequest rows where no
 * TestTrackingToken exists (LEFT JOIN IS NULL semantics via Prisma
 * `trackingToken: null` filter). Processes in batches of 100 to
 * keep memory + connection pressure bounded.
 *
 * Bearer-authed via CRON_SECRET.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 100;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let processed = 0;
  let created = 0;
  let skippedExisting = 0;
  const errors: Array<{ testRequestId: string; error: string }> = [];

  // Page through TestRequest rows missing a TestTrackingToken.
  // ensureTrackingToken() returns existing token if one exists (idempotent),
  // so even if a row picked up a token between query + write we won't dup.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.testRequest.findMany({
      where: { trackingToken: null },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });
    if (batch.length === 0) break;

    for (const tr of batch) {
      processed++;
      try {
        // Re-check existence — ensureTrackingToken() upserts but emits the
        // existing token if one materialized between findMany and now.
        const existing = await (prisma as any).testTrackingToken.findUnique({
          where: { testRequestId: tr.id },
          select: { token: true },
        });
        if (existing?.token) {
          skippedExisting++;
          continue;
        }
        const token = await ensureTrackingToken(tr.id);
        if (token) created++;
        else errors.push({ testRequestId: tr.id, error: "ensureTrackingToken returned null" });
      } catch (e: any) {
        errors.push({ testRequestId: tr.id, error: e?.message || "unknown" });
      }
    }

    // If we processed a full batch, loop again. If the batch was short,
    // we're done — but we still issued the findMany once more above to
    // confirm. The condition `batch.length === 0` above handles the
    // termination. No explicit break needed here.
    if (batch.length < BATCH_SIZE) break;
  }

  return NextResponse.json({
    ok: true,
    processed,
    created,
    skippedExisting,
    errors: errors.slice(0, 50), // cap response size
    errorCount: errors.length,
    verdict: `Backfilled ${created} tracking token(s) across ${processed} TestRequest row(s). ${skippedExisting} already had tokens. ${errors.length} errors.`,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 300;

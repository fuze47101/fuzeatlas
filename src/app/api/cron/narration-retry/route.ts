// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAndPersistNarration } from "@/lib/test-narration";

/**
 * /api/cron/narration-retry
 *
 * MB-3 retry queue. Every 6h Vercel cron picks up brand-visible
 * TestRuns where:
 *   - aiNarration IS NULL
 *   - aiNarrationGenerationFailedAt < now - 1h
 *     (don't churn on a transient outage)
 *
 * Cap 20 attempts per run so we don't drain the API budget.
 *
 * Bearer-authed via Vercel's `Authorization: Bearer $CRON_SECRET`.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const RETRY_CAP = 20;
const RETRY_AFTER_MIN = 60;

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETRY_AFTER_MIN * 60_000);

  // Eligible rows: brand-visible, no narration yet, last failure >= 1h ago.
  // Also picks up never-attempted rows where the failure stamp is null
  // (covers older TestRuns stamped brand-visible before MB-3 shipped).
  const candidates = await prisma.testRun.findMany({
    where: {
      brandVisible: true,
      AND: [
        { OR: [{ aiNarration: null }, { aiNarration: "" }] },
        {
          OR: [
            { aiNarrationGenerationFailedAt: null },
            { aiNarrationGenerationFailedAt: { lt: cutoff } },
          ],
        },
      ],
    } as any,
    select: { id: true, aiNarrationGenerationFailedAt: true } as any,
    orderBy: { updatedAt: "desc" },
    take: RETRY_CAP,
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const c of candidates) {
    const r = await generateAndPersistNarration(c.id);
    results.push({ id: c.id, ok: r.ok, error: r.error });
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    verdict: `${okCount}/${results.length} narrations generated (cap ${RETRY_CAP}).`,
    results,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

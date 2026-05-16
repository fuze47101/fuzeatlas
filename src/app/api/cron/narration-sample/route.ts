// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/narration-sample
 *
 * Bearer-authed read-only sampler for MB-3 narrations. Returns the
 * 5 most recently generated narrations + their test context so
 * Andrew can spot-check the brand voice. Sister of feedback-list —
 * same one-off bearer-action pattern, just for narration QA.
 */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.testRun.findMany({
    where: {
      brandVisible: true,
      aiNarration: { not: null },
    } as any,
    select: {
      id: true,
      testType: true,
      testMethodStd: true,
      washCount: true,
      testReportNumber: true,
      aiNarration: true,
      aiNarrationModel: true,
      aiNarrationGeneratedAt: true,
      submission: {
        select: {
          fuzeTier: true,
          brand: { select: { name: true } },
          factory: { select: { name: true } },
          fabric: { select: { fuzeNumber: true } },
        },
      },
    } as any,
    orderBy: { aiNarrationGeneratedAt: "desc" } as any,
    take: 5,
  });

  return NextResponse.json({
    ok: true,
    count: rows.length,
    samples: rows,
  });
}

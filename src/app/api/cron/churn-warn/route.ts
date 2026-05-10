// @ts-nocheck
/**
 * GET /api/cron/churn-warn — Phase 9J.
 *
 * Bearer-authed cron — runs 14:45 UTC daily (registered in
 * vercel.json). For every CUSTOMER_WON brand, evaluate churn risk:
 *
 *   1. Recompute the canonical engagement score on a 30-day window
 *      and a 30-60-day window via explainEngagement (Phase 9F).
 *   2. Slope = score(now) − score(30d ago). Approximation: we use
 *      `lastCalculated` BrandEngagement deltas if available;
 *      otherwise a single-shot slope of (current score) vs (prior
 *      stored score). Either way the negative-trend + stale-activity
 *      pair is the trigger.
 *   3. If trend is negative AND no Note / Meeting / OutreachMessage
 *      activity in 14+ days → fire a CHURN_RISK notification to the
 *      brand's salesRep + every admin.
 *
 * This is the v1 of "mind-blowing churn prediction". v2 will add
 * proper ML on top of cohort-style features. Today this is slope
 * detection on the explicit signals we already track.
 *
 * Suppression: we stamp BrandEngagement.lastCalculated and skip
 * brands whose latest notification metadata has source="churn-warn"
 * within the last 7 days so we don't re-notify the same risk
 * every morning.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { explainEngagement } from "@/lib/brand-engagement";

const SUPPRESSION_HOURS = 7 * 24;
const STALENESS_DAYS = 14;
const SLOPE_THRESHOLD = -5; // 5-point drop is "negative"

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const since14 = new Date(Date.now() - STALENESS_DAYS * 86400_000);
  const suppressionSince = new Date(Date.now() - SUPPRESSION_HOURS * 60 * 60_000);

  const adminIds = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  const wonBrands = await prisma.brand.findMany({
    where: { pipelineStage: "CUSTOMER_WON" },
    select: {
      id: true,
      name: true,
      salesRepId: true,
      lastActivityAt: true,
      engagement: {
        select: {
          overallScore: true,
          engagementTrend: true,
          lastCalculated: true,
        },
      },
    },
  });

  const results: any[] = [];
  let flagged = 0;
  let suppressed = 0;
  let skipped = 0;

  for (const brand of wonBrands) {
    try {
      const priorScore = brand.engagement?.overallScore ?? null;
      const exp = await explainEngagement(brand.id);
      if (!exp) {
        skipped++;
        results.push({ brandId: brand.id, name: brand.name, status: "no_explanation" });
        continue;
      }
      const currentScore = exp.overallScore;
      const slope = priorScore != null ? currentScore - priorScore : 0;
      const lastActivity = brand.lastActivityAt;
      const isStale =
        !lastActivity || lastActivity < since14;

      const trendNegative =
        slope <= SLOPE_THRESHOLD ||
        exp.trend === "DECLINING" ||
        exp.trend === "AT_RISK";

      if (!trendNegative || !isStale) {
        skipped++;
        results.push({
          brandId: brand.id,
          name: brand.name,
          status: "ok",
          currentScore,
          priorScore,
          slope,
          stale: isStale,
        });
        continue;
      }

      // Suppression — has a churn-warn notification fired in the last 7d?
      const recentNotify = await prisma.notification.findFirst({
        where: {
          createdAt: { gte: suppressionSince },
          metadata: { path: ["brandId"], equals: brand.id },
        },
        select: { id: true, metadata: true },
      });
      const isChurnSuppressed =
        recentNotify?.metadata &&
        (recentNotify.metadata as any).source === "churn-warn";
      if (isChurnSuppressed) {
        suppressed++;
        results.push({
          brandId: brand.id,
          name: brand.name,
          status: "suppressed",
          currentScore,
          slope,
        });
        continue;
      }

      const recipientIds = new Set<string>(adminIds);
      if (brand.salesRepId) recipientIds.add(brand.salesRepId);

      const lastActivityText = lastActivity
        ? `last activity ${Math.floor((Date.now() - lastActivity.getTime()) / 86400_000)}d ago`
        : "no logged activity";
      const title = `⚠ Churn risk: ${brand.name}`;
      const message = `Score ${currentScore}${priorScore != null ? ` (Δ ${slope >= 0 ? "+" : ""}${slope})` : ""} · ${lastActivityText} · trend ${exp.trend.toLowerCase()}`;
      const link = `/admin/brands/${brand.id}/engagement-debug`;

      await Promise.all(
        Array.from(recipientIds).map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              type: "BRAND_ACTIVITY",
              title,
              message,
              link,
              metadata: {
                source: "churn-warn",
                brandId: brand.id,
                currentScore,
                priorScore,
                slope,
                trend: exp.trend,
              },
            },
          }),
        ),
      );
      flagged++;
      results.push({
        brandId: brand.id,
        name: brand.name,
        status: "flagged",
        currentScore,
        priorScore,
        slope,
        recipients: recipientIds.size,
      });
    } catch (err: any) {
      console.error("[churn-warn] failed for", brand.id, err);
      results.push({
        brandId: brand.id,
        name: brand.name,
        status: "error",
        error: err?.message || String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    totalCustomers: wonBrands.length,
    flagged,
    suppressed,
    skipped,
    results: results.slice(0, 50),
  });
}

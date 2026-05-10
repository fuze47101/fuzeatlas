// @ts-nocheck
/**
 * GET /api/cron/predict-churn — Phase 11C.
 *
 * Bearer-authed nightly cron. For every Brand whose pipelineStage is
 * CUSTOMER_WON or BRAND_EXPANSION:
 *   1. Pull the last 30 emails (OutreachMessage), last 10 meetings,
 *      last 20 test runs, last 10 orders, last 10 notes, plus open
 *      CrmTasks and days-since-last-activity.
 *   2. Send Claude haiku-4-5 a structured prompt: score 0-100 churn
 *      risk, explain factors, recommend an action.
 *   3. Persist churnRiskScore + churnRiskUpdatedAt + churnRiskReasoning.
 *   4. If score crosses 70 and didn't already, fire a notification to
 *      the brand's salesRep + admins.
 *
 * If ANTHROPIC_API_KEY isn't set, falls back to the Phase 9J slope
 * detector: derive a heuristic score from engagement signal alone.
 *
 * Suppression on the per-brand cross-70 notification: 7 days.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiFetch } from "@/lib/ai-fetch";

const SUPPRESSION_HOURS = 7 * 24;

interface BrandSlice {
  id: string;
  name: string;
  pipelineStage: string;
  salesRepId: string | null;
  lastActivityAt: Date | null;
  engagement: { overallScore: number; engagementTrend: string } | null;
  recentEmails: any[];
  recentMeetings: any[];
  recentTests: any[];
  recentOrders: any[];
  recentNotes: any[];
  openTasks: any[];
}

async function gatherSlice(brandId: string, brandName: string, stage: string, salesRepId: string | null, lastActivityAt: Date | null): Promise<BrandSlice> {
  const since90 = new Date(Date.now() - 90 * 86400_000);
  const [
    engagement,
    contacts,
    meetings,
    testRuns,
    orders,
    notes,
    tasks,
  ] = await Promise.all([
    prisma.brandEngagement.findUnique({
      where: { brandId },
      select: { overallScore: true, engagementTrend: true },
    }),
    prisma.contact.findMany({ where: { brandId }, select: { id: true } }),
    prisma.meeting.findMany({
      where: { brandId, startTime: { gte: since90 } },
      orderBy: { startTime: "desc" },
      take: 10,
      select: { id: true, title: true, startTime: true, status: true },
    }),
    prisma.testRun.findMany({
      where: { submission: { brandId }, testDate: { gte: since90 } },
      orderBy: { testDate: "desc" },
      take: 20,
      select: { id: true, testType: true, testDate: true, brandApprovalStatus: true },
    }),
    prisma.fuzeOrder.findMany({
      where: { brandId, createdAt: { gte: since90 } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, orderNumber: true, status: true, createdAt: true, volumeLiters: true },
    }),
    prisma.note.findMany({
      where: { brandId, date: { gte: since90 } },
      orderBy: { date: "desc" },
      take: 10,
      select: { id: true, content: true, noteType: true, emailDirection: true, date: true },
    }),
    prisma.crmTask.findMany({
      where: { brandId, status: "OPEN" },
      orderBy: { dueAt: "asc" },
      take: 10,
      select: { id: true, title: true, dueAt: true, priority: true },
    }),
  ]);
  const contactIds = contacts.map((c) => c.id);
  const recentEmails = contactIds.length
    ? await prisma.outreachMessage.findMany({
        where: { contactId: { in: contactIds }, sentAt: { gte: since90 } },
        orderBy: { sentAt: "desc" },
        take: 30,
        select: {
          id: true,
          channel: true,
          subject: true,
          sentAt: true,
          openedAt: true,
          repliedAt: true,
          status: true,
        },
      })
    : [];
  return {
    id: brandId,
    name: brandName,
    pipelineStage: stage,
    salesRepId,
    lastActivityAt,
    engagement,
    recentEmails,
    recentMeetings: meetings,
    recentTests: testRuns,
    recentOrders: orders,
    recentNotes: notes,
    openTasks: tasks,
  };
}

function heuristicScore(slice: BrandSlice): { score: number; reasoning: string } {
  // Fallback when Claude isn't available. Lifted from the Phase 9J
  // slope detector with a wider feature set.
  const factors: string[] = [];
  let score = 30;
  const days = slice.lastActivityAt
    ? Math.floor((Date.now() - slice.lastActivityAt.getTime()) / 86400_000)
    : 999;
  if (days > 60) {
    score += 25;
    factors.push(`${days}d since last activity`);
  } else if (days > 30) {
    score += 12;
    factors.push(`${days}d since last activity`);
  }
  if (slice.engagement?.engagementTrend === "DECLINING") {
    score += 20;
    factors.push("engagement trend declining");
  }
  if (slice.engagement?.engagementTrend === "AT_RISK") {
    score += 25;
    factors.push("engagement flagged AT_RISK");
  }
  const replies = slice.recentEmails.filter((e) => e.repliedAt).length;
  const sends = slice.recentEmails.length;
  if (sends >= 3 && replies === 0) {
    score += 15;
    factors.push(`${sends} emails sent, zero replies in 90d`);
  }
  if (slice.recentOrders.length === 0) {
    score += 8;
    factors.push("no orders in 90d");
  }
  if (slice.recentMeetings.length === 0) {
    score += 8;
    factors.push("no meetings in 90d");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    reasoning:
      factors.length === 0
        ? "Heuristic baseline — no high-signal risk indicators in the last 90 days."
        : `Heuristic score driven by: ${factors.join("; ")}.`,
  };
}

async function scoreWithClaude(slice: BrandSlice): Promise<{ score: number; reasoning: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const systemPrompt = `You are evaluating churn risk for a FUZE Biotech customer brand. Score 0-100 where 100 = highest risk of churning in the next 90 days. Use FUZE / metamaterial vocabulary if quoting language.

Return JSON only, this shape:
{
  "score": <0..100>,
  "reasoning": "<2-3 sentences explaining the major factors>",
  "recommendedAction": "<one concrete next step a salesRep can take this week>"
}

Consider: time since last activity, reply rates on outbound, meeting cadence, recent test approvals/rejections, order velocity, open CrmTasks left unresolved, engagement-score trend.`;
  try {
    const { response } = await aiFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: JSON.stringify(
                {
                  brand: { name: slice.name, stage: slice.pipelineStage },
                  lastActivityAt: slice.lastActivityAt,
                  engagement: slice.engagement,
                  recentEmails: slice.recentEmails.map((e) => ({
                    sentAt: e.sentAt,
                    opened: !!e.openedAt,
                    replied: !!e.repliedAt,
                  })),
                  recentMeetingsCount: slice.recentMeetings.length,
                  recentTestsCount: slice.recentTests.length,
                  recentOrdersCount: slice.recentOrders.length,
                  recentNotesCount: slice.recentNotes.length,
                  openTasksCount: slice.openTasks.length,
                },
                null,
                2,
              ),
            },
          ],
        }),
      },
      { provider: "anthropic", callerRoute: "predict-churn", userId: "system" },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      reasoning:
        (parsed.reasoning || "") +
        (parsed.recommendedAction ? ` Recommended: ${parsed.recommendedAction}` : ""),
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const suppressionSince = new Date(Date.now() - SUPPRESSION_HOURS * 60 * 60_000);

  const adminIds = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  const targetBrands = await prisma.brand.findMany({
    where: { pipelineStage: { in: ["CUSTOMER_WON", "BRAND_EXPANSION"] } },
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      salesRepId: true,
      lastActivityAt: true,
      churnRiskScore: true,
    },
  });

  const results: any[] = [];
  for (const b of targetBrands) {
    try {
      const slice = await gatherSlice(
        b.id,
        b.name,
        b.pipelineStage,
        b.salesRepId,
        b.lastActivityAt,
      );
      let scored = await scoreWithClaude(slice);
      if (!scored) scored = heuristicScore(slice);

      await prisma.brand.update({
        where: { id: b.id },
        data: {
          churnRiskScore: scored.score,
          churnRiskUpdatedAt: new Date(),
          churnRiskReasoning: scored.reasoning,
        },
      });

      // Fire a notification when the score crosses 70 — but only if
      // the previous score was below 70 (don't re-fire on continued
      // risk), OR we haven't already notified in the past 7 days.
      const crossedUp = scored.score >= 70 && (b.churnRiskScore == null || b.churnRiskScore < 70);
      if (crossedUp) {
        const recent = await prisma.notification.findFirst({
          where: {
            createdAt: { gte: suppressionSince },
            metadata: { path: ["brandId"], equals: b.id },
          },
          select: { id: true, metadata: true },
        });
        const isSuppressed =
          recent?.metadata && (recent.metadata as any).source === "predict-churn";
        if (!isSuppressed) {
          const recipients = new Set<string>(adminIds);
          if (b.salesRepId) recipients.add(b.salesRepId);
          await Promise.all(
            Array.from(recipients).map((userId) =>
              prisma.notification.create({
                data: {
                  userId,
                  type: "BRAND_ACTIVITY",
                  title: `⚠ Churn risk crossed 70: ${b.name}`,
                  message: scored.reasoning.slice(0, 240),
                  link: `/brands/${b.id}`,
                  metadata: {
                    source: "predict-churn",
                    brandId: b.id,
                    score: scored.score,
                  },
                },
              }),
            ),
          );
        }
      }
      results.push({ brandId: b.id, name: b.name, score: scored.score });
    } catch (err: any) {
      results.push({ brandId: b.id, name: b.name, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    total: targetBrands.length,
    results: results.slice(0, 100),
  });
}

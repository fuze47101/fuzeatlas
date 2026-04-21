// @ts-nocheck
/**
 * GET /api/cron/bd-sequence-tick
 *
 * BD Wizard Phase 3 hourly tick. Walks BDSequenceStep rows whose
 * scheduledFor has passed and whose status is "pending", and:
 *
 *   - email steps          → call generateDraft(), store subject+body on the
 *                            step, flip status="ready", create a CrmTask on
 *                            the rep's queue with a deep link to the wizard.
 *   - linkedin_dm steps    → call generateDraft() with channel=linkedin,
 *                            store body, flip status="ready", create a
 *                            "copy/paste to LinkedIn" CrmTask.
 *   - linkedin_connect     → no draft; just create a "send connect" CrmTask
 *                            and flip status="ready". (We don't actually do
 *                            this for the default cadence because step 0 is
 *                            auto-skipped at sequence creation, but a future
 *                            cadence could include a real LI-connect step.)
 *   - paid steps           → flip Brand.paidAudienceTagged=true, mark step
 *                            "sent" (no human gate per Andrew — this one
 *                            is system-driven). Bump counters.
 *   - tradeshow steps      → no draft; create an "invite to next show"
 *                            CrmTask and flip status="ready".
 *
 * Per Andrew's locked decision (2026-04-20): NO auto-send. Email and
 * LinkedIn steps stop at "ready" and wait for the rep to approve in the
 * wizard. The cron's only autonomous action is the paid-retargeting flag.
 *
 * Auth: Bearer CRON_SECRET (matches the rest of the cron pattern).
 *       In dev with no CRON_SECRET set, it's open — middleware exempts
 *       /api/cron entirely.
 *
 * Idempotent — only acts on status="pending" rows whose scheduledFor has
 * passed. Re-running within the hour is safe; nothing double-fires.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/bd-draft";
import { humanChannel } from "@/lib/bd-sequence";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
const MAX_STEPS_PER_TICK = 50; // safety bound — at scale we'd batch over multiple ticks

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: any = {
    tickedAt: now.toISOString(),
    found: 0,
    advanced: 0,
    skipped: 0,
    failed: 0,
    perChannel: {} as Record<string, number>,
    errors: [] as string[],
  };

  // Pull due pending steps. Include the parent sequence + brand + contact + rep
  // so we can act without N+1 queries.
  const dueSteps = await prisma.bDSequenceStep.findMany({
    where: {
      status: "pending",
      scheduledFor: { lte: now },
      sequence: { status: "active" },
    },
    include: {
      sequence: {
        include: {
          brand: true,
          contact: true,
          rep: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: MAX_STEPS_PER_TICK,
  });

  results.found = dueSteps.length;

  for (const step of dueSteps) {
    const { sequence } = step;
    const brand = sequence.brand;
    const contact = sequence.contact;
    const rep = sequence.rep;
    const contactDisplay =
      contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      contact.email ||
      "contact";

    results.perChannel[step.channel] = (results.perChannel[step.channel] || 0) + 1;

    try {
      // ─── Branch 1: paid retargeting — auto-execute, no human gate ──
      if (step.channel === "paid") {
        await prisma.$transaction(async (tx) => {
          await tx.brand.update({
            where: { id: brand.id },
            data: {
              paidAudienceTagged: true,
              paidAudienceTaggedAt: now,
            },
          });
          await tx.bDSequenceStep.update({
            where: { id: step.id },
            data: { status: "sent", sentAt: now },
          });
          // Recompute counters inline (we have the data, no need to recount)
          await tx.bDSequence.update({
            where: { id: sequence.id },
            data: { sentSteps: { increment: 1 } },
          });
          // Notify the rep so they know an audience was tagged
          await tx.notification.create({
            data: {
              userId: rep.id,
              type: "BRAND_ACTIVITY",
              title: `${brand.name} tagged for paid retargeting`,
              message: `Day-14 paid step in your BD sequence flipped on. Bundle this brand into the next ad-audience push.`,
              link: `/admin/bd/sequences/${sequence.id}`,
            },
          });
        });
        results.advanced++;
        continue;
      }

      // ─── Branch 2: email and linkedin_dm — generate draft, queue task ──
      if (step.channel === "email" || step.channel === "linkedin_dm") {
        const draft = await generateDraft({
          brand,
          contact,
          channel: step.channel === "email" ? "email" : "linkedin",
          repName: rep.name || rep.email.split("@")[0],
          userId: rep.id,
          isFollowUp: true, // every cron-generated step is a follow-up; first touch is the wizard send
          tone: "direct",
        });

        const taskTitle =
          step.channel === "email"
            ? `Email follow-up ready: ${brand.name}`
            : `LinkedIn DM ready: ${contactDisplay} (${brand.name})`;
        const taskNotes =
          step.channel === "email"
            ? `Day ${Math.round((step.scheduledFor.getTime() - sequence.startedAt.getTime()) / 86400000)} of your BD sequence. Open the wizard to review and send.`
            : `Day ${Math.round((step.scheduledFor.getTime() - sequence.startedAt.getTime()) / 86400000)} of your BD sequence. The DM text is drafted — open the wizard, copy it, paste into LinkedIn.`;

        await prisma.$transaction(async (tx) => {
          // Create the rep-facing task
          const task = await tx.crmTask.create({
            data: {
              title: taskTitle,
              notes: taskNotes,
              dueAt: now,
              priority: "NORMAL",
              ownerId: rep.id,
              createdById: rep.id, // self-created on the rep's behalf
              brandId: brand.id,
            },
          });
          await tx.bDSequenceStep.update({
            where: { id: step.id },
            data: {
              status: "ready",
              readyAt: now,
              draftSubject: draft.subject || null,
              draftBody: draft.body,
              crmTaskId: task.id,
            },
          });
          // In-app bell notification with deep link
          await tx.notification.create({
            data: {
              userId: rep.id,
              type: "BRAND_ACTIVITY",
              title: taskTitle,
              message: taskNotes,
              link: `/admin/bd/wizard?stepId=${step.id}`,
            },
          });
        });
        results.advanced++;
        continue;
      }

      // ─── Branch 3: linkedin_connect, tradeshow — manual reminder only ──
      if (step.channel === "linkedin_connect" || step.channel === "tradeshow") {
        const isConnect = step.channel === "linkedin_connect";
        const taskTitle = isConnect
          ? `Send LinkedIn connect to ${contactDisplay} (${brand.name})`
          : `Invite ${contactDisplay} to next FUZE tradeshow (${brand.name})`;
        const taskNotes = isConnect
          ? `Day ${Math.round((step.scheduledFor.getTime() - sequence.startedAt.getTime()) / 86400000)} of your BD sequence. No draft — open LinkedIn and send a connect request with a personal note.`
          : `Day ${Math.round((step.scheduledFor.getTime() - sequence.startedAt.getTime()) / 86400000)} of your BD sequence. Add this contact to the invite list for the next FUZE tradeshow appearance.`;

        await prisma.$transaction(async (tx) => {
          const task = await tx.crmTask.create({
            data: {
              title: taskTitle,
              notes: taskNotes,
              dueAt: now,
              priority: "NORMAL",
              ownerId: rep.id,
              createdById: rep.id,
              brandId: brand.id,
            },
          });
          await tx.bDSequenceStep.update({
            where: { id: step.id },
            data: { status: "ready", readyAt: now, crmTaskId: task.id },
          });
          await tx.notification.create({
            data: {
              userId: rep.id,
              type: "BRAND_ACTIVITY",
              title: taskTitle,
              message: taskNotes,
              link: `/admin/bd/sequences/${sequence.id}`,
            },
          });
        });
        results.advanced++;
        continue;
      }

      // Unknown channel — mark failed so we can investigate.
      await prisma.bDSequenceStep.update({
        where: { id: step.id },
        data: {
          status: "failed",
          failedAt: now,
          failReason: `Unknown channel "${step.channel}"`,
        },
      });
      results.failed++;
    } catch (err: any) {
      console.error(`[bd-sequence-tick] step ${step.id} failed:`, err);
      results.errors.push(`${step.id}: ${err?.message || String(err)}`);
      // Don't mark the step failed on transient errors — let the next tick retry.
      // Only persistent failures (e.g. unknown channel) get the failed flag.
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

export async function POST(req: Request) {
  // Allow manual trigger from the admin UI for testing
  return GET(req);
}

// @ts-nocheck
/**
 * POST /api/admin/bd/sequence/[id]/mark-replied
 *
 * Phase 4 — secondary follow-up wizard trigger.
 *
 * Called two ways:
 *   1. Manually from /admin/bd/sequences/[id] when the rep clicks
 *      "Reply received" (body: { source: "manual", replySummary?: string })
 *   2. Automatically from /api/inbound/email when the BCC-to-Atlas pipe
 *      drops an INBOUND note onto a contact that has an active sequence
 *      (body: { source: "bcc", replySummary?: string })
 *
 * What it does:
 *   - Exits the sequence with reason="replied" (preserves replySummary
 *     on BDSequence.exitNote). Idempotent — if already exited with
 *     reason=replied, no-op.
 *   - Drops a CrmTask on the rep: "Reply from {contact} at {brand}"
 *     dueAt=now, priority=HIGH, brandId=seq.brandId. The task body
 *     includes a deep-link to the reply wizard.
 *   - Fires a Notification (type=BRAND_ACTIVITY) with link to the
 *     reply wizard so the rep sees it in their bell.
 *
 * Response:
 *   { ok: true, sequence, task, notification, replyWizardLink }
 *
 * Locked decision (2026-04-20): no meeting booking, no auto-task
 * spawning beyond the single "reply received" task. Keep this endpoint
 * small — the rep drives the actual response from the wizard.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isBDEligible =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    if (!isBDEligible) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || "manual");
    const replySummary = body?.replySummary ? String(body.replySummary).trim() : null;

    const seq = await prisma.bDSequence.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            salesRepId: true,
            pipelineStage: true,
            handoffPending: true,
          },
        },
        contact: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
        rep: { select: { id: true, name: true, email: true } },
      },
    });
    if (!seq) {
      return NextResponse.json({ ok: false, error: "Sequence not found" }, { status: 404 });
    }
    if (!isAdmin && seq.repId !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const contactName =
      seq.contact?.name ||
      [seq.contact?.firstName, seq.contact?.lastName].filter(Boolean).join(" ") ||
      seq.contact?.email ||
      "contact";
    const brandName = seq.brand?.name || "brand";
    const replyWizardLink = `/admin/bd/wizard/reply?sequenceId=${seq.id}`;

    // Idempotent: already exited with reason=replied — return the existing state.
    if (seq.status === "exited" && seq.exitReason === "replied") {
      return NextResponse.json({
        ok: true,
        alreadyReplied: true,
        sequence: seq,
        replyWizardLink,
      });
    }

    // 1. Exit the sequence. (BDSequence doesn't currently have a free-text
    // exitNote column — the reply summary lives on the CrmTask + Notification
    // created below, and the reply wizard pulls it from the Notification
    // metadata.)
    const updatedSeq = await prisma.bDSequence.update({
      where: { id: seq.id },
      data: {
        status: "exited",
        exitReason: "replied",
        completedAt: new Date(),
      },
    });

    // 1a. ACM hand-off — phase 5 rule: sourcing rep stays as account manager.
    //   - If brand has no salesRepId yet, bind it to the sourcing rep so
    //     commission attribution is preserved (the rep who originated the
    //     conversation owns the brand from here on out).
    //   - If brand already has a salesRepId, leave it alone — it may have
    //     been explicitly reassigned by an SDR manager.
    //   - Stamp lastActivityAt so the 75/90-day inactivity job doesn't
    //     immediately threaten this brand.
    //   - Clear inactivityWarnedAt for the same reason — fresh activity.
    //   - Flip handoffPending=true so the brand shows up on Andrew/Scott/
    //     Tina's "review for hand-off to ACM team" queue, without forcing
    //     the rep to formally release.
    //   - If the brand is still LEAD, bump it to PRESENTATION — they
    //     replied, they're warm.
    const brandUpdate: any = {
      lastActivityAt: new Date(),
      inactivityWarnedAt: null,
      handoffPending: true,
    };
    if (!seq.brand?.salesRepId && seq.repId) {
      brandUpdate.salesRepId = seq.repId;
    }
    if (seq.brand?.pipelineStage === "LEAD") {
      brandUpdate.pipelineStage = "PRESENTATION";
    }
    const updatedBrand = await prisma.brand.update({
      where: { id: seq.brandId },
      data: brandUpdate,
      select: {
        id: true,
        name: true,
        salesRepId: true,
        pipelineStage: true,
        handoffPending: true,
      },
    });

    // 2. Drop a CrmTask on the rep — dueAt=now so it surfaces at the top
    // of their ACM tasks board. The notes field carries the deep-link.
    const taskTitle = `Reply from ${contactName} at ${brandName}`;
    const taskNotes = [
      replySummary ? `What they said: ${replySummary}` : null,
      `Respond via wizard: ${replyWizardLink}`,
      source === "bcc" ? "(auto-detected from BCC-to-Atlas)" : "(flagged manually)",
    ]
      .filter(Boolean)
      .join("\n\n");

    const task = await prisma.crmTask.create({
      data: {
        title: taskTitle,
        notes: taskNotes,
        dueAt: new Date(),
        status: "OPEN",
        priority: "HIGH",
        ownerId: seq.repId,
        createdById: user.id,
        brandId: seq.brandId,
      },
    });

    // 3. Bell notification on the rep.
    const notification = await prisma.notification.create({
      data: {
        userId: seq.repId,
        type: "BRAND_ACTIVITY",
        title: `Reply from ${contactName}`,
        message: replySummary
          ? `${contactName} (${brandName}): "${replySummary.slice(0, 140)}${replySummary.length > 140 ? "…" : ""}"`
          : `${contactName} at ${brandName} replied to your outreach. Open the reply wizard to draft a response.`,
        link: replyWizardLink,
        metadata: {
          sequenceId: seq.id,
          brandId: seq.brandId,
          contactId: seq.contactId,
          source,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sequence: updatedSeq,
      brand: updatedBrand,
      task,
      notification,
      replyWizardLink,
    });
  } catch (err: any) {
    console.error("[bd/sequence/mark-replied] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to mark replied" },
      { status: 500 },
    );
  }
}

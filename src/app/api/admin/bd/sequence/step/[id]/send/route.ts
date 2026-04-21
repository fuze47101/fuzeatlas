// @ts-nocheck
/**
 * POST /api/admin/bd/sequence/step/[id]/send
 *
 * Rep approves a READY email step and ships it. Two entry points:
 *
 *   1. From /acm/tasks — rep clicks "Send" on the BD-sequence task.
 *   2. From /admin/bd/sequences/[id] — rep clicks "Send" on the ready step row.
 *
 * Body (all optional — if omitted we send the stored draft as-is):
 *   { subject?: string, body?: string }
 *
 * Rules:
 *   - Step must be status="ready"
 *   - Step channel must be "email" (linkedin_dm is copy/paste, rep marks it
 *     sent manually via the skip/mark-sent endpoints; we don't dispatch LI
 *     programmatically — Andrew's locked decision 2026-04-20)
 *   - Step's sequence.status must be "active"
 *   - Rep must own the step's sequence, unless caller is ADMIN/EMPLOYEE
 *
 * Internally we forward to /api/admin/bd/wizard/send with stepId set — that
 * keeps the single source of truth for the atomic "dispatch + log + advance
 * sequence" transaction. We pass the request's cookie header so the
 * downstream route sees the same authenticated user.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP";
  if (!isBDEligible) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

  const { id } = await params;

  const step = await prisma.bDSequenceStep.findUnique({
    where: { id },
    include: {
      sequence: {
        include: {
          brand: { select: { id: true } },
          contact: { select: { id: true } },
        },
      },
    },
  });
  if (!step) return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  if (!isAdmin && step.sequence.repId !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (step.sequence.status !== "active") {
    return NextResponse.json(
      { ok: false, error: `Cannot send — sequence is ${step.sequence.status}` },
      { status: 400 },
    );
  }
  if (step.status !== "ready") {
    return NextResponse.json(
      { ok: false, error: `Step is ${step.status} — only ready steps can be sent` },
      { status: 400 },
    );
  }
  if (step.channel !== "email") {
    return NextResponse.json(
      {
        ok: false,
        error: `Step channel is "${step.channel}" — only email steps are sendable from this endpoint. Use /mark-sent for manual channels.`,
      },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const subject = body?.subject ? String(body.subject) : step.draftSubject;
  const bodyText = body?.body ? String(body.body) : step.draftBody;
  if (!subject || !bodyText) {
    return NextResponse.json(
      { ok: false, error: "No draft on this step — open the wizard to generate one first" },
      { status: 400 },
    );
  }

  // Forward to the canonical wizard/send endpoint. Passing the cookie header
  // keeps the session intact; stepId tells that route to mark the step sent
  // instead of creating a new sequence.
  const origin = new URL(req.url).origin;
  const cookieHeader = req.headers.get("cookie") || "";
  const res = await fetch(`${origin}/api/admin/bd/wizard/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      brandId: step.sequence.brand.id,
      contactId: step.sequence.contact.id,
      channel: "email",
      subject,
      body: bodyText,
      stepId: step.id,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || `Wizard send returned ${res.status}` },
      { status: res.status || 502 },
    );
  }

  // Close the CrmTask we created when this step went ready, if any.
  if (step.crmTaskId) {
    try {
      await prisma.crmTask.update({
        where: { id: step.crmTaskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    } catch (e) {
      // Task may have been deleted or is on a different owner — ignore.
      console.warn("[bd/sequence/step/send] could not close task:", e);
    }
  }

  return NextResponse.json({ ok: true, ...data });
}

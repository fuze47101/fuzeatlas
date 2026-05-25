// @ts-nocheck
/**
 * GET  /api/admin/bd/sequence/[id]  — full sequence detail (all steps)
 * PATCH /api/admin/bd/sequence/[id] — exit / pause / resume
 *
 * PATCH body:
 *   { action: "exit",   reason: string }  → status=exited, exitReason, completedAt=now
 *   { action: "pause" }                    → status=paused
 *   { action: "resume" }                   → status=active (only from paused)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function loadSequence(id: string, userId: string, isAdmin: boolean) {
  const seq = await prisma.bDSequence.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          textileCategory: true,
          pipelineStage: true,
          salesRepId: true,
          paidAudienceTagged: true,
        },
      },
      contact: true,
      rep: { select: { id: true, name: true, email: true } },
      steps: { orderBy: { stepIndex: "asc" } },
    },
  });
  if (!seq) return { error: "Not found", code: 404 };
  if (!isAdmin && seq.repId !== userId) {
    return { error: "Forbidden", code: 403 };
  }
  return { seq };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP" ||
    user.role === "BD_REP";
  if (!isBDEligible) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
  const { id } = await params;
  const loaded = await loadSequence(id, user.id, isAdmin);
  if ("error" in loaded)
    return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.code });
  return NextResponse.json({ ok: true, sequence: loaded.seq });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const isBDEligible =
    user.role === "ADMIN" ||
    user.role === "EMPLOYEE" ||
    user.role === "SALES_MANAGER" ||
    user.role === "SALES_REP" ||
    user.role === "BD_REP";
  if (!isBDEligible) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
  const { id } = await params;
  const loaded = await loadSequence(id, user.id, isAdmin);
  if ("error" in loaded)
    return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.code });
  const seq = loaded.seq;

  const body = await req.json();
  const action = String(body?.action || "").toLowerCase();

  if (action === "exit") {
    const reason = String(body?.reason || "manual_stop");
    if (!["replied", "meeting_booked", "unqualified", "manual_stop", "replaced"].includes(reason)) {
      return NextResponse.json({ ok: false, error: "Invalid exit reason" }, { status: 400 });
    }
    const updated = await prisma.bDSequence.update({
      where: { id: seq.id },
      data: {
        status: "exited",
        exitReason: reason,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, sequence: updated });
  }

  if (action === "pause") {
    if (seq.status !== "active") {
      return NextResponse.json(
        { ok: false, error: `Cannot pause from status "${seq.status}"` },
        { status: 400 },
      );
    }
    const updated = await prisma.bDSequence.update({
      where: { id: seq.id },
      data: { status: "paused" },
    });
    return NextResponse.json({ ok: true, sequence: updated });
  }

  if (action === "resume") {
    if (seq.status !== "paused") {
      return NextResponse.json(
        { ok: false, error: `Cannot resume from status "${seq.status}"` },
        { status: 400 },
      );
    }
    const updated = await prisma.bDSequence.update({
      where: { id: seq.id },
      data: { status: "active" },
    });
    return NextResponse.json({ ok: true, sequence: updated });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

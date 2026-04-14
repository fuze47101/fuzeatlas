// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Fabric lab lifecycle transitions.
 *
 * POST /api/fabrics/[id]/lab-status
 *   body: { action, ... }
 *     action = "receive"         → { notes? }
 *     action = "start-testing"   → { estimatedCompletion?, notes? }
 *     action = "complete-testing"→ { notes? }
 *     action = "reset"           → clears all status (back to UPLOADED)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    const now = new Date();
    const data: any = {};

    if (action === "receive") {
      data.labStatus = "RECEIVED";
      data.receivedAt = now;
      data.receivedById = user.id;
      if (body.notes) data.labNotes = body.notes;
    } else if (action === "start-testing") {
      data.labStatus = "TESTING";
      data.testingStartedAt = now;
      data.testingStartedById = user.id;
      if (body.estimatedCompletion) {
        data.testingEstimatedCompletion = new Date(body.estimatedCompletion);
      }
      if (body.notes) data.labNotes = body.notes;
      // If not previously marked received, stamp it now
      const existing = await prisma.fabric.findUnique({ where: { id }, select: { receivedAt: true } });
      if (!existing?.receivedAt) {
        data.receivedAt = now;
        data.receivedById = user.id;
      }
    } else if (action === "complete-testing") {
      data.labStatus = "COMPLETE";
      data.testingCompletedAt = now;
      data.testingCompletedById = user.id;
      if (body.notes) data.labNotes = body.notes;
    } else if (action === "reset") {
      data.labStatus = "UPLOADED";
      data.receivedAt = null;
      data.receivedById = null;
      data.testingStartedAt = null;
      data.testingStartedById = null;
      data.testingEstimatedCompletion = null;
      data.testingCompletedAt = null;
      data.testingCompletedById = null;
    } else {
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }

    const fabric = await prisma.fabric.update({ where: { id }, data });
    return NextResponse.json({ ok: true, fabric });
  } catch (e: any) {
    console.error("Lab status error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

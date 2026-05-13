// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordChange } from "@/lib/audit";
import { notifyLabAssignmentRejected } from "@/lib/notify";

/**
 * POST /api/lab-portal/test-requests/[id]/reject
 *
 * NEED-7 — lab rejects an ASSIGNED_TO_LAB request. Flips back to
 * APPROVED (admin reassign queue), clears labId, stamps labRejectedAt
 * + labRejectionReason. Fans notifyLabAssignmentRejected to brand
 * + admins so it can be reassigned promptly.
 *
 * Body: { reason: string }   // required, surfaced on the brand side
 */
const LAB_ROLES = ["LAB_USER", "LAB_MANAGER", "ADMIN", "EMPLOYEE"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!LAB_ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reason = (body.reason || "").trim();
  if (!reason) {
    return NextResponse.json(
      { ok: false, error: "Rejection reason is required so the brand knows why to reassign." },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  const tr = await prisma.testRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      labId: true,
      poNumber: true,
      brandId: true,
      brand: { select: { id: true, name: true } },
      lab: { select: { id: true, name: true } },
    },
  });
  if (!tr)
    return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });

  if (
    !["ADMIN", "EMPLOYEE"].includes(user.role) &&
    (!user.labId || user.labId !== tr.labId)
  ) {
    return NextResponse.json(
      { ok: false, error: "This request isn't assigned to your lab" },
      { status: 403 },
    );
  }
  if (tr.status !== "ASSIGNED_TO_LAB") {
    return NextResponse.json(
      { ok: false, error: `Request is in status ${tr.status} — only ASSIGNED_TO_LAB can be rejected.` },
      { status: 409 },
    );
  }

  const before = {
    status: tr.status,
    labId: tr.labId,
    labRejectedAt: null,
    labRejectionReason: null,
  };
  const labName = tr.lab?.name || null;

  const updated = await prisma.testRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      labId: null,
      labRejectedAt: new Date(),
      labRejectionReason: reason,
      // Clear the acceptance / completion estimate from any previous
      // cycle on this same request.
      labAcceptedAt: null,
      estimatedCompletionDate: null,
    },
    select: {
      id: true,
      status: true,
      labId: true,
      labRejectedAt: true,
      labRejectionReason: true,
      poNumber: true,
    },
  });

  recordChange({
    actorUserId: user.id,
    entity: "TestRequest",
    entityId: updated.id,
    description: `Lab rejected test request ${updated.poNumber || ""} — reassignment needed`.trim(),
    before,
    after: {
      status: updated.status,
      labId: updated.labId,
      labRejectedAt: updated.labRejectedAt,
      labRejectionReason: updated.labRejectionReason,
    },
  }).catch((e) => console.warn("[lab-reject] audit failed:", e));

  notifyLabAssignmentRejected({
    testRequestId: updated.id,
    poNumber: updated.poNumber,
    brandId: tr.brandId,
    brandName: tr.brand?.name || null,
    labName,
    reason,
  }).catch((e) => console.warn("[lab-reject] notify failed:", e));

  return NextResponse.json({ ok: true, testRequest: updated });
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordChange } from "@/lib/audit";

/**
 * POST /api/lab-portal/test-requests/[id]/accept
 *
 * NEED-7 — lab accepts an ASSIGNED_TO_LAB request. Flips to
 * SUBMITTED, stamps labAcceptedAt, and computes estimated completion
 * from the union of the longest turnaroundDays across the request's
 * lines (matched against LabService for the assigned lab).
 *
 * Refuses if:
 *   - caller isn't a lab user / lab manager on the request's lab
 *   - status isn't ASSIGNED_TO_LAB (already accepted / rejected)
 */
const LAB_ROLES = ["LAB_USER", "LAB_MANAGER", "ADMIN", "EMPLOYEE"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!LAB_ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const tr = await prisma.testRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      labId: true,
      poNumber: true,
      lines: { select: { testType: true, testMethod: true } },
    },
  });
  if (!tr)
    return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });

  // Lab user must be on the assigned lab; admins bypass.
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
      { ok: false, error: `Request is in status ${tr.status} — only ASSIGNED_TO_LAB can be accepted.` },
      { status: 409 },
    );
  }

  // Compute estimated completion from the longest LabService.turnaroundDays
  // across the request's lines. Fall back to 14 days if the lab has no
  // matching services on file.
  let maxTurnaround = 0;
  if (tr.labId && tr.lines.length > 0) {
    const services = await prisma.labService.findMany({
      where: {
        labId: tr.labId,
        OR: tr.lines.map((l) => ({
          testType: l.testType,
          ...(l.testMethod ? { testMethod: l.testMethod } : {}),
        })),
      },
      select: { turnaroundDays: true },
    });
    for (const s of services) {
      if (s.turnaroundDays && s.turnaroundDays > maxTurnaround) {
        maxTurnaround = s.turnaroundDays;
      }
    }
  }
  if (maxTurnaround === 0) maxTurnaround = 14;
  const estimatedCompletionDate = new Date(Date.now() + maxTurnaround * 86400_000);

  const before = await prisma.testRequest.findUnique({
    where: { id },
    select: { status: true, labAcceptedAt: true, estimatedCompletionDate: true },
  });
  const updated = await prisma.testRequest.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      labAcceptedAt: new Date(),
      estimatedCompletionDate,
    },
    select: {
      id: true,
      status: true,
      labAcceptedAt: true,
      estimatedCompletionDate: true,
      poNumber: true,
    },
  });

  recordChange({
    actorUserId: user.id,
    entity: "TestRequest",
    entityId: updated.id,
    description: `Lab accepted test request ${updated.poNumber || ""}`.trim(),
    before,
    after: {
      status: updated.status,
      labAcceptedAt: updated.labAcceptedAt,
      estimatedCompletionDate: updated.estimatedCompletionDate,
    },
  }).catch((e) => console.warn("[lab-accept] audit failed:", e));

  return NextResponse.json({
    ok: true,
    testRequest: updated,
    turnaroundDays: maxTurnaround,
  });
}

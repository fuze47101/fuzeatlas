// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/brand-portal/approve  (Phase 7C)
 *
 * Body: { kind: "submission"|"test"|"order", id: string,
 *         decision: "APPROVED"|"REJECTED", reason?: string }
 *
 * Updates the right model. On REJECTED the row stays visible to
 * audit (we don't delete) but TestRun.brandVisible flips back to
 * false so it doesn't show up as a brand-cleared result. Reason
 * is required on REJECTED.
 *
 * Edit gated to ADMIN / EMPLOYEE / BRAND_MANAGER / SALES_MANAGER.
 * BRAND_USER intentionally excluded — approvals are contractual.
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER"];
const VALID_KINDS = ["submission", "test", "order"];
const VALID_DECISIONS = ["APPROVED", "REJECTED"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId && user.role !== "ADMIN" && user.role !== "EMPLOYEE") return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!VALID_KINDS.includes(body.kind)) return bad("kind must be submission|test|order");
  if (!body.id) return bad("id required");
  if (!VALID_DECISIONS.includes(body.decision))
    return bad("decision must be APPROVED|REJECTED");
  if (body.decision === "REJECTED" && !body.reason)
    return bad("reason required on REJECTED");

  const stamp = {
    brandApprovalStatus: body.decision,
    brandApprovedById: user.id,
    brandApprovedAt: new Date(),
    brandRejectionReason: body.decision === "REJECTED" ? String(body.reason) : null,
  };

  let updated: any;
  if (body.kind === "submission") {
    const row = await prisma.fabricSubmission.findUnique({
      where: { id: body.id },
      select: { brandId: true },
    });
    if (!row) return bad("Submission not found");
    if (user.brandId && row.brandId !== user.brandId && user.role !== "ADMIN" && user.role !== "EMPLOYEE")
      return forbidden();
    updated = await prisma.fabricSubmission.update({
      where: { id: body.id },
      data: stamp,
      select: { id: true, brandApprovalStatus: true, brandApprovedAt: true },
    });
  } else if (body.kind === "test") {
    const row = await prisma.testRun.findUnique({
      where: { id: body.id },
      select: { id: true, submission: { select: { brandId: true } } },
    });
    if (!row) return bad("TestRun not found");
    if (
      user.brandId &&
      row.submission?.brandId !== user.brandId &&
      user.role !== "ADMIN" &&
      user.role !== "EMPLOYEE"
    )
      return forbidden();
    // On REJECTED: clear brandVisible so the result returns to
    // internal-only state. APPROVED leaves brandVisible=true.
    const data: any = { ...stamp };
    if (body.decision === "REJECTED") data.brandVisible = false;
    updated = await prisma.testRun.update({
      where: { id: body.id },
      data,
      select: {
        id: true,
        brandApprovalStatus: true,
        brandApprovedAt: true,
        brandVisible: true,
      },
    });
  } else {
    // order
    const row = await prisma.fuzeOrder.findUnique({
      where: { id: body.id },
      select: { brandId: true },
    });
    if (!row) return bad("Order not found");
    if (user.brandId && row.brandId !== user.brandId && user.role !== "ADMIN" && user.role !== "EMPLOYEE")
      return forbidden();
    updated = await prisma.fuzeOrder.update({
      where: { id: body.id },
      data: stamp,
      select: { id: true, brandApprovalStatus: true, brandApprovedAt: true },
    });
  }

  return NextResponse.json({ ok: true, kind: body.kind, updated });
}

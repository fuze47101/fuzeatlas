// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/lab-portal/queue  (Phase 4F — DO+OVERSEE)
 *
 * Incoming submissions + open test requests for the caller's lab.
 * The lab's "in flight" view across every brand and factory it handles.
 *
 *   pendingRequests — TestRequest where labId = caller's lab and
 *                     status not closed.
 *   recentSubmissions — FabricSubmission for fabrics whose
 *                       most-recent TestRequest landed at this lab,
 *                       last 50.
 */

const FULFILLED_STATUSES = ["COMPLETE", "CANCELLED", "REJECTED"];

const ROLES = ["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ROLES.includes(user.role)) return forbidden();
  if (!user.labId && user.role !== "ADMIN" && user.role !== "EMPLOYEE") return forbidden();

  const labId = user.labId;

  const baseWhere: any = { status: { notIn: FULFILLED_STATUSES } };
  if (labId) baseWhere.labId = labId;

  const pending = await prisma.testRequest.findMany({
    where: baseWhere,
    select: {
      id: true,
      poNumber: true,
      status: true,
      requestedAt: true,
      pricingTier: true,
      brand: { select: { id: true, name: true } },
      fabric: { select: { id: true, fuzeNumber: true, customerCode: true } },
      submission: {
        select: {
          id: true,
          factoryId: true,
          factory: { select: { id: true, name: true, country: true } },
          fuzeFabricNumber: true,
        },
      },
      lines: { select: { id: true, testType: true } },
    },
    orderBy: [{ requestedAt: "desc" }],
    take: 200,
  });

  // Recent submissions whose latest test request hit this lab.
  const recentSubmissionIds = new Set<string>();
  for (const r of pending) if (r.submission?.id) recentSubmissionIds.add(r.submission.id);
  const submissions = await prisma.fabricSubmission.findMany({
    where: { id: { in: Array.from(recentSubmissionIds) } },
    select: {
      id: true,
      submissionDate: true,
      status: true,
      fuzeFabricNumber: true,
      factory: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    pending,
    submissions,
    summary: {
      pendingTotal: pending.length,
      submissionTotal: submissions.length,
    },
  });
}

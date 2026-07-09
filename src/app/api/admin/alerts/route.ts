// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/alerts
 *
 * Powers the red "action required" banner at the top of /admin. Rolls
 * up every actionable queue nobody is watching:
 *   - Test requests awaiting approval
 *   - Sample-trial requests to review (SUBMITTED / UNDER_REVIEW)
 *   - Shipments in motion (SHIPPED / IN_TRANSIT / AT_LAB)
 *   - Test reports needing association (submissionId null OR
 *     raw.needsAssociation = true)
 *   - New fabric submissions to review (status = SUBMITTED)
 *   - Access requests pending
 *
 * Each queue is queried independently (per-count try/catch via .catch(()=>0))
 * so a schema-drift bug in one query can never blank the whole banner.
 *
 * Gate: ADMIN, EMPLOYEE, SALES_MANAGER, TESTING_MANAGER.
 */
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "TESTING_MANAGER"]);

type AlertItem = {
  key: string;
  label: string;
  count: number;
  link: string;
  tone: "red";
};

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED.has(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const [
    testApprovals,
    sampleRequests,
    shipmentsInMotion,
    reportsNeedingAssociation,
    newSubmissions,
    accessRequests,
  ] = await Promise.all([
    prisma.testRequest
      .count({ where: { status: "PENDING_APPROVAL" } })
      .catch(() => 0),
    // Mirrors /api/admin/sample-requests ACTION_NEEDED — SUBMITTED +
    // UNDER_REVIEW. ICP_PENDING is intentionally excluded per spec.
    prisma.sampleTrialRequest
      .count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      .catch(() => 0),
    // SampleShipment.status enum: PREPARING / SHIPPED / IN_TRANSIT /
    // DELIVERED / AT_LAB / RETURNED. "In motion" is the middle band.
    prisma.sampleShipment
      .count({ where: { status: { in: ["SHIPPED", "IN_TRANSIT", "AT_LAB"] } } })
      .catch(() => 0),
    // Orphan TestRuns — same clause the /tests page uses via the
    // ?needsAssociation=true filter (submissionId null OR raw JSON path
    // needsAssociation === true).
    prisma.testRun
      .count({
        where: {
          OR: [
            { submissionId: null },
            { raw: { path: ["needsAssociation"], equals: true } },
          ],
        },
      })
      .catch(() => 0),
    // FabricSubmission is created with status="SUBMITTED" by
    // /api/factory-portal/intake — that's the "new, unreviewed" state.
    prisma.fabricSubmission
      .count({ where: { status: "SUBMITTED" } })
      .catch(() => 0),
    prisma.accessRequest
      .count({ where: { status: "PENDING" } })
      .catch(() => 0),
  ]);

  const items: AlertItem[] = [];
  const add = (key: string, count: number, label: string, link: string) => {
    if (count > 0) items.push({ key, label, count, link, tone: "red" });
  };

  add("testApprovals", testApprovals, "Test requests awaiting approval", "/test-requests");
  add("sampleRequests", sampleRequests, "Sample requests to review", "/admin/sample-requests");
  add("shipmentsInMotion", shipmentsInMotion, "Shipments in transit / awaiting receipt", "/shipments");
  add(
    "reportsNeedingAssociation",
    reportsNeedingAssociation,
    "Test reports need association",
    "/tests?needsAssociation=true",
  );
  // No dedicated admin submissions review surface — factory-portal/submissions
  // is the canonical list, admins can view it via role scoping.
  add(
    "newSubmissions",
    newSubmissions,
    "New fabric submissions to review",
    "/factory-portal/submissions",
  );
  // /admin/access-requests doesn't exist — the real path is under
  // /settings/access-requests.
  add("accessRequests", accessRequests, "Access requests pending", "/settings/access-requests");

  const total = items.reduce((sum, i) => sum + i.count, 0);

  return NextResponse.json({
    ok: true,
    items,
    total,
    generatedAt: new Date().toISOString(),
  });
}

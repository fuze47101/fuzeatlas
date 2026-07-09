// @ts-nocheck
import { prisma } from "@/lib/prisma";

/**
 * Shared "action required" alert rollup.
 *
 * Single source of truth for every actionable queue nobody is watching.
 * Used by:
 *   - GET /api/admin/alerts (powers the red banner on /admin)
 *   - /api/cron/daily-digest (renders the "Action Required" section
 *     at the top of the digest email and prefixes the subject)
 *
 * Every count runs independently with .catch(()=>0) so a schema-drift
 * bug in one query can never blank the whole rollup. Every field name
 * was verified against prisma/schema.prisma before use:
 *
 *  - TestRequest.status             — "PENDING_APPROVAL"
 *  - SampleTrialRequest.status      — "SUBMITTED" / "UNDER_REVIEW"
 *  - SampleShipment.status enum     — PREPARING / SHIPPED / IN_TRANSIT /
 *                                     DELIVERED / AT_LAB / RETURNED
 *  - TestRun.raw (Json?)            — path ["needsAssociation"] === true
 *                                     OR TestRun.submissionId is null,
 *                                     AND TestRun.testDate is within
 *                                     the last 6 months. The date cutoff
 *                                     matters: a legacy bulk-import
 *                                     backdated ~1,275 rows by insert
 *                                     date, and those are unrecoverable
 *                                     — no lab-portal confirm flow will
 *                                     ever re-associate them. Runs with
 *                                     a null testDate are treated as
 *                                     legacy and excluded by the gte
 *                                     filter (null is not >= a date).
 *  - FabricSubmission.status        — exact "SUBMITTED" (the state the
 *                                     factory-portal intake endpoint
 *                                     creates rows with). Field is
 *                                     String? and also carries legacy
 *                                     values ("Submitted" / "active" /
 *                                     null); exact-match filter is
 *                                     intentional to skip those.
 *  - AccessRequest.status           — "PENDING"
 */

export type AdminAlertItem = {
  key: string;
  label: string;
  count: number;
  link: string;
};

export type AdminAlerts = {
  items: AdminAlertItem[];
  total: number;
};

export async function getAdminAlerts(): Promise<AdminAlerts> {
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
    // Mirror /api/admin/sample-requests ACTION_NEEDED. ICP_PENDING is
    // intentionally excluded per the alerts spec — it's a monitoring
    // state, not a "review this now" state.
    prisma.sampleTrialRequest
      .count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      .catch(() => 0),
    prisma.sampleShipment
      .count({ where: { status: { in: ["SHIPPED", "IN_TRANSIT", "AT_LAB"] } } })
      .catch(() => 0),
    // Orphan reports = (submissionId null OR raw.needsAssociation) AND
    // testDate within the last 6 months. The date scope is what makes
    // this actionable — a bulk import backdated ~1,275 legacy rows and
    // those are unrecoverable orphans, not an incoming queue. Runs
    // with a null testDate fall outside the gte filter and are
    // correctly excluded as legacy.
    prisma.testRun
      .count({
        where: {
          testDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 183) },
          OR: [
            { submissionId: null },
            { raw: { path: ["needsAssociation"], equals: true } },
          ],
        },
      })
      .catch(() => 0),
    // Exact-match "SUBMITTED" only — the FabricSubmission.status field
    // is String? and carries legacy values ("Submitted" title-case,
    // "active", null) that are NOT actionable. Case-insensitive or
    // includes-null broadening would refill the banner with noise.
    prisma.fabricSubmission
      .count({ where: { status: "SUBMITTED" } })
      .catch(() => 0),
    prisma.accessRequest
      .count({ where: { status: "PENDING" } })
      .catch(() => 0),
  ]);

  const raw: AdminAlertItem[] = [
    {
      key: "testApprovals",
      label: "Test requests awaiting approval",
      count: testApprovals,
      link: "/test-requests",
    },
    {
      key: "sampleRequests",
      label: "Sample requests to review",
      count: sampleRequests,
      link: "/admin/sample-requests",
    },
    {
      key: "shipmentsInMotion",
      label: "Shipments in transit / awaiting receipt",
      count: shipmentsInMotion,
      // No admin-namespaced shipments page exists — /shipments is the
      // canonical list and admins can view every row via role scoping.
      link: "/shipments",
    },
    {
      key: "reportsNeedingAssociation",
      label: "Test reports need association",
      count: reportsNeedingAssociation,
      link: "/tests?needsAssociation=true",
    },
    {
      key: "newSubmissions",
      label: "New fabric submissions to review",
      // No dedicated admin submissions review page —
      // /factory-portal/submissions is the canonical list.
      count: newSubmissions,
      link: "/factory-portal/submissions",
    },
    {
      key: "accessRequests",
      label: "Access requests pending",
      count: accessRequests,
      // The alerts spec's `/admin/access-requests` doesn't exist in
      // the app; the real route is `/settings/access-requests`.
      link: "/settings/access-requests",
    },
  ];

  const items = raw.filter((i) => i.count > 0);
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return { items, total };
}

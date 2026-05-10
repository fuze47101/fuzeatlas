// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterSubscribed } from "@/lib/notification-subscription";

/**
 * Daily approval-overdue cron (Phase 7D).
 *
 * Runs 14:30 UTC. Walks every pending submission / test result /
 * order where brandApprovalStatus='PENDING' AND createdAt > 5 days
 * old. For each item, fires an in-app escalation notification to
 * every active brand-manager / admin. Suppresses repeat fires
 * within 22h via Notification.metadata.kind='approval_overdue' +
 * subjectId.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPRESS_HOURS = 22;
const OVERDUE_DAYS = 5;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

interface CountedRow {
  id: string;
  ref: string;
  kind: "submission" | "test" | "order";
  brandId: string;
  brandName: string;
  createdAt: Date;
}

async function recentlyEscalated(subjectId: string) {
  const since = new Date(Date.now() - SUPPRESS_HOURS * 60 * 60 * 1000);
  const hit = await prisma.notification.findFirst({
    where: {
      createdAt: { gte: since },
      metadata: { path: ["kind"], equals: "approval_overdue" },
      AND: [{ metadata: { path: ["subjectId"], equals: subjectId } }],
    },
    select: { id: true },
  });
  return !!hit;
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== process.env.CRON_SECRET) return unauthorized();

  const cutoff = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000);

  const [subs, tests, orders] = await Promise.all([
    prisma.fabricSubmission.findMany({
      where: { brandApprovalStatus: "PENDING", createdAt: { lte: cutoff } },
      select: {
        id: true,
        fuzeFabricNumber: true,
        createdAt: true,
        brandId: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.testRun.findMany({
      where: {
        brandApprovalStatus: "PENDING",
        brandVisible: true,
        createdAt: { lte: cutoff },
      },
      select: {
        id: true,
        testReportNumber: true,
        testType: true,
        createdAt: true,
        submission: { select: { brandId: true, brand: { select: { name: true } } } },
      },
    }),
    prisma.fuzeOrder.findMany({
      where: {
        brandApprovalStatus: "PENDING",
        orderType: "PRODUCTION",
        createdAt: { lte: cutoff },
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        brandId: true,
        brand: { select: { name: true } },
      },
    }),
  ]);

  const rows: CountedRow[] = [
    ...subs
      .filter((s: any) => s.brandId && s.brand?.name)
      .map((s: any) => ({
        id: s.id,
        ref: `FUZE ${s.fuzeFabricNumber || "—"}`,
        kind: "submission" as const,
        brandId: s.brandId,
        brandName: s.brand!.name,
        createdAt: s.createdAt,
      })),
    ...tests
      .filter((t: any) => t.submission?.brandId && t.submission?.brand?.name)
      .map((t: any) => ({
        id: t.id,
        ref: `${t.testType}${t.testReportNumber ? ` #${t.testReportNumber}` : ""}`,
        kind: "test" as const,
        brandId: t.submission.brandId,
        brandName: t.submission.brand.name,
        createdAt: t.createdAt,
      })),
    ...orders
      .filter((o: any) => o.brandId && o.brand?.name)
      .map((o: any) => ({
        id: o.id,
        ref: o.orderNumber,
        kind: "order" as const,
        brandId: o.brandId,
        brandName: o.brand!.name,
        createdAt: o.createdAt,
      })),
  ];

  let escalated = 0;
  let suppressed = 0;
  for (const row of rows) {
    if (await recentlyEscalated(row.id)) {
      suppressed++;
      continue;
    }
    const brandUsers = await prisma.user.findMany({
      where: { brandId: row.brandId, status: "ACTIVE", role: { in: ["BRAND_MANAGER"] } },
      select: { id: true },
    });
    const admins = await prisma.user.findMany({
      where: { status: "ACTIVE", role: { in: ["ADMIN"] } },
      select: { id: true },
    });
    const recipients = await filterSubscribed(
      brandUsers.map((u: any) => u.id),
      "approval_overdue",
    );
    const allIds = Array.from(new Set([...recipients, ...admins.map((a: any) => a.id)]));

    if (allIds.length === 0) continue;
    const days = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const title = `Overdue approval (${days}d): ${row.ref}`;
    const message = `A ${row.kind} (${row.ref}) for ${row.brandName} has been pending approval for ${days} days. Open the approvals queue to clear it.`;

    await prisma.notification.createMany({
      data: allIds.map((userId) => ({
        userId,
        type: "PO_STATUS",
        title,
        message,
        link: "/brand-portal/approvals",
        metadata: {
          kind: "approval_overdue",
          subjectId: row.id,
          subjectKind: row.kind,
          brandId: row.brandId,
          daysPending: days,
        },
      })),
    });
    escalated++;
  }

  return NextResponse.json({ ok: true, scanned: rows.length, escalated, suppressed });
}

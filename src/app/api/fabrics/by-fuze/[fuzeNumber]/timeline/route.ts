// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/fabrics/[fuzeNumber]/timeline  (Phase 8B)
 *
 * Single fabric's complete story — every event aggregated and sorted
 * desc. The "where is FUZE-2503 right now?" answer.
 *
 * Permission: anyone in the fabric's supply chain can read. Read
 * uses the existing relations:
 *   - admin / employee → unrestricted
 *   - brand user — fabric.brandId === user.brandId
 *   - factory user — fabric.factoryId === user.factoryId OR a
 *     submission.factoryId match
 *   - lab user — at least one TestRun against this fabric had
 *     this user's labId
 *   - distributor user — at least one FuzeOrder shipped via this
 *     distributor for this fabric's brand+factory
 *
 * Event kinds: fabric_created, submission, test_request, test_run,
 * recipe_graduated, order_placed, consumption, approval.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

interface TimelineEvent {
  type:
    | "fabric_created"
    | "submission"
    | "test_request"
    | "test_run"
    | "recipe_graduated"
    | "order_placed"
    | "consumption"
    | "approval";
  timestamp: string;
  actor: string | null;
  summary: string;
  severity: "info" | "warn" | "error";
  deepLinkUrl: string | null;
}

async function userHasAccess(user: any, fabric: any): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") return true;
  if (user.brandId && fabric.brandId === user.brandId) return true;
  if (user.factoryId && fabric.factoryId === user.factoryId) return true;
  // Fall back to relation-presence checks for cases where the direct
  // FK isn't populated yet but a submission / test / order ties them.
  if (user.factoryId) {
    const sub = await prisma.fabricSubmission.findFirst({
      where: { fabricId: fabric.id, factoryId: user.factoryId },
      select: { id: true },
    });
    if (sub) return true;
  }
  if (user.labId) {
    const tr = await prisma.testRun.findFirst({
      where: { fabricId: fabric.id, labId: user.labId },
      select: { id: true },
    });
    if (tr) return true;
  }
  if (user.distributorId && fabric.brandId && fabric.factoryId) {
    const order = await prisma.fuzeOrder.findFirst({
      where: {
        distributorId: user.distributorId,
        brandId: fabric.brandId,
        factoryId: fabric.factoryId,
      },
      select: { id: true },
    });
    if (order) return true;
  }
  return false;
}

export async function GET(_req: Request, props: { params: Promise<{ fuzeNumber: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { fuzeNumber: fnStr } = await props.params;
  const fuzeNumber = parseInt(fnStr, 10);
  if (Number.isNaN(fuzeNumber)) {
    return NextResponse.json({ ok: false, error: "Invalid fuzeNumber" }, { status: 400 });
  }

  const fabric = await prisma.fabric.findUnique({
    where: { fuzeNumber },
    select: {
      id: true,
      fuzeNumber: true,
      customerCode: true,
      factoryCode: true,
      construction: true,
      color: true,
      createdAt: true,
      brandId: true,
      brand: { select: { id: true, name: true } },
      factoryId: true,
      factory: { select: { id: true, name: true } },
    },
  });
  if (!fabric) return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });

  const access = await userHasAccess(user, fabric);
  if (!access) return forbidden();

  // Pull every related event row, then merge + sort.
  const [submissions, tests, recipes, orders, consumption] = await Promise.all([
    prisma.fabricSubmission.findMany({
      where: { fabricId: fabric.id },
      select: {
        id: true,
        createdAt: true,
        submissionDate: true,
        status: true,
        brandApprovalStatus: true,
        factory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.testRun.findMany({
      where: { fabricId: fabric.id },
      select: {
        id: true,
        createdAt: true,
        testDate: true,
        testType: true,
        testReportNumber: true,
        brandVisible: true,
        brandApprovalStatus: true,
        lab: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.recipeBenchTest.findMany({
      where: { fabricId: fabric.id },
      select: {
        id: true,
        testDate: true,
        createdAt: true,
        graduatedAt: true,
        recommendedTier: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.fuzeOrder.findMany({
      where: {
        OR: [{ fabricId: fabric.id }, { brandId: fabric.brandId, factoryId: fabric.factoryId }],
      },
      select: {
        id: true,
        createdAt: true,
        orderNumber: true,
        orderType: true,
        status: true,
        volumeLiters: true,
        fuzeTier: true,
        brandApprovalStatus: true,
        factory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.fuzeConsumption.findMany({
      where: {
        OR: [
          { fabricId: fabric.id },
          { brandId: fabric.brandId, factoryId: fabric.factoryId },
        ],
      },
      select: {
        id: true,
        usageDate: true,
        createdAt: true,
        litersUsed: true,
        fuzeTier: true,
        factory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const events: TimelineEvent[] = [];

  events.push({
    type: "fabric_created",
    timestamp: fabric.createdAt.toISOString(),
    actor: fabric.factory?.name || null,
    summary: `Fabric created — FUZE ${fabric.fuzeNumber}`,
    severity: "info",
    deepLinkUrl: `/fabrics/${fabric.id}`,
  });

  for (const s of submissions) {
    const rejected = s.brandApprovalStatus === "REJECTED";
    events.push({
      type: "submission",
      timestamp: (s.submissionDate || s.createdAt).toISOString(),
      actor: s.factory?.name || null,
      summary: `Submission ${s.status}${rejected ? " · brand rejected" : ""}`,
      severity: rejected ? "error" : s.brandApprovalStatus === "PENDING" ? "warn" : "info",
      deepLinkUrl: `/fabrics/${fabric.id}`,
    });
  }

  for (const t of tests) {
    const isError = t.brandApprovalStatus === "REJECTED";
    events.push({
      type: "test_run",
      timestamp: (t.testDate || t.createdAt).toISOString(),
      actor: t.lab?.name || null,
      summary: `${t.testType} test${t.testReportNumber ? ` #${t.testReportNumber}` : ""}${
        t.brandVisible ? " · brand-visible" : ""
      }${isError ? " · brand rejected" : ""}`,
      severity: isError ? "error" : t.brandApprovalStatus === "PENDING" ? "warn" : "info",
      deepLinkUrl: `/tests/${t.id}`,
    });
  }

  for (const r of recipes) {
    if (r.graduatedAt) {
      events.push({
        type: "recipe_graduated",
        timestamp: r.graduatedAt.toISOString(),
        actor: null,
        summary: `Recipe graduated${r.recommendedTier ? ` at ${r.recommendedTier}` : ""}`,
        severity: "info",
        deepLinkUrl: `/admin/recipe-bench/${r.id}`,
      });
    } else {
      events.push({
        type: "recipe_graduated",
        timestamp: (r.testDate || r.createdAt).toISOString(),
        actor: null,
        summary: `Recipe bench test logged${r.recommendedTier ? ` (tier ${r.recommendedTier})` : ""}`,
        severity: "info",
        deepLinkUrl: `/admin/recipe-bench/${r.id}`,
      });
    }
  }

  for (const o of orders) {
    const flagged = o.brandApprovalStatus === "REJECTED";
    events.push({
      type: "order_placed",
      timestamp: o.createdAt.toISOString(),
      actor: o.factory?.name || null,
      summary: `${o.orderType} order ${o.orderNumber} — ${o.volumeLiters || 0} L${o.fuzeTier ? ` ${o.fuzeTier}` : ""}${
        flagged ? " · brand rejected" : ""
      }`,
      severity: flagged ? "error" : o.brandApprovalStatus === "PENDING" ? "warn" : "info",
      deepLinkUrl: `/admin/orders/${o.id}`,
    });
  }

  for (const c of consumption) {
    events.push({
      type: "consumption",
      timestamp: (c.usageDate || c.createdAt).toISOString(),
      actor: c.factory?.name || null,
      summary: `Consumed ${c.litersUsed} L${c.fuzeTier ? ` at ${c.fuzeTier}` : ""}`,
      severity: "info",
      deepLinkUrl: null,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    ok: true,
    fabric: {
      id: fabric.id,
      fuzeNumber: fabric.fuzeNumber,
      customerCode: fabric.customerCode,
      factoryCode: fabric.factoryCode,
      construction: fabric.construction,
      color: fabric.color,
      brand: fabric.brand,
      factory: fabric.factory,
    },
    events,
  });
}

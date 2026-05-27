// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pushTestRequestStatus } from "@/lib/notify-realtime";
import { recordTrackingEvent, ensureTrackingToken } from "@/lib/test-tracking";

/**
 * POST /api/test-requests/wizard/submit
 *
 * Phase 52 T5/T7 — customer-facing wizard submission.
 *
 * Body: { formTemplateId, labId, fabricId, brandId?, projectId?,
 *         formResponses: Record<key, value> }
 *
 * Creates:
 *   - One TestRequest with auto-PO, status=PENDING_APPROVAL
 *     (or ASSIGNED_TO_LAB if the lab has no regionalApproverId — admin
 *     fan-out handles approval routing instead)
 *   - TestRequestLine rows synthesized from formResponses keys that
 *     look like test-method picks (key matches /test_method|test_type|
 *     organism|wash_count/) — best-effort, falls back to a single
 *     line if no test-method fields are detected
 *   - Stores the full formResponses payload in TestRequest.raw for
 *     audit + the print-step PDF generator (Track 6) to consume
 *
 * Notifies via existing notifyTestRequestStatus pipeline — regional
 * approver if Lab.regionalApproverId is set (Tina for Asia after T2
 * migration), otherwise all admins. Brand + factory user pools picked
 * up by the existing fan-out helper for customer-facing transitions.
 */

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "BRAND_USER",
  "BRAND_MANAGER",
  "FACTORY_USER",
  "FACTORY_LEAD",
  "FACTORY_MANAGER",
  "DISTRIBUTOR_USER",
]);

function asNumber(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function todayPoStub(): string {
  const d = new Date();
  return `FUZE-PO-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const formTemplateId = String(body?.formTemplateId || "");
  const labId = String(body?.labId || "");
  const fabricId = String(body?.fabricId || "");
  const brandId = body?.brandId ? String(body.brandId) : null;
  const projectId = body?.projectId ? String(body.projectId) : null;
  const formResponses: Record<string, any> = body?.formResponses || {};

  if (!formTemplateId || !labId) {
    return NextResponse.json(
      { ok: false, error: "formTemplateId + labId required" },
      { status: 400 },
    );
  }

  const [tpl, lab, fabric] = await Promise.all([
    prisma.labFormTemplate.findUnique({
      where: { id: formTemplateId },
      select: { id: true, labId: true, name: true, fields: true },
    }),
    prisma.lab.findUnique({
      where: { id: labId },
      select: {
        id: true,
        name: true,
        customerNumber: true,
        regionalApproverId: true,
      } as any,
    }),
    fabricId
      ? prisma.fabric.findUnique({
          where: { id: fabricId },
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            brandId: true,
            factoryId: true,
          },
        })
      : null,
  ]);

  if (!tpl) return NextResponse.json({ ok: false, error: "Form template not found" }, { status: 404 });
  if (!lab) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
  if (tpl.labId !== labId) {
    return NextResponse.json(
      { ok: false, error: "Form template doesn't belong to the selected lab" },
      { status: 400 },
    );
  }

  // Synthesize TestRequestLine rows from form responses.
  const lines: Array<{ testType: string; testMethod: string | null; organisms: string | null; washCount: number | null }> = [];
  const methodKeys = Object.keys(formResponses).filter((k) =>
    /test_?method|test_?type/i.test(k),
  );
  const organisms = Object.entries(formResponses)
    .filter(([k]) => /organism/i.test(k))
    .map(([, v]) => (Array.isArray(v) ? v.join(", ") : String(v || "")))
    .filter(Boolean)
    .join(", ");
  const washCount = (() => {
    for (const [k, v] of Object.entries(formResponses)) {
      if (/wash_?count|wash_?cycles/i.test(k)) return asNumber(v);
    }
    return undefined;
  })();

  if (methodKeys.length > 0) {
    for (const k of methodKeys) {
      const v = formResponses[k];
      const items: string[] = Array.isArray(v) ? v : [String(v || "")].filter(Boolean);
      for (const item of items) {
        const upper = item.toUpperCase();
        let testType = "OTHER";
        if (upper.includes("ICP")) testType = "ICP";
        else if (upper.includes("AATCC") || upper.includes("ASTM E2149") || upper.includes("ISO 20743") || upper.includes("JIS L 1902")) testType = "ANTIBACTERIAL";
        else if (upper.includes("AATCC 30") || upper.includes("FUNGAL")) testType = "FUNGAL";
        else if (upper.includes("ISO 18184") || upper.includes("VIRAL")) testType = "ANTIVIRAL";
        else if (upper.includes("ODOR") || upper.includes("MORAXELLA")) testType = "ODOR";
        else if (upper.includes("UV")) testType = "UV";
        else if (upper.includes("MICROFIBER")) testType = "MICROFIBER";

        lines.push({
          testType,
          testMethod: item || null,
          organisms: organisms || null,
          washCount: washCount ?? null,
        });
      }
    }
  } else {
    // Fallback — one generic line so the request still has something
    // to dispatch to the lab.
    lines.push({
      testType: "OTHER",
      testMethod: null,
      organisms: organisms || null,
      washCount: washCount ?? null,
    });
  }

  // Status routing — if the lab has a regional approver, queue for
  // approval; otherwise the request goes straight to the lab.
  const hasRegional = !!(lab as any).regionalApproverId;
  const initialStatus = hasRegional ? "PENDING_APPROVAL" : "ASSIGNED_TO_LAB";

  const poNumber = todayPoStub();

  const tr = await prisma.testRequest.create({
    data: {
      poNumber,
      brandId: brandId || fabric?.brandId || null,
      fabricId: fabric?.id || null,
      projectId,
      labId,
      labCustomerNumber: (lab as any).customerNumber || null,
      fuzeFabricNumber: fabric?.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : null,
      customerFabricCode: fabric?.customerCode || null,
      factoryFabricCode: fabric?.factoryCode || null,
      status: initialStatus,
      requestedById: user.id,
      requestedAt: new Date(),
      raw: {
        wizard: true,
        formTemplateId,
        formTemplateName: tpl.name,
        formResponses,
      } as any,
      lines: {
        create: lines.map((l) => ({
          testType: l.testType,
          testMethod: l.testMethod,
          organisms: l.organisms,
          washCount: l.washCount,
        })),
      },
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
      brandId: true,
      labId: true,
    },
  });

  // Tracking + notification fan-out
  void ensureTrackingToken(tr.id);
  void recordTrackingEvent({
    testRequestId: tr.id,
    state: "REQUEST_SUBMITTED",
    occurredById: user.id,
    metadata: { source: "wizard", formTemplateId },
  });

  void pushTestRequestStatus({
    testRequestId: tr.id,
    status: initialStatus,
    createdByUserId: user.id,
    poNumber: tr.poNumber,
    brandId: tr.brandId,
    factoryId: fabric?.factoryId || null,
    labId: tr.labId,
  });

  return NextResponse.json({
    ok: true,
    testRequest: {
      id: tr.id,
      poNumber: tr.poNumber,
      status: tr.status,
    },
    routing: hasRegional ? "regional-approver" : "direct-to-lab",
  });
}

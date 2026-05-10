// @ts-nocheck
/**
 * /api/lab-portal/lab-tests — Phase 10B per-lab test catalog.
 *
 * GET  → returns LabTest rows for the caller's lab. Admin / employee
 *         see fuzeCostUsd; LAB_USER sees only publishedPriceUsd unless
 *         they are also internal (cost is FUZE-side info).
 * POST  → create a new catalog row.
 *         publishedPriceUsd / slaDays / notes editable by the lab.
 *         fuzeCostUsd editable only by ADMIN / EMPLOYEE / SALES_MANAGER.
 * PATCH → update an existing row by id.
 * DELETE→ soft-delete by setting active=false.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const FUZE_COST_EDITORS = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];
const FULL_ROLES = [...FUZE_COST_EDITORS];
const LAB_ROLES = ["LAB_USER", "LAB_MANAGER"];

function canEditFuzeCost(role: string): boolean {
  return FUZE_COST_EDITORS.includes(role);
}

function scopeLab(req: Request, user: any): { labId: string | null; isInternal: boolean } {
  const url = new URL(req.url);
  const param = url.searchParams.get("labId");
  const isInternal = FULL_ROLES.includes(user.role);
  if (isInternal) return { labId: param || null, isInternal: true };
  if (LAB_ROLES.includes(user.role) && user.labId) {
    return { labId: user.labId, isInternal: false };
  }
  return { labId: null, isInternal: false };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { labId, isInternal } = scopeLab(req, user);
  if (!labId && !isInternal) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const where: any = { active: true };
  if (labId) where.labId = labId;
  const rows = await prisma.labTest.findMany({
    where,
    orderBy: [{ testType: "asc" }, { protocolName: "asc" }],
    include: {
      lab: { select: { id: true, name: true, isFuzeOwned: true } },
    },
  });
  // Strip fuzeCostUsd from response for non-internal viewers.
  const safe = rows.map((r) =>
    isInternal
      ? r
      : {
          ...r,
          fuzeCostUsd: null,
        },
  );
  return NextResponse.json({ ok: true, rows: safe, canEditFuzeCost: canEditFuzeCost(user.role) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });

  const internalScope = FULL_ROLES.includes(user.role);
  let labId: string;
  if (internalScope && body.labId) {
    labId = body.labId;
  } else if (LAB_ROLES.includes(user.role) && user.labId) {
    labId = user.labId;
  } else {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (!body.testType || !body.protocolName) {
    return NextResponse.json(
      { ok: false, error: "testType and protocolName required" },
      { status: 400 },
    );
  }

  const data: any = {
    labId,
    testType: String(body.testType),
    protocolName: String(body.protocolName),
    publishedPriceUsd: body.publishedPriceUsd != null ? Number(body.publishedPriceUsd) : null,
    slaDays: body.slaDays != null ? Number(body.slaDays) : null,
    notes: body.notes || null,
    protocolJson: body.protocolJson || null,
  };
  if (canEditFuzeCost(user.role) && body.fuzeCostUsd !== undefined) {
    data.fuzeCostUsd = body.fuzeCostUsd != null ? Number(body.fuzeCostUsd) : null;
  }

  const row = await prisma.labTest.upsert({
    where: {
      labId_testType_protocolName: {
        labId,
        testType: data.testType,
        protocolName: data.protocolName,
      },
    },
    create: data,
    update: { ...data, active: true },
  });
  return NextResponse.json({ ok: true, row });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.labTest.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  // Lab user can only modify their own lab's rows; internal can modify any.
  if (
    !FULL_ROLES.includes(user.role) &&
    !(LAB_ROLES.includes(user.role) && user.labId === existing.labId)
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const updates: any = {};
  if (body.publishedPriceUsd !== undefined)
    updates.publishedPriceUsd = body.publishedPriceUsd != null ? Number(body.publishedPriceUsd) : null;
  if (body.slaDays !== undefined)
    updates.slaDays = body.slaDays != null ? Number(body.slaDays) : null;
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.protocolJson !== undefined) updates.protocolJson = body.protocolJson;
  if (body.active !== undefined) updates.active = !!body.active;
  if (canEditFuzeCost(user.role) && body.fuzeCostUsd !== undefined) {
    updates.fuzeCostUsd = body.fuzeCostUsd != null ? Number(body.fuzeCostUsd) : null;
  }
  const row = await prisma.labTest.update({ where: { id: body.id }, data: updates });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.labTest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (
    !FULL_ROLES.includes(user.role) &&
    !(LAB_ROLES.includes(user.role) && user.labId === existing.labId)
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  await prisma.labTest.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}

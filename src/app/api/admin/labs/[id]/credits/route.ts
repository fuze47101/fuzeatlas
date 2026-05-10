// @ts-nocheck
/**
 * /api/admin/labs/[id]/credits — Phase 10F.
 *
 * GET   → list every LabCredit row for the given lab; compute
 *          balance = sum(amountUsd) for unspent credits +
 *          sum(amountUsd) for spent credits (negative).
 * POST   → add a credit. Body: { amountUsd, sourceType, sourceNote }
 * PATCH  → spend a credit against a TestRun. Body: { id, testRunId,
 *          spentNote }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

async function authorizeAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  if (!ADMIN_ROLES.includes(user.role)) return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdmin();
  if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const lab = await prisma.lab.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!lab) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
  const credits = await prisma.labCredit.findMany({
    where: { labId: id },
    orderBy: { createdAt: "desc" },
  });
  const balance = credits.reduce(
    (acc, c) => (c.spentAt ? acc : acc + (c.amountUsd || 0)),
    0,
  );
  return NextResponse.json({ ok: true, lab, credits, balance });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdmin();
  if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.amountUsd || !body?.sourceType) {
    return NextResponse.json(
      { ok: false, error: "amountUsd and sourceType required" },
      { status: 400 },
    );
  }
  const credit = await prisma.labCredit.create({
    data: {
      labId: id,
      amountUsd: Number(body.amountUsd),
      sourceType: String(body.sourceType),
      sourceNote: body.sourceNote || null,
    },
  });
  return NextResponse.json({ ok: true, credit });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdmin();
  if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.testRunId) {
    return NextResponse.json(
      { ok: false, error: "id and testRunId required" },
      { status: 400 },
    );
  }
  const credit = await prisma.labCredit.update({
    where: { id: body.id },
    data: {
      spentOnTestRunId: body.testRunId,
      spentAt: new Date(),
      spentNote: body.spentNote || null,
    },
  });
  return NextResponse.json({ ok: true, credit });
}

// @ts-nocheck
/**
 * POST   /api/admin/weekly-review/:id/share  → grant view access to another user
 * DELETE /api/admin/weekly-review/:id/share  → revoke a share (?userId=...)
 *
 * Per the patterned BD claim model, we keep shares in their own table
 * so we can audit exactly who saw which week and when.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gateReport, canShareReport } from "@/lib/weekly-review/access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  if (!canShareReport(user, gate.report)) {
    return NextResponse.json({ ok: false, error: "Only the owner can share" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body.userId || "").trim();
  const scope = body.scope === "KPI" ? "KPI" : "FULL";
  if (!targetUserId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

  const share = await prisma.weeklyExecReportShare.upsert({
    where: { reportId_userId: { reportId: id, userId: targetUserId } },
    create: { reportId: id, userId: targetUserId, grantedById: user.id, scope },
    update: { scope, grantedById: user.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  return NextResponse.json({ ok: true, share });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  if (!canShareReport(user, gate.report)) {
    return NextResponse.json({ ok: false, error: "Only the owner can share" }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

  await prisma.weeklyExecReportShare.delete({
    where: { reportId_userId: { reportId: id, userId } },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

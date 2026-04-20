// @ts-nocheck
/**
 * GET   /api/admin/weekly-review/:id → full report
 * PATCH /api/admin/weekly-review/:id → update execNote, status, or refresh snapshot
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gateReport } from "@/lib/weekly-review/access";
import { buildSnapshot } from "@/lib/weekly-review/snapshot";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  // Attach the linked notes (with brand context) and visible shares.
  const [notes, shares] = await Promise.all([
    prisma.note.findMany({
      where: { weeklyReportId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, content: true, createdAt: true, noteType: true,
        brand: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.weeklyExecReportShare.findMany({
      where: { reportId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { grantedAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    report: gate.report,
    notes,
    shares,
    via: gate.via,
  });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  // Only owner or admin can mutate — shared recipients are read-only for MVP.
  if (user.role !== "ADMIN" && gate.report.ownedById !== user.id) {
    return NextResponse.json({ ok: false, error: "Only the owner can edit" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: any = {};
  if (typeof body.execNote === "string") patch.execNote = body.execNote;
  if (typeof body.status === "string") patch.status = body.status;
  if (body.refresh) {
    const snapshot = await buildSnapshot(gate.report.weekOf, gate.report.lookbackDays);
    patch.snapshot = snapshot;
    patch.generatedAt = new Date();
  }

  const updated = await prisma.weeklyExecReport.update({
    where: { id },
    data: patch,
  });
  return NextResponse.json({ ok: true, report: { id: updated.id, weekOf: updated.weekOf, status: updated.status } });
}

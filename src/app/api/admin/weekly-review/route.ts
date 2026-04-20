// @ts-nocheck
/**
 * GET  /api/admin/weekly-review          → list reports visible to caller
 * POST /api/admin/weekly-review          → create/refresh a report for a given Monday
 *
 * Creation is idempotent by weekOf — if a report exists for that Monday
 * we regenerate its snapshot in place. This is what "Refresh" hits.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildSnapshot, mondayOf } from "@/lib/weekly-review/snapshot";
import { canCreateReport } from "@/lib/weekly-review/access";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  // A report is visible if: admin, owner, or caller is in share table.
  const where: any = user.role === "ADMIN"
    ? {}
    : { OR: [{ ownedById: user.id }, { shares: { some: { userId: user.id } } }] };

  const reports = await prisma.weeklyExecReport.findMany({
    where,
    orderBy: { weekOf: "desc" },
    take: 24,
    select: {
      id: true, weekOf: true, lookbackDays: true, status: true,
      generatedAt: true, updatedAt: true,
      ownedBy: { select: { id: true, name: true } },
      _count: { select: { shares: true, notes: true } },
    },
  });

  return NextResponse.json({ ok: true, reports });
}

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (!canCreateReport(user)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // Accept ISO date or defaults to this week's Monday.
  const anchor = body.weekOf ? new Date(body.weekOf) : new Date();
  const weekOf = mondayOf(anchor);
  const lookbackDays = Math.max(1, Math.min(28, body.lookbackDays ?? 7));

  const snapshot = await buildSnapshot(weekOf, lookbackDays);

  const existing = await prisma.weeklyExecReport.findUnique({ where: { weekOf } });
  const report = existing
    ? await prisma.weeklyExecReport.update({
        where: { id: existing.id },
        data: {
          snapshot,
          lookbackDays,
          generatedAt: new Date(),
        },
      })
    : await prisma.weeklyExecReport.create({
        data: {
          weekOf,
          lookbackDays,
          snapshot,
          ownedById: user.id,
          status: "DRAFT",
        },
      });

  return NextResponse.json({ ok: true, report: { id: report.id, weekOf: report.weekOf } });
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * BD Portal #36 Phase 6 — handoff triage queue.
 *
 *   GET  /api/admin/bd-portal/handoffs
 *        → list every brand with handoffPending=true (admins only)
 *
 *   POST /api/admin/bd-portal/handoffs
 *        body: { brandId: string, action: "clear" }
 *        → flip handoffPending back to false once the brand has been
 *          reassigned / handed off and the triage is complete.
 */

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const brands = await prisma.brand.findMany({
    where: { handoffPending: true },
    select: {
      id: true,
      name: true,
      pipelineStage: true,
      lastActivityAt: true,
      updatedAt: true,
      salesRep: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    total: brands.length,
    brands: brands.map((b: any) => ({
      id: b.id,
      name: b.name,
      stage: b.pipelineStage,
      currentRep: b.salesRep?.name || null,
      currentRepEmail: b.salesRep?.email || null,
      lastActivityAt: b.lastActivityAt ? b.lastActivityAt.toISOString() : null,
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { brandId, action } = body as { brandId?: string; action?: string };

  if (!brandId || action !== "clear") {
    return NextResponse.json(
      { ok: false, error: "brandId + action:'clear' required" },
      { status: 400 },
    );
  }

  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: { handoffPending: false },
    select: { id: true, name: true, handoffPending: true },
  });

  // System note so the history is auditable
  await prisma.note
    .create({
      data: {
        brandId,
        noteType: "SYSTEM",
        content: `🤝 Handoff marked complete by ${user.name || user.email}.`,
        date: new Date(),
        userId: user.id,
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, brand });
}

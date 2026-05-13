// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/audit-log
 *
 * NEED-4 — admin-side full audit log with filters.
 *   ?action=     filter by action verb
 *   ?entity=     filter by entity type
 *   ?userId=     filter by actor
 *   ?since=      ISO date — newer than
 *   ?take=       default 200, max 1000
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const where: any = {};
  const action = url.searchParams.get("action");
  const entity = url.searchParams.get("entity");
  const userId = url.searchParams.get("userId");
  const since = url.searchParams.get("since");
  const takeRaw = parseInt(url.searchParams.get("take") || "200", 10);
  const take = Math.min(1000, Math.max(1, Number.isFinite(takeRaw) ? takeRaw : 200));

  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) where.createdAt = { gte: d };
  }

  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  // Compact summary: distinct entities + actions so the filter UI
  // can populate dropdowns without a second round-trip.
  const distinctEntities = Array.from(new Set(rows.map((r) => r.entity))).sort();
  const distinctActions = Array.from(new Set(rows.map((r) => r.action))).sort();

  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      description: r.description,
      changes: r.changes,
      createdAt: r.createdAt.toISOString(),
      actor: r.user
        ? { id: r.user.id, name: r.user.name, email: r.user.email }
        : null,
    })),
    distinctEntities,
    distinctActions,
  });
}

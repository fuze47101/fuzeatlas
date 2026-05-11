// @ts-nocheck
/**
 * POST /api/brand-portal/request-role — Phase 15 IMP-2.
 *
 * Body: { scope: "brand"|"factory"|"distributor"|"lab",
 *         scopeId, requestedRole, reason? }
 *
 * Creates a RoleEscalationRequest row + fans a Notification to the
 * brand's primary EntityManager + every admin. Dedupes per
 * (requester, scope, scopeId, requestedRole, status=PENDING) so a
 * frustrated user can't spam.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.scope || !body?.scopeId || !body?.requestedRole) {
    return NextResponse.json(
      { ok: false, error: "scope, scopeId, requestedRole required" },
      { status: 400 },
    );
  }
  const scope = String(body.scope);
  const scopeId = String(body.scopeId);
  const requestedRole = String(body.requestedRole);
  const reason = body.reason ? String(body.reason).slice(0, 600) : null;

  // Dedupe pending.
  const existing = await prisma.roleEscalationRequest.findFirst({
    where: {
      requestedByUserId: user.id,
      scope,
      scopeId,
      requestedRole,
      status: "PENDING",
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, request: existing, deduped: true });
  }

  const row = await prisma.roleEscalationRequest.create({
    data: {
      requestedByUserId: user.id,
      scope,
      scopeId,
      requestedRole,
      reason,
    },
  });

  // Recipients: admins + primary EntityManager on the target scope
  // (only meaningful for brand/factory/distributor; LAB has no
  // EntityManager today — falls back to admins only).
  const adminIds = (
    await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  let entityManagerIds: string[] = [];
  try {
    const entityType =
      scope === "brand"
        ? "BRAND"
        : scope === "factory"
          ? "FACTORY"
          : scope === "distributor"
            ? "DISTRIBUTOR"
            : null;
    if (entityType) {
      const ems = await prisma.entityManager.findMany({
        where: { entityType, entityId: scopeId },
        select: { userId: true, isPrimary: true },
      });
      entityManagerIds = ems
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((e) => e.userId);
    }
  } catch {
    // EntityManager scope mismatch — proceed with admins only.
  }

  const recipientIds = Array.from(new Set([...adminIds, ...entityManagerIds]));
  const requesterLabel = user.name || user.email || "A user";
  const title = `🔑 ${requesterLabel} requested ${requestedRole} access`;
  const message = reason
    ? `Scope: ${scope}. Reason: "${reason.slice(0, 240)}"`
    : `Scope: ${scope}. No reason provided.`;
  await Promise.all(
    recipientIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: "ACCESS_REQUEST",
          title,
          message,
          link: "/settings/access-requests",
          metadata: {
            source: "request-role",
            requestId: row.id,
            scope,
            scopeId,
            requestedRole,
          },
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, request: row });
}

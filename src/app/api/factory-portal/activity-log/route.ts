// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listPortalActivity } from "@/lib/audit";

/**
 * GET /api/factory-portal/activity-log
 *
 * NEED-4 — audit trail scoped to the caller's factory. Includes
 * SupplyChainLink rows for this factory so brand→factory linkage
 * changes show up here too.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const links = await prisma.supplyChainLink.findMany({
    where: {
      OR: [
        { fromType: "FACTORY", fromId: user.factoryId },
        { toType: "FACTORY", toId: user.factoryId },
      ],
    },
    select: { id: true },
  });

  const rows = await listPortalActivity({
    entity: "Factory",
    entityId: user.factoryId,
    alsoEntities: links.map((l) => ({ entity: "SupplyChainLink", entityId: l.id })),
    take: 200,
  });
  return NextResponse.json({ ok: true, rows });
}

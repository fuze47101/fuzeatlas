// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { listPortalActivity } from "@/lib/audit";

/**
 * GET /api/lab-portal/activity-log
 *
 * NEED-4 — audit trail scoped to caller's lab. Includes the lab's
 * LabService rows so pricing changes surface here.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.labId)
    return NextResponse.json({ ok: false, error: "Not a lab user" }, { status: 403 });

  const services = await prisma.labService.findMany({
    where: { labId: user.labId },
    select: { id: true },
  });

  const rows = await listPortalActivity({
    entity: "Lab",
    entityId: user.labId,
    alsoEntities: services.map((s) => ({ entity: "LabService", entityId: s.id })),
    take: 200,
  });
  return NextResponse.json({ ok: true, rows });
}

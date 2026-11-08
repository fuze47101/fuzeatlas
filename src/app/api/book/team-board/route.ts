import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, getBook, mondayOf, visibleBookOwners } from "@/lib/book";

/** GET /api/book/team-board → this week's status per person, super updates, help queue. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owners = await visibleBookOwners(user);
  if (!MANAGER_ROLES.includes(user.role) && owners.length <= 1)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const weeks = Math.min(8, Math.max(1, Number(new URL(req.url).searchParams.get("weeks") || 1)));
  const since = mondayOf(new Date());
  since.setUTCDate(since.getUTCDate() - 7 * (weeks - 1));
  const ownerIds = owners.map((o) => o.id);

  const people = await Promise.all(
    owners.map(async (o) => {
      const book = await getBook(o.id);
      return {
        user: { id: o.id, name: o.name, role: o.role, distributorId: o.distributorId },
        total: book.length,
        touched: book.filter((a) => a.checkedInThisWeek).length,
        cold: book.filter((a) => a.attention === "red").length,
        amber: book.filter((a) => a.attention === "amber").length,
        openHelp: book.reduce((s, a) => s + a.openHelp, 0),
      };
    }),
  );

  const [supers, helpOpen, changes] = await Promise.all([
    prisma.accountCheckin.findMany({
      where: { kind: "SUPER", createdAt: { gte: since }, userId: { in: ownerIds } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.helpRequest.findMany({
      where: {
        status: { in: ["OPEN", "ACKED", "ESCALATED"] },
        OR: [{ requesterId: { in: ownerIds } }, { assigneeId: { in: ownerIds } }],
      },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }],
      include: { requester: { select: { name: true } }, assignee: { select: { name: true } } },
    }),
    prisma.accountCheckin.findMany({
      where: {
        createdAt: { gte: since },
        userId: { in: ownerIds },
        OR: [
          { stageAfter: { not: null } },
          { forecastAfter: { not: null } },
          { orderKg: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Resolve names for every entity referenced.
  const keys = new Map<string, { entityType: string; entityId: string }>();
  for (const x of [...supers, ...helpOpen, ...changes])
    keys.set(`${x.entityType}:${x.entityId}`, { entityType: x.entityType, entityId: x.entityId });
  const bIds = [...keys.values()].filter((k) => k.entityType === "BRAND").map((k) => k.entityId);
  const fIds = [...keys.values()].filter((k) => k.entityType === "FACTORY").map((k) => k.entityId);
  const [bn, fn] = await Promise.all([
    bIds.length
      ? prisma.brand.findMany({ where: { id: { in: bIds } }, select: { id: true, name: true } })
      : [],
    fIds.length
      ? prisma.factory.findMany({ where: { id: { in: fIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const names: Record<string, string> = {};
  for (const x of bn) names[`BRAND:${x.id}`] = x.name;
  for (const x of fn) names[`FACTORY:${x.id}`] = x.name;
  const nm = (x: any) => ({
    ...x,
    entityName: names[`${x.entityType}:${x.entityId}`] || x.entityId,
  });

  return NextResponse.json({
    weekOf: mondayOf(new Date()),
    people,
    supers: supers.map(nm),
    help: helpOpen.map(nm),
    changes: changes.map(nm),
  });
}

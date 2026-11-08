import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, canReadBook, type EntityType } from "@/lib/book";

/** GET /api/book/assign?q=welspun → search brands + factories to add to a book. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const [brands, factories, dists] = await Promise.all([
    prisma.brand.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, pipelineStage: true },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.factory.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, country: true },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.distributor.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, country: true },
      take: 5,
    }),
  ]);
  return NextResponse.json({
    results: [
      ...brands.map((b) => ({
        entityType: "BRAND",
        entityId: b.id,
        name: b.name,
        meta: b.pipelineStage,
      })),
      ...factories.map((f) => ({
        entityType: "FACTORY",
        entityId: f.id,
        name: f.name,
        meta: f.country,
      })),
      ...dists.map((d) => ({
        entityType: "DISTRIBUTOR",
        entityId: d.id,
        name: d.name,
        meta: d.country,
      })),
    ],
  });
}

/**
 * POST /api/book/assign { userId, entityType, entityId, remove?: boolean, isPrimary?: boolean }
 * Managers assign anyone; a distributor lead assigns within their distributor;
 * anyone may add to their own book.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const userId = String(body?.userId || user.id);
  const entityType = body?.entityType as EntityType;
  const entityId = String(body?.entityId || "");
  if (!["BRAND", "FACTORY", "DISTRIBUTOR"].includes(entityType) || !entityId)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (userId !== user.id && !(await canReadBook(user, userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role =
    entityType === "BRAND"
      ? "ACCOUNT_MANAGER"
      : entityType === "FACTORY"
        ? "FACTORY_LEAD"
        : "DISTRIBUTOR_LEAD";
  if (body.remove) {
    await prisma.entityManager.deleteMany({ where: { entityType, entityId, userId, role } });
    // Also clear the legacy claim so the account actually leaves the book.
    if (entityType === "BRAND")
      await prisma.brand.updateMany({
        where: { id: entityId, salesRepId: userId },
        data: { salesRepId: null },
      });
    if (entityType === "FACTORY")
      await prisma.factory.updateMany({
        where: { id: entityId, salesRepId: userId },
        data: { salesRepId: null },
      });
    return NextResponse.json({ ok: true, removed: true });
  }
  const isPrimary = body.isPrimary !== false;
  const row = await prisma.entityManager.upsert({
    where: { entityType_entityId_userId_role: { entityType, entityId, userId, role } },
    create: { entityType, entityId, userId, role, isPrimary },
    update: { isPrimary },
  });
  if (!MANAGER_ROLES.includes(user.role) || userId === user.id) {
    // keep the legacy salesRep in step when the account had none
    if (entityType === "BRAND")
      await prisma.brand.updateMany({
        where: { id: entityId, salesRepId: null },
        data: { salesRepId: userId },
      });
    if (entityType === "FACTORY")
      await prisma.factory.updateMany({
        where: { id: entityId, salesRepId: null },
        data: { salesRepId: userId },
      });
  }
  return NextResponse.json({ ok: true, assignment: row });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, canReadBook, ownedEntityKeys, type EntityType } from "@/lib/book";

/**
 * Distributor users are fenced: they may only see and join accounts that
 * nobody outside their own distributor is working. Returns the people on the
 * account who are NOT in `distributorId`.
 */
async function outsiders(entityType: EntityType, entityId: string, distributorId: string) {
  const rows = await prisma.entityManager.findMany({
    where: { entityType, entityId },
    select: { user: { select: { id: true, distributorId: true } } },
  });
  const ids = new Set(
    rows.filter((r) => r.user.distributorId !== distributorId).map((r) => r.user.id),
  );
  const legacy =
    entityType === "BRAND"
      ? await prisma.brand.findUnique({
          where: { id: entityId },
          select: { salesRep: { select: { id: true, distributorId: true } } },
        })
      : entityType === "FACTORY"
        ? await prisma.factory.findUnique({
            where: { id: entityId },
            select: { salesRep: { select: { id: true, distributorId: true } } },
          })
        : null;
  if (legacy?.salesRep && legacy.salesRep.distributorId !== distributorId)
    ids.add(legacy.salesRep.id);
  return ids.size;
}

/** GET /api/book/assign?q=welspun → search brands + factories to add to a book. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Distributor users search only their own patch: mills on their distributor's
  // roster and accounts a colleague from the same distributor already works.
  if (user.distributorId) {
    const did = user.distributorId;
    const mates = await prisma.entityManager.findMany({
      where: { user: { distributorId: did }, entityType: { in: ["BRAND", "FACTORY"] } },
      select: { entityType: true, entityId: true },
    });
    const brandIds = [
      ...new Set(mates.filter((m) => m.entityType === "BRAND").map((m) => m.entityId)),
    ];
    const factoryIds = [
      ...new Set(mates.filter((m) => m.entityType === "FACTORY").map((m) => m.entityId)),
    ];
    const [fb, ff] = await Promise.all([
      prisma.brand.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          OR: [{ id: { in: brandIds } }, { salesRep: { distributorId: did } }],
        },
        select: { id: true, name: true, pipelineStage: true },
        take: 10,
        orderBy: { name: "asc" },
      }),
      prisma.factory.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          OR: [
            { id: { in: factoryIds } },
            { distributorId: did },
            { distributorRoster: { some: { distributorId: did } } },
            { salesRep: { distributorId: did } },
          ],
        },
        select: { id: true, name: true, country: true },
        take: 15,
        orderBy: { name: "asc" },
      }),
    ]);
    const out: any[] = [];
    for (const x of fb)
      if (!(await outsiders("BRAND", x.id, did)))
        out.push({ entityType: "BRAND", entityId: x.id, name: x.name, meta: x.pipelineStage });
    for (const x of ff)
      if (!(await outsiders("FACTORY", x.id, did)))
        out.push({ entityType: "FACTORY", entityId: x.id, name: x.name, meta: x.country });
    return NextResponse.json({ results: out });
  }
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
 * POST /api/book/assign
 *   { entityType, entityId, userId?, support?, remove? }
 *   { create: { type: "BRAND" | "FACTORY", name, country? }, userId?, support? }
 *
 * - Anyone may add an account to their own book (claim it) or leave it.
 * - Anyone already on an account may add or remove a teammate on it.
 * - Managers assign anyone; a distributor lead assigns within their distributor.
 * - support: true  → on the account, not asked on Fridays.
 *   support: false → co-owner: the account is in their Friday check-in.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  const userId = String(body.userId || user.id);
  let entityType = body.entityType as EntityType;
  let entityId = String(body.entityId || "");
  const isManager = MANAGER_ROLES.includes(user.role);

  // Quick-create an account that is not in Atlas yet.
  if (body.create && userId !== user.id && !isManager && !(await canReadBook(user, userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (body.create) {
    const name = String(body.create.name || "").trim();
    const type = body.create.type === "FACTORY" ? "FACTORY" : "BRAND";
    const country = String(body.create.country || "").trim() || null;
    if (name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (type === "BRAND") {
      const hit = await prisma.brand.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      entityId =
        hit?.id ||
        (
          await prisma.brand.create({
            data: {
              name,
              pipelineStage: "LEAD",
              salesRepId: userId,
              researchData: country ? { hubspotLocation: country } : undefined,
              backgroundInfo: `Added from My Book by ${user.name}.`,
            },
            select: { id: true },
          })
        ).id;
    } else {
      const hit = await prisma.factory.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      entityId =
        hit?.id ||
        (
          await prisma.factory.create({
            data: { name, country, pipelineStage: "LEAD", salesRepId: userId },
            select: { id: true },
          })
        ).id;
    }
    entityType = type;
  }

  if (!["BRAND", "FACTORY", "DISTRIBUTOR"].includes(entityType) || !entityId)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Distributor users cannot join (or be added to) an account FUZE or another
  // distributor is already working — that goes through a FUZE manager.
  if (!isManager && user.distributorId) {
    if (entityType === "DISTRIBUTOR" && entityId !== user.distributorId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (
      entityType !== "DISTRIBUTOR" &&
      !body.remove &&
      (await outsiders(entityType, entityId, user.distributorId))
    )
      return NextResponse.json(
        {
          error:
            "This account is already managed in Atlas. Ask your FUZE contact to add you to it.",
        },
        { status: 409 },
      );
  }

  // Permission to change someone else's assignment.
  if (userId !== user.id && !isManager && !(await canReadBook(user, userId))) {
    const mine = await ownedEntityKeys(user.id, { includeSupport: true });
    const onAccount = mine.some((k) => k.entityType === entityType && k.entityId === entityId);
    if (!onAccount)
      return NextResponse.json(
        { error: "Only people on this account can add a teammate" },
        { status: 403 },
      );
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, distributorId: true },
    });
    if (!target || target.status !== "ACTIVE")
      return NextResponse.json({ error: "That teammate is not active" }, { status: 400 });
    if (user.distributorId && target.distributorId !== user.distributorId)
      return NextResponse.json(
        { error: "You can only add people from your own team" },
        { status: 403 },
      );
  }

  // Support people cannot remove or demote an owner; owners and managers can.
  if (userId !== user.id && !isManager && (body.remove || body.support === true)) {
    const targetIsOwner = (await ownedEntityKeys(userId)).some(
      (k) => k.entityType === entityType && k.entityId === entityId,
    );
    const actorIsOwner = (await ownedEntityKeys(user.id)).some(
      (k) => k.entityType === entityType && k.entityId === entityId,
    );
    if (targetIsOwner && !actorIsOwner)
      return NextResponse.json(
        { error: "Only an owner of this account can change another owner" },
        { status: 403 },
      );
  }

  if (body.remove) {
    await prisma.entityManager.deleteMany({ where: { entityType, entityId, userId } });
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
    return NextResponse.json({ ok: true, removed: true, entityType, entityId });
  }

  const support = body.support === true || body.isPrimary === false;
  const role = support
    ? "SUPPORT"
    : entityType === "BRAND"
      ? "ACCOUNT_MANAGER"
      : entityType === "FACTORY"
        ? "FACTORY_LEAD"
        : "DISTRIBUTOR_LEAD";
  // One row per person per account: replace whatever they held before.
  await prisma.entityManager.deleteMany({ where: { entityType, entityId, userId } });
  const row = await prisma.entityManager.create({
    data: {
      entityType,
      entityId,
      userId,
      role,
      isPrimary: !support,
      notes: userId === user.id ? "Claimed from My Book" : `Added by ${user.name}`,
    },
  });
  if (support) {
    // a support person must not also hold the legacy primary claim
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
  } else {
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
  return NextResponse.json({ ok: true, assignment: row, entityType, entityId });
}

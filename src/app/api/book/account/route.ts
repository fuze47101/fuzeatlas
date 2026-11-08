import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, ownedEntityKeys, type EntityType } from "@/lib/book";

/** GET /api/book/account?type=BRAND&id=... → the card: history, contacts, open help. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const entityType = url.searchParams.get("type") as EntityType;
  const entityId = url.searchParams.get("id") || "";
  if (!["BRAND", "FACTORY", "DISTRIBUTOR"].includes(entityType) || !entityId)
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  if (!MANAGER_ROLES.includes(user.role)) {
    const mine = await ownedEntityKeys(user.id);
    if (!mine.some((k) => k.entityType === entityType && k.entityId === entityId))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [checkins, help, contacts, notes, owners] = await Promise.all([
    prisma.accountCheckin.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        user: { select: { id: true, name: true } },
        helpRequest: { select: { id: true, status: true, assignee: { select: { name: true } } } },
      },
    }),
    prisma.helpRequest.findMany({
      where: { entityType, entityId, status: { in: ["OPEN", "ACKED", "ESCALATED"] } },
      include: { requester: { select: { name: true } }, assignee: { select: { name: true } } },
    }),
    entityType === "BRAND"
      ? prisma.contact.findMany({
          where: { brandId: entityId },
          select: {
            id: true,
            name: true,
            title: true,
            email: true,
            phone: true,
            isPrimary: true,
            lastContactedAt: true,
          },
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          take: 12,
        })
      : entityType === "FACTORY"
        ? prisma.contact.findMany({
            where: { factoryId: entityId },
            select: {
              id: true,
              name: true,
              title: true,
              email: true,
              phone: true,
              isPrimary: true,
              lastContactedAt: true,
            },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
            take: 12,
          })
        : [],
    entityType === "BRAND"
      ? prisma.note.findMany({
          where: { brandId: entityId, noteType: { not: "CHECKIN" } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            content: true,
            noteType: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        })
      : entityType === "FACTORY"
        ? prisma.note.findMany({
            where: { factoryId: entityId, noteType: { not: "CHECKIN" } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              content: true,
              noteType: true,
              createdAt: true,
              user: { select: { name: true } },
            },
          })
        : [],
    prisma.entityManager.findMany({
      where: { entityType, entityId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  let entity: any = null;
  if (entityType === "BRAND")
    entity = await prisma.brand.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        forecastQuarter: true,
        galaLead: true,
        website: true,
        lastActivityAt: true,
      },
    });
  else if (entityType === "FACTORY")
    entity = await prisma.factory.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        pipelineStage: true,
        forecastQuarter: true,
        galaLead: true,
        lastActivityAt: true,
      },
    });
  else
    entity = await prisma.distributor.findUnique({
      where: { id: entityId },
      select: { id: true, name: true, country: true },
    });

  return NextResponse.json({
    entity,
    checkins,
    help,
    contacts,
    notes,
    owners: owners.map((o) => ({
      id: o.user.id,
      name: o.user.name,
      role: o.role,
      isPrimary: o.isPrimary,
    })),
  });
}

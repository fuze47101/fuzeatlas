import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  HANDOVER_KIND,
  MANAGER_ROLES,
  mondayOf,
  ownedEntityKeys,
  type EntityType,
} from "@/lib/book";
import { notifyHandover } from "@/lib/book-notify";

/**
 * POST /api/book/handover
 *   { items: [{ entityType, entityId }], toUserId, note?, keepSupport?, fromUserId? }
 *
 * Moves accounts out of one book into another, with a note the new owner
 * sees in the account history and in their email.
 *   - You can hand over accounts you own. Managers can move anyone's.
 *   - keepSupport leaves the previous owner on the account as support.
 *   - The handover is history, not a touch: the new owner is asked on Friday.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad JSON" }, { status: 400 });

  const isManager = MANAGER_ROLES.includes(user.role);
  const fromUserId = String(body.fromUserId || user.id);
  const toUserId = String(body.toUserId || "");
  const note =
    String(body.note || "")
      .trim()
      .slice(0, 4000) || null;
  const keepSupport = body.keepSupport === true;
  const items: { entityType: EntityType; entityId: string }[] = (
    Array.isArray(body.items) ? body.items : []
  )
    .filter((i: any) => ["BRAND", "FACTORY", "DISTRIBUTOR"].includes(i?.entityType) && i?.entityId)
    .map((i: any) => ({ entityType: i.entityType, entityId: String(i.entityId) }))
    .slice(0, 300);

  if (!toUserId || !items.length)
    return NextResponse.json({ error: "Pick a person and at least one account" }, { status: 400 });
  if (toUserId === fromUserId)
    return NextResponse.json({ error: "That person already owns it" }, { status: 400 });
  if (fromUserId !== user.id && !isManager)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [from, to] = await Promise.all([
    prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, name: true, distributorId: true },
    }),
    prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, email: true, status: true, distributorId: true },
    }),
  ]);
  if (!from || !to || to.status !== "ACTIVE")
    return NextResponse.json({ error: "That teammate is not active" }, { status: 400 });
  // Distributor users hand over inside their own distributor only.
  if (!isManager && user.distributorId && to.distributorId !== user.distributorId)
    return NextResponse.json(
      { error: "You can only hand over to people on your own team" },
      { status: 403 },
    );

  // Non-managers can only move what they own.
  const owned = new Set(
    (await ownedEntityKeys(fromUserId)).map((k) => `${k.entityType}:${k.entityId}`),
  );
  const todo = items.filter((i) => isManager || owned.has(`${i.entityType}:${i.entityId}`));
  const skipped = items.length - todo.length;
  if (!todo.length)
    return NextResponse.json({ error: "You do not own those accounts" }, { status: 403 });

  const weekOf = mondayOf(new Date());
  const headline = `Handed over: ${from.name} → ${to.name}`;
  for (const i of todo) {
    const role =
      i.entityType === "BRAND"
        ? "ACCOUNT_MANAGER"
        : i.entityType === "FACTORY"
          ? "FACTORY_LEAD"
          : "DISTRIBUTOR_LEAD";
    await prisma.$transaction([
      prisma.entityManager.deleteMany({
        where: {
          entityType: i.entityType,
          entityId: i.entityId,
          userId: { in: [fromUserId, toUserId] },
        },
      }),
      prisma.entityManager.create({
        data: {
          entityType: i.entityType,
          entityId: i.entityId,
          userId: toUserId,
          role,
          isPrimary: true,
          notes: `Handed over from ${from.name} by ${user.name}`,
        },
      }),
      ...(keepSupport
        ? [
            prisma.entityManager.create({
              data: {
                entityType: i.entityType,
                entityId: i.entityId,
                userId: fromUserId,
                role: "SUPPORT",
                isPrimary: false,
                notes: `Stayed on as support after handing over to ${to.name}`,
              },
            }),
          ]
        : []),
      // the legacy sales-rep pointer follows the account
      ...(i.entityType === "BRAND"
        ? [
            prisma.brand.updateMany({
              where: { id: i.entityId, salesRepId: fromUserId },
              data: { salesRepId: toUserId },
            }),
          ]
        : i.entityType === "FACTORY"
          ? [
              prisma.factory.updateMany({
                where: { id: i.entityId, salesRepId: fromUserId },
                data: { salesRepId: toUserId },
              }),
            ]
          : []),
      prisma.accountCheckin.create({
        data: {
          entityType: i.entityType,
          entityId: i.entityId,
          userId: user.id,
          kind: HANDOVER_KIND,
          weekOf,
          headline,
          note,
        },
      }),
    ]);
  }

  const ids = (t: EntityType) => todo.filter((i) => i.entityType === t).map((i) => i.entityId);
  const [b, f, d] = await Promise.all([
    prisma.brand.findMany({
      where: { id: { in: ids("BRAND") } },
      select: { id: true, name: true },
    }),
    prisma.factory.findMany({
      where: { id: { in: ids("FACTORY") } },
      select: { id: true, name: true },
    }),
    prisma.distributor.findMany({
      where: { id: { in: ids("DISTRIBUTOR") } },
      select: { id: true, name: true },
    }),
  ]);
  await notifyHandover({
    actor: { id: user.id, name: user.name },
    from: { id: from.id, name: from.name },
    to: { id: to.id, email: to.email, name: to.name },
    accounts: [
      ...b.map((x) => ({ entityType: "BRAND" as EntityType, entityId: x.id, name: x.name })),
      ...f.map((x) => ({ entityType: "FACTORY" as EntityType, entityId: x.id, name: x.name })),
      ...d.map((x) => ({ entityType: "DISTRIBUTOR" as EntityType, entityId: x.id, name: x.name })),
    ],
    note,
    keepSupport,
  });

  return NextResponse.json({ ok: true, moved: todo.length, skipped, to: to.name });
}

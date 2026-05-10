// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/network — supplying factories + pending
 * invitations for the caller's brand.
 *
 * POST { factoryId } — link an existing Atlas Factory by upserting a
 * SupplyChainLink (FACTORY-SUPPLIES-BRAND, active=true).
 *
 * DELETE ?factoryId= — soft-unlink (active=false on the link row).
 *
 * BRAND_MANAGER + admin-like roles can mutate; everyone authenticated
 * with a brandId can read.
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) return forbidden();
  const brandId = user.brandId;

  // Active supplying factories — read SupplyChainLink first.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      toType: "BRAND",
      toId: brandId,
      fromType: "FACTORY",
      relation: "SUPPLIES",
      active: true,
    },
    select: { fromId: true },
  });

  const factories =
    links.length > 0
      ? await prisma.factory.findMany({
          where: { id: { in: links.map((l: any) => l.fromId) } },
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
            specialty: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  const pendingInvites = await prisma.factoryInvitation.findMany({
    where: { brandId, status: "PENDING" },
    select: {
      id: true,
      invitedFactoryName: true,
      invitedContactName: true,
      invitedContactEmail: true,
      invitedCountry: true,
      invitedAt: true,
    },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ ok: true, factories, pendingInvites });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.factoryId) return bad("factoryId required");

  const factory = await prisma.factory.findUnique({
    where: { id: body.factoryId },
    select: { id: true },
  });
  if (!factory) return bad("Factory not found");

  const link = await prisma.supplyChainLink.upsert({
    where: {
      supply_chain_link_unique: {
        fromType: "FACTORY",
        fromId: factory.id,
        toType: "BRAND",
        toId: user.brandId,
        relation: "SUPPLIES",
      },
    },
    create: {
      fromType: "FACTORY",
      fromId: factory.id,
      toType: "BRAND",
      toId: user.brandId,
      relation: "SUPPLIES",
      active: true,
    },
    update: { active: true },
  });

  return NextResponse.json({ ok: true, link });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId) return forbidden();

  const url = new URL(req.url);
  const factoryId = url.searchParams.get("factoryId");
  if (!factoryId) return bad("factoryId required");

  const updated = await prisma.supplyChainLink.updateMany({
    where: {
      fromType: "FACTORY",
      fromId: factoryId,
      toType: "BRAND",
      toId: user.brandId,
      relation: "SUPPLIES",
    },
    data: { active: false },
  });

  return NextResponse.json({ ok: true, removed: updated.count });
}

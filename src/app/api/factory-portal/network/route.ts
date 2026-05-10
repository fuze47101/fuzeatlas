// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Factory-side network endpoint (Phase 5C).
 *
 * GET — returns:
 *   brands  — every brand this factory supplies (SupplyChainLink
 *             FACTORY-SUPPLIES-BRAND, active)
 *   pending — open FactoryInvitation rows whose
 *             invitedContactEmail matches the calling user OR
 *             whose linkedFactoryId already points at the caller's
 *             factory (defensive — admin may have pre-linked)
 */

const ROLES = ["ADMIN", "EMPLOYEE", "FACTORY_USER", "FACTORY_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ROLES.includes(user.role)) return forbidden();
  if (!user.factoryId) return forbidden();

  const factoryId = user.factoryId;

  const links = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "FACTORY",
      fromId: factoryId,
      toType: "BRAND",
      relation: "SUPPLIES",
      active: true,
    },
    select: { toId: true },
  });

  const brands =
    links.length > 0
      ? await prisma.brand.findMany({
          where: { id: { in: links.map((l: any) => l.toId) } },
          select: {
            id: true,
            name: true,
            requiredFuzeTier: true,
            icpCadenceEveryNBatches: true,
            icpCadenceEveryLitersConsumed: true,
            profile: { select: { logoUrl: true } },
          },
          orderBy: { name: "asc" },
        })
      : [];

  // Pending invitations matching the caller's email or pre-linked
  // to the caller's factory.
  const pending = await prisma.factoryInvitation.findMany({
    where: {
      status: "PENDING",
      OR: [
        { invitedContactEmail: user.email.toLowerCase() },
        { linkedFactoryId: factoryId },
      ],
    },
    select: {
      id: true,
      invitedFactoryName: true,
      invitedContactEmail: true,
      invitedAt: true,
      inviteToken: true,
      brand: {
        select: {
          id: true,
          name: true,
          profile: { select: { logoUrl: true } },
        },
      },
    },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ ok: true, brands, pending });
}

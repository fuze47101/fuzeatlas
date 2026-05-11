// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyInvitationAccepted } from "@/lib/notify";

/**
 * POST /api/factory-portal/network/accept-invite
 *
 * Body: { token: string }
 *
 * Looks up the FactoryInvitation by inviteToken. If still PENDING:
 *   - Stamp linkedFactoryId = caller's factoryId
 *   - Stamp status = ACCEPTED, respondedAt = now
 *   - Upsert SupplyChainLink (FACTORY-SUPPLIES-BRAND, active=true)
 *
 * One transaction; either everything happens or nothing does.
 */

const ROLES = ["ADMIN", "EMPLOYEE", "FACTORY_USER", "FACTORY_MANAGER"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ROLES.includes(user.role)) return forbidden();
  if (!user.factoryId) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.token) return bad("token required");

  const invite = await prisma.factoryInvitation.findUnique({
    where: { inviteToken: String(body.token) },
    select: { id: true, brandId: true, status: true },
  });
  if (!invite) return bad("Invitation not found", 404);
  if (invite.status !== "PENDING") return bad(`Invitation already ${invite.status.toLowerCase()}`);

  await prisma.$transaction([
    prisma.factoryInvitation.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        linkedFactoryId: user.factoryId,
        respondedAt: new Date(),
      },
    }),
    prisma.supplyChainLink.upsert({
      where: {
        supply_chain_link_unique: {
          fromType: "FACTORY",
          fromId: user.factoryId,
          toType: "BRAND",
          toId: invite.brandId,
          relation: "SUPPLIES",
        },
      },
      create: {
        fromType: "FACTORY",
        fromId: user.factoryId,
        toType: "BRAND",
        toId: invite.brandId,
        relation: "SUPPLIES",
        active: true,
      },
      update: { active: true },
    }),
  ]);

  // Phase 15 IMP-6 — fan to the brand's primary EntityManager + admins.
  try {
    const factory = await prisma.factory.findUnique({
      where: { id: user.factoryId },
      select: { name: true },
    });
    notifyInvitationAccepted({
      invitationId: invite.id,
      brandId: invite.brandId,
      factoryName: factory?.name || null,
      linkedFactoryId: user.factoryId,
    }).catch((e) => console.warn("[invitation-accepted] notify failed:", e));
  } catch (e) {
    console.warn("[invitation-accepted] lookup failed:", e);
  }

  return NextResponse.json({ ok: true });
}

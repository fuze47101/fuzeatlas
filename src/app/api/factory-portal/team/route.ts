// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ROSTER_ADMIN_ROLES,
  createOrgInvitation,
  listOrgTeam,
  revokeOrgInvitation,
} from "@/lib/org-invitations";

/**
 * /api/factory-portal/team — NEED-7a.
 *
 * GET:    list teammates + PENDING invitations on the caller's factory.
 * POST:   send a new invitation (FACTORY_MANAGER + admin only).
 * DELETE: revoke a PENDING invitation by id.
 */

const ADMIN_ROLES = ROSTER_ADMIN_ROLES.FACTORY;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const factory = await prisma.factory.findUnique({
    where: { id: user.factoryId },
    select: { id: true, name: true },
  });
  if (!factory)
    return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });

  const { teammates, pending } = await listOrgTeam("FACTORY", factory.id);
  return NextResponse.json({
    ok: true,
    factory,
    teammates,
    pendingInvites: pending,
    canManage: ADMIN_ROLES.includes(user.role),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Read-only access" }, { status: 403 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  const factory = await prisma.factory.findUnique({
    where: { id: user.factoryId },
    select: { id: true, name: true },
  });
  if (!factory)
    return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  try {
    const invite = await createOrgInvitation({
      entityType: "FACTORY",
      entityId: factory.id,
      entityName: factory.name,
      invitedByUserId: user.id,
      invitedByName: user.name || null,
      email: body.email,
      role: body.role || "FACTORY_USER",
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      jobTitle: body.jobTitle || null,
      notes: body.notes || null,
    });
    return NextResponse.json({ ok: true, invite });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Invite failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Read-only access" }, { status: 403 });

  const url = new URL(req.url);
  const invitationId = url.searchParams.get("invitationId");
  if (!invitationId)
    return NextResponse.json({ ok: false, error: "invitationId required" }, { status: 400 });

  // Confirm the invitation belongs to caller's factory before revoking.
  const invite = await prisma.orgInvitation.findUnique({
    where: { id: invitationId },
    select: { entityType: true, entityId: true },
  });
  if (
    !invite ||
    invite.entityType !== "FACTORY" ||
    invite.entityId !== user.factoryId
  ) {
    return NextResponse.json({ ok: false, error: "Invitation not in your scope" }, { status: 403 });
  }

  const result = await revokeOrgInvitation(invitationId, user.id);
  return NextResponse.json({ ok: true, ...result });
}

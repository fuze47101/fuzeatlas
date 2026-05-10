// @ts-nocheck
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/brand-portal/network/invite
 *
 * Create a FactoryInvitation. inviteToken is a fresh UUID powering
 * the public /factory-invitation/[token] landing page. invitedById
 * stamped from session.
 *
 * BRAND_MANAGER + admin-like roles only.
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

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.invitedFactoryName) return bad("invitedFactoryName required");
  if (!body.invitedContactEmail) return bad("invitedContactEmail required");

  const created = await prisma.factoryInvitation.create({
    data: {
      brandId: user.brandId,
      invitedFactoryName: String(body.invitedFactoryName).trim(),
      invitedContactName: body.invitedContactName || null,
      invitedContactEmail: String(body.invitedContactEmail).toLowerCase().trim(),
      invitedContactPhone: body.invitedContactPhone || null,
      invitedAddress: body.invitedAddress || null,
      invitedCountry: body.invitedCountry || null,
      notes: body.notes || null,
      invitedById: user.id,
      inviteToken: randomUUID(),
      status: "PENDING",
    },
    select: {
      id: true,
      invitedFactoryName: true,
      invitedContactEmail: true,
      inviteToken: true,
      status: true,
      invitedAt: true,
    },
  });

  return NextResponse.json({ ok: true, invitation: created });
}

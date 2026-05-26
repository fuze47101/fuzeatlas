// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  createOrgInvitation,
  ALLOWED_INVITE_ROLES,
  INTERNAL_ENTITY_ID,
  type OrgEntityType,
} from "@/lib/org-invitations";

/**
 * POST /api/admin/invitations
 *
 * Admin-side magic-link invitation. Same OrgInvitation token + email
 * pipeline as /brand-portal/team but allows inviting ANY UserRole
 * (BRAND_*, FACTORY_*, DISTRIBUTOR_*, LAB, ADMIN, EMPLOYEE, SALES_*).
 * Internal roles use a synthetic entityType=INTERNAL anchor so no
 * brand/factory/distributor/lab FK is required.
 *
 * Body:
 *   email                       required
 *   role                        required, one of UserRole
 *   name                        optional (firstName + lastName concat OK)
 *   firstName / lastName        optional (preferred over name)
 *   jobTitle / notes            optional
 *   entityId                    required for BRAND/FACTORY/DISTRIBUTOR/LAB roles
 *
 * ACL: ADMIN, EMPLOYEE, SALES_MANAGER.
 */

const INVITE_AUTHORIZED_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

const ROLE_TO_ENTITY_TYPE: Record<string, OrgEntityType> = {
  BRAND_USER: "BRAND",
  BRAND_MANAGER: "BRAND",
  FACTORY_USER: "FACTORY",
  FACTORY_MANAGER: "FACTORY",
  DISTRIBUTOR_USER: "DISTRIBUTOR",
  LAB_USER: "LAB",
  ADMIN: "INTERNAL",
  EMPLOYEE: "INTERNAL",
  SALES_MANAGER: "INTERNAL",
  SALES_REP: "INTERNAL",
  BD_REP: "INTERNAL",
  TESTING_MANAGER: "INTERNAL",
  FABRIC_MANAGER: "INTERNAL",
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

async function resolveEntityName(
  entityType: OrgEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === "INTERNAL") return "FUZE Atlas";
  try {
    if (entityType === "BRAND") {
      const r = await prisma.brand.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return r?.name || null;
    }
    if (entityType === "FACTORY") {
      const r = await prisma.factory.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return r?.name || null;
    }
    if (entityType === "DISTRIBUTOR") {
      const r = await prisma.distributor.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return r?.name || null;
    }
    if (entityType === "LAB") {
      const r = await prisma.lab.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return r?.name || null;
    }
  } catch {}
  return null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return bad("Unauthorized", 401);
  if (!INVITE_AUTHORIZED_ROLES.has(user.role)) return bad("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const role = String(body?.role || "").trim();

  if (!email) return bad("email required");
  if (!role) return bad("role required");

  const entityType = ROLE_TO_ENTITY_TYPE[role];
  if (!entityType) return bad(`Unknown role: ${role}`);

  // ALLOWED_INVITE_ROLES gates which roles each entity type can host.
  // For admin-side invitations the role↔entity pairing comes from the
  // ROLE_TO_ENTITY_TYPE map above, so this check is mostly a redundant
  // belt-and-suspenders against a hand-edited request body.
  if (!ALLOWED_INVITE_ROLES[entityType].includes(role)) {
    return bad(`Role ${role} not allowed for ${entityType}`);
  }

  let entityId: string;
  if (entityType === "INTERNAL") {
    entityId = INTERNAL_ENTITY_ID;
  } else {
    entityId = String(body?.entityId || "").trim();
    if (!entityId) {
      return bad(`${entityType.toLowerCase()} required for role ${role}`);
    }
  }

  const entityName = await resolveEntityName(entityType, entityId);
  if (!entityName) {
    return bad(`${entityType.toLowerCase()} ${entityId} not found`, 404);
  }

  // Allow either { name } or { firstName, lastName } shape.
  let firstName: string | null = body?.firstName ? String(body.firstName).trim() : null;
  let lastName: string | null = body?.lastName ? String(body.lastName).trim() : null;
  if (!firstName && body?.name) {
    const parts = String(body.name).trim().split(/\s+/);
    firstName = parts.shift() || null;
    lastName = parts.length ? parts.join(" ") : null;
  }

  try {
    const result = await createOrgInvitation({
      entityType,
      entityId,
      entityName,
      invitedByUserId: user.id,
      invitedByName: user.name || user.email,
      email,
      role,
      firstName,
      lastName,
      jobTitle: body?.jobTitle || null,
      notes: body?.notes || null,
    });
    // Pull expiresAt to surface in the toast.
    const row = await prisma.orgInvitation.findUnique({
      where: { id: result.invitationId },
      select: { expiresAt: true },
    });
    return NextResponse.json({
      ok: true,
      invitationId: result.invitationId,
      acceptUrl: result.acceptUrl,
      emailDispatched: result.emailDispatched,
      preExisting: result.preExisting,
      expiresAt: row?.expiresAt?.toISOString() || null,
      entityType,
      entityName,
      role,
      email,
    });
  } catch (e: any) {
    return bad(e?.message || "Failed to create invitation");
  }
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Brand-portal team endpoints (Phase 5A).
 *
 * GET — list active teammates on the caller's brand + pending
 *       invitations (AccessRequest rows where company matches the
 *       brand name and status = PENDING).
 *
 * POST — create a teammate invitation. Routes through the existing
 *        AccessRequest flow with company pre-stamped to the
 *        inviter's brand name. Admin approves elsewhere; on approval
 *        the user lands with the right brandId.
 *
 * Roles: BRAND_MANAGER + admin-like can invite. BRAND_USER is
 * read-only.
 */

const INVITE_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

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

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: { id: true, name: true },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  const [teammates, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { brandId: brand.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.accessRequest.findMany({
      where: {
        company: brand.name,
        requestType: "BRAND",
        status: "PENDING",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ ok: true, brand, teammates, pendingInvites });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!INVITE_ROLES.includes(user.role)) return forbidden();
  if (!user.brandId) return forbidden();

  const body = await req.json().catch(() => ({}));
  if (!body.email || !body.firstName) return bad("email + firstName required");

  const brand = await prisma.brand.findUnique({
    where: { id: user.brandId },
    select: { id: true, name: true },
  });
  if (!brand) return bad("Brand not found");

  // Check if a user with this email already exists on this brand —
  // surface a clearer error than "AccessRequest unique violation."
  const existing = await prisma.user.findUnique({
    where: { email: String(body.email).toLowerCase().trim() },
    select: { id: true, brandId: true },
  });
  if (existing && existing.brandId === brand.id) {
    return bad("That email already belongs to a teammate on this brand.");
  }

  const created = await prisma.accessRequest.create({
    data: {
      firstName: String(body.firstName),
      lastName: String(body.lastName || ""),
      email: String(body.email).toLowerCase().trim(),
      jobTitle: body.jobTitle || null,
      company: brand.name,
      requestType: "BRAND",
      notes:
        body.notes ||
        `Teammate invitation from ${user.name || user.email} (${user.role}) for ${brand.name}.`,
      status: "PENDING",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, invite: created });
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setSessionCookie } from "@/lib/auth";

/**
 * /api/auth/invitation/[token] — magic-link signup.
 *
 * GET: peek the invitation so the /signup/invitation/[token] page can
 *      render "Joining {Org} as {role}". No auth required.
 * POST: accept the invitation. Body: { password, name? }. Creates (or
 *       updates) the User row with the FK + role from the invitation,
 *       sets a session cookie, marks the invitation ACCEPTED.
 *
 * Idempotency: if a User with this email already exists and is in the
 * same org, we attach the role + return the existing user. If they're
 * in a DIFFERENT org or have a password already, we refuse (the link
 * is supposed to onboard a new teammate, not move someone laterally).
 */

const FK_BY_ENTITY: Record<string, "brandId" | "factoryId" | "distributorId" | "labId"> = {
  BRAND: "brandId",
  FACTORY: "factoryId",
  DISTRIBUTOR: "distributorId",
  LAB: "labId",
  // INTERNAL: no FK — admin/employee/sales accounts aren't scoped to any
  // single org. Handled below.
};

async function getInvitationByToken(token: string) {
  return prisma.orgInvitation.findUnique({
    where: { token },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });
}

async function orgLabel(entityType: string, entityId: string): Promise<string> {
  try {
    if (entityType === "BRAND") {
      const r = await prisma.brand.findUnique({ where: { id: entityId }, select: { name: true } });
      return r?.name || "your team";
    }
    if (entityType === "FACTORY") {
      const r = await prisma.factory.findUnique({ where: { id: entityId }, select: { name: true } });
      return r?.name || "your factory";
    }
    if (entityType === "DISTRIBUTOR") {
      const r = await prisma.distributor.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      return r?.name || "your distributor";
    }
    if (entityType === "LAB") {
      const r = await prisma.lab.findUnique({ where: { id: entityId }, select: { name: true } });
      return r?.name || "your lab";
    }
    if (entityType === "INTERNAL") {
      return "FUZE Atlas";
    }
  } catch {
    /* fallthrough */
  }
  return "your team";
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  let invite: any;
  try {
    invite = await getInvitationByToken(token);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invitations aren't provisioned yet. An admin needs to run the OrgInvitation migration.",
      },
      { status: 500 },
    );
  }
  if (!invite) {
    return NextResponse.json({ ok: false, error: "Invitation not found" }, { status: 404 });
  }
  if (invite.status === "REVOKED") {
    return NextResponse.json({ ok: false, error: "This invitation was revoked." }, { status: 410 });
  }
  if (invite.status === "ACCEPTED") {
    return NextResponse.json(
      { ok: false, error: "This invitation has already been used. Sign in instead." },
      { status: 409 },
    );
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "This invitation has expired." }, { status: 410 });
  }

  const entityName = await orgLabel(invite.entityType, invite.entityId);

  return NextResponse.json({
    ok: true,
    invitation: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      firstName: invite.firstName,
      lastName: invite.lastName,
      jobTitle: invite.jobTitle,
      entityType: invite.entityType,
      entityName,
      invitedByName: invite.invitedBy?.name || invite.invitedBy?.email || null,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const password: string = body?.password || "";
  const providedName: string = (body?.name || "").trim();

  if (!password || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  let invite: any;
  try {
    invite = await getInvitationByToken(token);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invitations aren't provisioned yet. Ask an admin to run the OrgInvitation migration.",
      },
      { status: 500 },
    );
  }
  if (!invite)
    return NextResponse.json({ ok: false, error: "Invitation not found" }, { status: 404 });
  if (invite.status === "REVOKED")
    return NextResponse.json({ ok: false, error: "This invitation was revoked." }, { status: 410 });
  if (invite.status === "ACCEPTED")
    return NextResponse.json(
      { ok: false, error: "This invitation has already been used. Sign in instead." },
      { status: 409 },
    );
  if (invite.expiresAt < new Date())
    return NextResponse.json({ ok: false, error: "This invitation has expired." }, { status: 410 });

  const fk = FK_BY_ENTITY[invite.entityType];
  if (!fk && invite.entityType !== "INTERNAL")
    return NextResponse.json(
      { ok: false, error: `Unknown entity type ${invite.entityType}` },
      { status: 500 },
    );

  // Compose the User row.
  const fullName =
    providedName ||
    [invite.firstName, invite.lastName].filter(Boolean).join(" ") ||
    invite.email.split("@")[0];

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: {
      id: true,
      password: true,
      brandId: true,
      factoryId: true,
      distributorId: true,
      labId: true,
    },
  });

  if (existing) {
    // If the existing user already belongs to a different org of the
    // SAME type, refuse — moving people laterally needs admin intent.
    if (fk) {
      const currentFkValue = (existing as any)[fk];
      if (currentFkValue && currentFkValue !== invite.entityId) {
        return NextResponse.json(
          {
            ok: false,
            error: `Account ${invite.email} is already attached to a different ${invite.entityType.toLowerCase()}. Contact an admin.`,
          },
          { status: 409 },
        );
      }
    }
    if (existing.password) {
      return NextResponse.json(
        {
          ok: false,
          error: `Account ${invite.email} already has a password. Sign in normally — no invitation needed.`,
        },
        { status: 409 },
      );
    }
  }

  const hashed = await hashPassword(password);
  const baseData: any = {
    name: fullName,
    password: hashed,
    role: invite.role,
    status: "ACTIVE",
    emailVerified: true,
    passwordChangedAt: new Date(),
  };
  if (fk) {
    baseData[fk] = invite.entityId;
  }
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: baseData })
    : await prisma.user.create({ data: { ...baseData, email: invite.email } });

  await prisma.orgInvitation.update({
    where: { id: invite.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      acceptedByUserId: user.id,
    },
  });

  const sessionToken = await createToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    brandId: user.brandId || null,
    factoryId: user.factoryId || null,
    distributorId: user.distributorId || null,
    labId: user.labId || null,
  });
  await setSessionCookie(sessionToken);

  const landing =
    invite.entityType === "BRAND"
      ? "/brand-portal"
      : invite.entityType === "FACTORY"
        ? "/factory-portal"
        : invite.entityType === "DISTRIBUTOR"
          ? "/distributor-portal"
          : invite.entityType === "LAB"
            ? "/lab-portal"
            : "/home"; // INTERNAL → admin home

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    landing,
  });
}

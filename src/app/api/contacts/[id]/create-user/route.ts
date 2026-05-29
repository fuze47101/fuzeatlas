// @ts-nocheck
/**
 * POST /api/contacts/[id]/create-user
 *
 * Provisions an Atlas user account from an existing Contact record. Ticket #39:
 * Andrew wants the "Create Atlas user" affordance everywhere a contact lives —
 * Factory contacts first, then Brand/Distributor/Lab. This route is entity-
 * agnostic: it derives the role from whichever entity FK the contact has.
 *
 * Behavior:
 *   1. Admin-only.
 *   2. Contact must have an email and at least one entity FK (factoryId, brandId,
 *      distributorId, labId — derived from the contact row).
 *   3. If a user with that email already exists, returns 409 with the existing
 *      user's id so the caller can offer "link instead".
 *   4. Generates a 10-char temp password, creates the user with mustChangePassword
 *      =true, and emails the credentials via sendAccessApprovedEmail (the same
 *      template used by /api/access-requests approval — battle-tested).
 *   5. Returns { ok, user, tempPassword } so the admin can copy/paste the temp
 *      password as a fallback if email delivery fails.
 *
 * Note: explicit role override is supported via body.role (e.g. promote to
 * FACTORY_MANAGER instead of FACTORY_USER). Falls back to the entity-default
 * role if not provided.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser, hasMinRole, hashPassword } from "@/lib/auth";
import { sendAccessApprovedEmail } from "@/lib/email";

// Local copy of generateTempPassword from /api/access-requests/[id]/route.ts.
// Tiny enough that duplicating it is cheaper than extracting a shared util,
// and it keeps this route self-contained for the security review.
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const specials = "!@#$&";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  const pos = Math.floor(Math.random() * pw.length);
  pw = pw.slice(0, pos) + specials[Math.floor(Math.random() * specials.length)] + pw.slice(pos);
  return pw;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Permission gate — real session user, ignore impersonation.
    const me = await getRealUser();
    if (!me || !hasMinRole(me.role, "ADMIN")) {
      return NextResponse.json(
        { ok: false, error: "Only admins can provision Atlas users" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const roleOverride: string | undefined = body.role;

    // Pull the contact along with the entity name (for the welcome email).
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        factory: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    if (!contact.email) {
      return NextResponse.json(
        { ok: false, error: "Contact has no email — add one before creating an Atlas user" },
        { status: 400 },
      );
    }

    // Determine the entity FK + default role from whichever relation the
    // contact is linked to. Precedence: factory → brand → distributor.
    // (Contact has no labId today — labs use AccessRequest instead.)
    let derivedRole: string;
    const userData: {
      factoryId?: string;
      brandId?: string;
      distributorId?: string;
    } = {};
    let entityName: string;
    let accountType: "factory" | "brand" | "distributor" | "internal";

    if (contact.factoryId) {
      derivedRole = "FACTORY_USER";
      userData.factoryId = contact.factoryId;
      entityName = contact.factory?.name || "Factory";
      accountType = "factory";
    } else if (contact.brandId) {
      derivedRole = "BRAND_USER";
      userData.brandId = contact.brandId;
      entityName = contact.brand?.name || "Brand";
      accountType = "brand";
    } else if (contact.distributorId) {
      derivedRole = "DISTRIBUTOR_USER";
      userData.distributorId = contact.distributorId;
      entityName = contact.distributor?.name || "Distributor";
      accountType = "distributor";
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Contact has no entity link — assign to a factory, brand, or distributor first",
        },
        { status: 400 },
      );
    }

    // Allow admin to override the role (e.g. FACTORY_MANAGER vs FACTORY_USER).
    // Validate that the override is compatible with the entity FK we found.
    const COMPATIBLE_ROLES: Record<string, string[]> = {
      factory: ["FACTORY_USER", "FACTORY_MANAGER"],
      brand: ["BRAND_USER", "BRAND_MANAGER"],
      distributor: ["DISTRIBUTOR_USER", "DISTRIBUTOR_MANAGER"],
      internal: [],
    };
    let finalRole = derivedRole;
    if (roleOverride) {
      const allowed = COMPATIBLE_ROLES[accountType] || [];
      if (!allowed.includes(roleOverride)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Role ${roleOverride} is not compatible with a ${accountType} contact. Allowed: ${allowed.join(", ")}`,
          },
          { status: 400 },
        );
      }
      finalRole = roleOverride;
    }

    const normalizedEmail = contact.email.toLowerCase().trim();

    // Dedupe by email — surface the existing user so the admin can decide.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          error: `A user with this email already exists (${existingUser.name || existingUser.email}, role ${existingUser.role}).`,
          code: "USER_ALREADY_EXISTS",
          existingUser,
        },
        { status: 409 },
      );
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    const fullName =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
      contact.name ||
      contact.email;

    const newUser = await prisma.user.create({
      data: {
        name: fullName,
        email: normalizedEmail,
        password: hashedPassword,
        role: finalRole as any,
        status: "ACTIVE",
        mustChangePassword: true,
        ...userData,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    // Best-effort welcome email. Don't fail the whole request if SMTP hiccups —
    // we still return the tempPassword so the admin can deliver it manually.
    let emailSent = true;
    let emailError: string | null = null;
    try {
      await sendAccessApprovedEmail({
        email: normalizedEmail,
        name: fullName,
        tempPassword,
        companyName: entityName,
        accountType,
      });
    } catch (e: any) {
      emailSent = false;
      emailError = e?.message || "Email send failed";
      console.error("[create-user] welcome email failed:", e);
    }

    return NextResponse.json({
      ok: true,
      user: newUser,
      tempPassword, // surfaced so admin can paste it if email bounces
      emailSent,
      emailError,
      message: `Atlas user created for ${fullName}. ${
        emailSent
          ? "Welcome email sent with temp password."
          : `Email failed (${emailError}). Share temp password manually: ${tempPassword}`
      }`,
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "A user with this email already exists" },
        { status: 409 },
      );
    }
    console.error("[create-user] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

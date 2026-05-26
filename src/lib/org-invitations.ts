/**
 * src/lib/org-invitations.ts — shared NEED-7a helpers.
 *
 * Factory, distributor, and lab team pages all hit the same flow:
 *   1. List currently-active teammates on the caller's org.
 *   2. List PENDING invitations.
 *   3. POST a new invitation (creates OrgInvitation + emails the token).
 *
 * Brand portal currently uses the legacy AccessRequest pattern; we
 * leave it as-is and bring the 3 missing portals onto the new model.
 * If we later migrate brand, this lib is the single place to plumb it.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export type OrgEntityType = "BRAND" | "FACTORY" | "DISTRIBUTOR" | "LAB" | "INTERNAL";

/** Stable sentinel for INTERNAL invitations — internal roles (ADMIN,
 * EMPLOYEE, SALES_*) don't attach to any brand/factory/distributor/lab,
 * but OrgInvitation.entityId is non-nullable in schema, so we anchor
 * them on a non-FK string the acceptance route recognizes. */
export const INTERNAL_ENTITY_ID = "fuze-internal";

/** Roles a portal admin is allowed to invite their teammates as. */
export const ALLOWED_INVITE_ROLES: Record<OrgEntityType, string[]> = {
  BRAND: ["BRAND_USER", "BRAND_MANAGER"],
  FACTORY: ["FACTORY_USER", "FACTORY_MANAGER"],
  DISTRIBUTOR: ["DISTRIBUTOR_USER"],
  LAB: ["LAB_USER"],
  INTERNAL: [
    "ADMIN",
    "EMPLOYEE",
    "SALES_MANAGER",
    "SALES_REP",
    "BD_REP",
    "TESTING_MANAGER",
    "FABRIC_MANAGER",
  ],
};

/** Roles that can manage their org's roster (invite + revoke). */
export const ROSTER_ADMIN_ROLES: Record<OrgEntityType, string[]> = {
  BRAND: ["ADMIN", "EMPLOYEE", "BRAND_MANAGER"],
  FACTORY: ["ADMIN", "EMPLOYEE", "FACTORY_MANAGER"],
  DISTRIBUTOR: ["ADMIN", "EMPLOYEE", "DISTRIBUTOR_USER"],
  LAB: ["ADMIN", "EMPLOYEE", "LAB_USER"],
  INTERNAL: ["ADMIN", "EMPLOYEE", "SALES_MANAGER"],
};

/** Maps OrgEntityType to the User-table FK column name. INTERNAL has
 * no FK — the acceptance route creates the user with no entity link. */
const USER_FK_FIELD: Record<
  Exclude<OrgEntityType, "INTERNAL">,
  "brandId" | "factoryId" | "distributorId" | "labId"
> = {
  BRAND: "brandId",
  FACTORY: "factoryId",
  DISTRIBUTOR: "distributorId",
  LAB: "labId",
};

/** Invitation TTL — 14 days from creation. */
export const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface Teammate {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  createdAt: string;
  expiresAt: string;
  invitedByName: string | null;
}

/** Lists teammates currently in the org + pending invitations. */
export async function listOrgTeam(
  entityType: OrgEntityType,
  entityId: string,
): Promise<{ teammates: Teammate[]; pending: PendingInvite[] }> {
  if (entityType === "INTERNAL") {
    // INTERNAL has no FK-scoped roster; callers should use a separate
    // admin listing path. Return empty for safety.
    return { teammates: [], pending: [] };
  }
  const fk = USER_FK_FIELD[entityType];

  // Note: User model doesn't have a lastLoginAt column in the canonical
  // schema, so we omit it from the select. createdAt acts as the
  // "joined on" timestamp for the roster.
  const users = await prisma.user.findMany({
    where: { [fk]: entityId } as any,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  let pending: any[] = [];
  try {
    pending = await prisma.orgInvitation.findMany({
      where: {
        entityType,
        entityId,
        status: "PENDING",
      },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    // Defensive — if the table doesn't exist yet (pre-migration deploy),
    // surface an empty roster instead of 500.
    console.warn("[org-invitations] orgInvitation table missing? returning []:", e);
  }

  return {
    teammates: users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
    })),
    pending: pending.map((p: any) => ({
      id: p.id,
      email: p.email,
      role: p.role,
      firstName: p.firstName,
      lastName: p.lastName,
      jobTitle: p.jobTitle,
      createdAt: p.createdAt.toISOString(),
      expiresAt: p.expiresAt.toISOString(),
      invitedByName: p.invitedBy?.name || p.invitedBy?.email || null,
    })),
  };
}

export interface CreateInviteInput {
  entityType: OrgEntityType;
  entityId: string;
  entityName: string; // shown in the email body
  invitedByUserId: string;
  invitedByName: string | null;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  notes?: string | null;
}

export interface CreateInviteResult {
  invitationId: string;
  token: string;
  acceptUrl: string;
  emailDispatched: boolean;
  preExisting: boolean;
}

/**
 * Create a PENDING invitation and email the magic link.
 *
 * Refuses if:
 *   - email is malformed
 *   - role isn't in ALLOWED_INVITE_ROLES[entityType]
 *   - a User with this email is already in the org (active or otherwise)
 *
 * If a PENDING invitation already exists for (email, entityType, entityId),
 * we re-use it (refresh expiresAt + re-send the email). Idempotent.
 */
export async function createOrgInvitation(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }
  if (!ALLOWED_INVITE_ROLES[input.entityType].includes(input.role)) {
    throw new Error(
      `Role ${input.role} not allowed for ${input.entityType}. Pick one of: ${ALLOWED_INVITE_ROLES[input.entityType].join(", ")}`,
    );
  }

  if (input.entityType !== "INTERNAL") {
    const fk = USER_FK_FIELD[input.entityType];
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, [fk]: true } as any,
    });
    if (existingUser && (existingUser as any)[fk] === input.entityId) {
      throw new Error(`${email} is already on this team.`);
    }
  } else {
    // INTERNAL: just reject if a user already exists with a password —
    // admin should use Add User flow for those. The acceptance route
    // also enforces this defensively.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });
    if (existingUser?.password) {
      throw new Error(`${email} already has an active account.`);
    }
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  let preExisting = false;
  let invitation: any;
  try {
    const existing = await prisma.orgInvitation.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        email,
        status: "PENDING",
      },
    });
    if (existing) {
      preExisting = true;
      invitation = await prisma.orgInvitation.update({
        where: { id: existing.id },
        data: {
          expiresAt,
          // Refresh metadata in case the inviter corrected it.
          role: input.role,
          firstName: input.firstName ?? existing.firstName,
          lastName: input.lastName ?? existing.lastName,
          jobTitle: input.jobTitle ?? existing.jobTitle,
          notes: input.notes ?? existing.notes,
        },
      });
    } else {
      invitation = await prisma.orgInvitation.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          invitedByUserId: input.invitedByUserId,
          email,
          role: input.role,
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          jobTitle: input.jobTitle || null,
          notes: input.notes || null,
          token: generateInviteToken(),
          status: "PENDING",
          expiresAt,
        },
      });
    }
  } catch (e: any) {
    throw new Error(
      e?.message?.includes("OrgInvitation")
        ? "OrgInvitation table not yet provisioned. Run /api/cron/migrate-org-invitation."
        : e?.message || "Failed to create invitation",
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";
  const acceptUrl = `${appUrl}/signup/invitation/${invitation.token}`;
  const inviterLabel = input.invitedByName || "the FUZE Atlas team";

  const subject = preExisting
    ? `Reminder — invitation to ${input.entityName} on FUZE Atlas`
    : `You're invited to ${input.entityName} on FUZE Atlas`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;color:#0f172a;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:18px 24px;border-radius:12px 12px 0 0;color:white;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">FUZE Atlas — Team Invitation</div>
        <h2 style="margin:4px 0 0;font-size:20px;font-weight:800;">Join ${escapeHtml(input.entityName)}</h2>
      </div>
      <div style="padding:20px 24px;background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 14px;line-height:1.5;">Hi${input.firstName ? " " + escapeHtml(input.firstName) : ""},</p>
        <p style="margin:0 0 14px;line-height:1.5;">
          ${escapeHtml(inviterLabel)} invited you to join <strong>${escapeHtml(input.entityName)}</strong> on FUZE Atlas as a <strong>${escapeHtml(input.role.replace(/_/g, " ").toLowerCase())}</strong>.
        </p>
        <p style="margin:0 0 18px;line-height:1.5;">
          Click below to set your password and finish setting up your account. The link expires in 14 days.
        </p>
        <p style="margin:0 0 18px;">
          <a href="${acceptUrl}"
             style="display:inline-block;padding:11px 22px;background:#00b4c3;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
            Accept invitation →
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#475569;line-height:1.4;">
          If the button doesn't work, copy and paste this URL:<br/>
          <a href="${acceptUrl}" style="color:#0369a1;word-break:break-all;">${acceptUrl}</a>
        </p>
        <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">
          You're receiving this because ${escapeHtml(inviterLabel)} added you to the FUZE Atlas team for ${escapeHtml(input.entityName)}.
          If this wasn't expected, you can safely ignore it.
        </p>
      </div>
    </div>
  `;

  let emailDispatched = false;
  try {
    const res = await sendEmail({
      to: email,
      subject,
      html,
      replyTo: "andrew@fuze47.com",
    });
    emailDispatched = !!res?.ok;
  } catch (e) {
    console.error("[org-invitations] email send failed:", e);
  }

  return {
    invitationId: invitation.id,
    token: invitation.token,
    acceptUrl,
    emailDispatched,
    preExisting,
  };
}

/** Revoke a PENDING invitation. Idempotent; no-op if already non-PENDING. */
export async function revokeOrgInvitation(
  invitationId: string,
  revokedByUserId: string,
): Promise<{ revoked: boolean }> {
  try {
    const result = await prisma.orgInvitation.updateMany({
      where: { id: invitationId, status: "PENDING" },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByUserId,
      },
    });
    return { revoked: result.count > 0 };
  } catch (e) {
    console.warn("[org-invitations] revoke failed:", e);
    return { revoked: false };
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

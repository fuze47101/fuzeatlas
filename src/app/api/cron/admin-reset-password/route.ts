// @ts-nocheck
/**
 * POST /api/cron/admin-reset-password
 *
 * Bearer-authed one-shot user recovery. Body:
 *   {
 *     email: string,           // existing email — used as lookup
 *     newPassword?: string,    // optional — reset password if provided
 *     newEmail?: string,       // optional — fix typo'd email if provided
 *     activate?: boolean,      // optional — flip status to ACTIVE
 *   }
 *
 * Use cases:
 *   - Password reset: {email, newPassword}
 *   - Email typo fix: {email, newEmail}  (e.g. any.lu → jany.lu)
 *   - Activate stuck-in-PENDING account: {email, activate: true}
 *   - All three at once for full account recovery.
 *
 * At least ONE of newPassword / newEmail / activate must be present.
 *
 * Built 2026-05-22 to support Jany Lu's account recovery — original
 * account was created as any.lu@charmingfabrics.com (typo, missing
 * "j"). This endpoint corrects it + resets the password in one call.
 *
 * Run:
 *   fzcron admin-reset-password -X POST \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"any.lu@charmingfabrics.com","newEmail":"jany.lu@charmingfabrics.com","newPassword":"fuze47","activate":true}'
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const CRON_SECRET = process.env.CRON_SECRET;
const MIN_PASSWORD_LENGTH = 6; // matches /api/auth/register; invitation flow requires 8

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const newPassword = body.newPassword ? body.newPassword.toString() : "";
  const newEmail = body.newEmail ? body.newEmail.toString().trim().toLowerCase() : "";
  const activate = body.activate === true;

  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }
  if (!newPassword && !newEmail && !activate) {
    return NextResponse.json(
      { ok: false, error: "At least one of newPassword / newEmail / activate must be provided" },
      { status: 400 },
    );
  }
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json(
      { ok: false, error: `newEmail "${newEmail}" is not a valid email format` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true, role: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: `No user with email "${email}"` },
      { status: 404 },
    );
  }

  // If updating email, make sure the new email isn't already taken.
  if (newEmail && newEmail !== email) {
    const collision = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true, email: true },
    });
    if (collision) {
      return NextResponse.json(
        {
          ok: false,
          error: `Email "${newEmail}" is already taken by user ${collision.id}. Resolve the collision before retrying.`,
        },
        { status: 409 },
      );
    }
  }

  const updates: any = { updatedAt: new Date() };
  const actions: string[] = [];
  if (newPassword) {
    updates.password = await hashPassword(newPassword);
    actions.push("password-reset");
  }
  if (newEmail && newEmail !== email) {
    updates.email = newEmail;
    actions.push(`email-changed (${email} → ${newEmail})`);
  }
  if (activate && user.status !== "ACTIVE") {
    updates.status = "ACTIVE";
    actions.push("status-flipped-to-ACTIVE");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { id: true, email: true, name: true, status: true, role: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    user: updated,
    actions,
    verdict: `✓ Updated user ${updated.id} (${updated.email}). ${actions.length > 0 ? actions.join(" · ") : "No-op."}`,
  });
}

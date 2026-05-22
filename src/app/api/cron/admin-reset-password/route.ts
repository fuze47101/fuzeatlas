// @ts-nocheck
/**
 * POST /api/cron/admin-reset-password
 *
 * Bearer-authed one-shot password reset. Body:
 *   { email: string, newPassword: string, activate?: boolean }
 *
 * If activate=true and the user.status is not ACTIVE, also flips to
 * ACTIVE. Useful for fixing stuck-in-PENDING accounts.
 *
 * Built 2026-05-22 to support Jany Lu's account recovery and any
 * future admin-side password resets where the user can't log in to
 * do it themselves (no working session, no email reset link, etc.).
 *
 * Run:
 *   fzcron admin-reset-password -X POST \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"jany.lu@charmingfabrics.com","newPassword":"fuze47","activate":true}'
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
  const newPassword = (body.newPassword || "").toString();
  const activate = body.activate === true;

  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters`,
      },
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

  const hash = await hashPassword(newPassword);
  const updates: any = { password: hash, updatedAt: new Date() };
  let activated = false;
  if (activate && user.status !== "ACTIVE") {
    updates.status = "ACTIVE";
    activated = true;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { id: true, email: true, name: true, status: true, role: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    user: updated,
    actions: [
      "password-reset",
      activated ? "status-flipped-to-ACTIVE" : null,
    ].filter(Boolean),
    verdict: `✓ Password reset for ${updated.email}. New login should work immediately.${activated ? " Account activated." : ""}`,
  });
}

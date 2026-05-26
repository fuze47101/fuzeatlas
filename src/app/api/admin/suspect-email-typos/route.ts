// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeSuspects, normalizeEmail } from "@/lib/suspect-email-typos";

/**
 * GET /api/admin/suspect-email-typos
 *
 * Phase 16.6 T4 — surfaces the same dataset as
 * /api/cron/diag-similar-emails, scoped to the admin UI and filtered
 * by SimilarEmailIgnore rows so already-reviewed false-positive pairs
 * stop appearing.
 *
 * POST /api/admin/suspect-email-typos
 * Body: { action: "ignore" | "fix-email" | "confirm-match", ... }
 *   - ignore        { userId, contactEmail, reason? }
 *   - fix-email     { userId, newEmail }
 *   - confirm-match { userId, contactId }   (links the user to the contact)
 *
 * Read path delegates to src/lib/suspect-email-typos.ts so the badge
 * count + weekly cron can't drift from what the page shows.
 */

const normalize = normalizeEmail;

export async function GET(_req: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  const results = await computeSuspects();
  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  if (action === "ignore") {
    const userId = String(body?.userId || "");
    const contactEmail = normalize(body?.contactEmail);
    if (!userId || !contactEmail) {
      return NextResponse.json({ ok: false, error: "userId + contactEmail required" }, { status: 400 });
    }
    try {
      const row = await (prisma as any).similarEmailIgnore.upsert({
        where: { userId_contactEmail: { userId, contactEmail } },
        create: {
          userId, contactEmail,
          ignoredById: user.id,
          reason: body?.reason || null,
        },
        update: { ignoredById: user.id, reason: body?.reason || null },
      });
      return NextResponse.json({ ok: true, ignored: row });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "ignore failed" }, { status: 500 });
    }
  }

  if (action === "fix-email") {
    const userId = String(body?.userId || "");
    const newEmail = String(body?.newEmail || "").trim().toLowerCase();
    if (!userId || !newEmail || !/.+@.+\..+/.test(newEmail)) {
      return NextResponse.json({ ok: false, error: "userId + valid newEmail required" }, { status: 400 });
    }
    const collision = await prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: userId } },
      select: { id: true, email: true },
    });
    if (collision) {
      return NextResponse.json({
        ok: false, error: `Email already in use by user ${collision.id}`,
      }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ ok: true, updated });
  }

  if (action === "confirm-match") {
    const userId = String(body?.userId || "");
    const contactId = String(body?.contactId || "");
    if (!userId || !contactId) {
      return NextResponse.json({ ok: false, error: "userId + contactId required" }, { status: 400 });
    }
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, email: true, brandId: true, factoryId: true, distributorId: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    // Pin the user to the contact's owning entity if not yet pinned.
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { brandId: true, factoryId: true, distributorId: true },
    });
    const data: any = {};
    if (contact.brandId && !userRow?.brandId) data.brandId = contact.brandId;
    if (contact.factoryId && !userRow?.factoryId) data.factoryId = contact.factoryId;
    if (contact.distributorId && !userRow?.distributorId) data.distributorId = contact.distributorId;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }
    // Auto-ignore the pair too so it stops surfacing.
    try {
      await (prisma as any).similarEmailIgnore.upsert({
        where: { userId_contactEmail: { userId, contactEmail: normalize(contact.email) } },
        create: {
          userId,
          contactEmail: normalize(contact.email),
          ignoredById: user.id,
          reason: "confirmed-match",
        },
        update: { ignoredById: user.id, reason: "confirmed-match" },
      });
    } catch {}
    return NextResponse.json({ ok: true, linked: data });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

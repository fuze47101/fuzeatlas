// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
 * Returns the same payload shape as diag-similar-emails (results
 * array). The page polls this endpoint on load.
 */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return 99;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

const normalize = (s: any) => String(s || "").trim().toLowerCase();
const MAX_DISTANCE = 2;

async function computeSuspects() {
  const [users, contacts, ignores] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", email: { not: null } },
      select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true },
    }),
    prisma.contact.findMany({
      where: { email: { not: null } },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        brandId: true, factoryId: true, distributorId: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
    }),
    (prisma as any).similarEmailIgnore?.findMany({
      select: { userId: true, contactEmail: true },
    }).catch(() => []) ?? [],
  ]);

  const ignoreSet = new Set<string>(
    (ignores || []).map((r: any) => `${r.userId}::${normalize(r.contactEmail)}`)
  );

  const results: any[] = [];
  for (const u of users) {
    const userEmail = normalize(u.email);
    if (!userEmail) continue;
    const suspects: any[] = [];
    for (const c of contacts) {
      const contactEmail = normalize(c.email);
      if (!contactEmail || contactEmail === userEmail) continue;
      if (ignoreSet.has(`${u.id}::${contactEmail}`)) continue;
      const d = levenshtein(userEmail, contactEmail);
      if (d > 0 && d <= MAX_DISTANCE) {
        suspects.push({
          contactId: c.id,
          contactEmail: c.email,
          contactName: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
          source: c.brandId ? "brand" : c.factoryId ? "factory" : c.distributorId ? "distributor" : "orphan",
          sourceName: c.brand?.name || c.factory?.name || null,
          distance: d,
        });
      }
    }
    if (suspects.length > 0) {
      results.push({
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt,
          emailVerified: u.emailVerified,
        },
        suspects: suspects.sort((a, b) => a.distance - b.distance).slice(0, 5),
      });
    }
  }
  return results;
}

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

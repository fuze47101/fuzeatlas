// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/diag-similar-emails
 *
 * T9 of phase 16 — catches typo accounts BEFORE the user can't log in.
 * Complement to T8 (verification email).
 *
 * For every active User, scans Brand contacts AND Factory contacts
 * for any contact email within Levenshtein distance ≤ 2 of the user's
 * email (and not an exact match — we don't flag self-matches with the
 * same person's real contact record).
 *
 * Returns { user, suspects: [{ source, contactId, contactEmail,
 * distance }] }. Caller (Andrew, weekly digest) reviews + decides
 * whether to fix.
 *
 * Bearer-authed via CRON_SECRET.
 */

const CRON_SECRET = process.env.CRON_SECRET;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Quick reject: if length delta > MAX_DISTANCE, distance > MAX.
  if (Math.abs(m - n) > 3) return 99;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function normalize(s: string | null | undefined): string {
  return String(s || "").trim().toLowerCase();
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const MAX_DISTANCE = parseInt(url.searchParams.get("maxDistance") || "2", 10);
  const onlyUnverified = url.searchParams.get("unverifiedOnly") === "1";

  const userFilter: any = { status: "ACTIVE" };
  if (onlyUnverified) {
    userFilter.emailVerified = false;
  }

  const [users, contacts] = await Promise.all([
    prisma.user.findMany({
      where: userFilter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        emailVerifiedAt: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
      },
    }),
    prisma.contact.findMany({
      where: { email: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
      },
    }),
  ]);

  const results: any[] = [];
  for (const u of users) {
    const userEmail = normalize(u.email);
    if (!userEmail) continue;
    const suspects: any[] = [];
    for (const c of contacts) {
      const contactEmail = normalize(c.email);
      if (!contactEmail || contactEmail === userEmail) continue;
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
          ageDays: Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000),
        },
        suspects: suspects.sort((a, b) => a.distance - b.distance).slice(0, 5),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    verdict: results.length === 0
      ? "No suspect typo emails detected."
      : `${results.length} user(s) have a contact email within distance ${MAX_DISTANCE}.`,
    summary: {
      usersScanned: users.length,
      contactsScanned: contacts.length,
      suspectsFound: results.length,
      maxDistance: MAX_DISTANCE,
    },
    results,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

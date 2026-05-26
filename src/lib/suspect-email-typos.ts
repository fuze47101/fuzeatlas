// @ts-nocheck
import { prisma } from "@/lib/prisma";

/**
 * Shared helper for Phase 16.6 T4 suspect-email-typo detection.
 *
 * Same Levenshtein-distance-2 pairing used by:
 *   - /api/admin/suspect-email-typos    (admin review page data feed)
 *   - /api/admin/pending-counts         (sidebar badge count)
 *   - /api/cron/weekly-suspect-email-scan (Monday digest)
 *
 * Single source of truth so the badge count, the admin page, and the
 * weekly digest can't drift on filter semantics.
 */

export const MAX_DISTANCE = 2;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return 99;
  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);
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

export const normalizeEmail = (s: any): string =>
  String(s || "").trim().toLowerCase();

export interface SuspectRow {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: Date;
    emailVerified: boolean;
  };
  suspects: Array<{
    contactId: string;
    contactEmail: string;
    contactName: string | null;
    source: "brand" | "factory" | "distributor" | "orphan";
    sourceName: string | null;
    distance: number;
  }>;
}

/**
 * Full suspect list with the per-user nested suspect details (powers
 * the admin review page).
 */
export async function computeSuspects(): Promise<SuspectRow[]> {
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
    (ignores || []).map((r: any) => `${r.userId}::${normalizeEmail(r.contactEmail)}`),
  );

  const results: SuspectRow[] = [];
  for (const u of users) {
    const userEmail = normalizeEmail(u.email);
    if (!userEmail) continue;
    const suspects: SuspectRow["suspects"] = [];
    for (const c of contacts) {
      const contactEmail = normalizeEmail(c.email);
      if (!contactEmail || contactEmail === userEmail) continue;
      if (ignoreSet.has(`${u.id}::${contactEmail}`)) continue;
      const d = levenshtein(userEmail, contactEmail);
      if (d > 0 && d <= MAX_DISTANCE) {
        suspects.push({
          contactId: c.id,
          contactEmail: c.email!,
          contactName: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
          source: c.brandId
            ? "brand"
            : c.factoryId
            ? "factory"
            : c.distributorId
            ? "distributor"
            : "orphan",
          sourceName: c.brand?.name || c.factory?.name || null,
          distance: d,
        });
      }
    }
    if (suspects.length > 0) {
      results.push({
        user: {
          id: u.id,
          email: u.email!,
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

/**
 * Cheap-ish count: number of distinct users with at least one suspect
 * contact email (after SimilarEmailIgnore filtering). Used by the
 * sidebar badge — short-circuits on the first suspect per user to
 * keep the worst case bounded.
 */
export async function countSuspectPairs(): Promise<number> {
  try {
    const [users, contacts, ignores] = await Promise.all([
      prisma.user.findMany({
        where: { status: "ACTIVE", email: { not: null } },
        select: { id: true, email: true },
      }),
      prisma.contact.findMany({
        where: { email: { not: null } },
        select: { email: true },
      }),
      (prisma as any).similarEmailIgnore?.findMany({
        select: { userId: true, contactEmail: true },
      }).catch(() => []) ?? [],
    ]);

    const ignoreSet = new Set<string>(
      (ignores || []).map((r: any) => `${r.userId}::${normalizeEmail(r.contactEmail)}`),
    );
    const contactEmails = contacts
      .map((c: any) => normalizeEmail(c.email))
      .filter(Boolean);

    let count = 0;
    for (const u of users) {
      const ue = normalizeEmail(u.email);
      if (!ue) continue;
      for (const ce of contactEmails) {
        if (ce === ue) continue;
        if (ignoreSet.has(`${u.id}::${ce}`)) continue;
        const d = levenshtein(ue, ce);
        if (d > 0 && d <= MAX_DISTANCE) {
          count++;
          break; // one suspect per user is enough for the badge
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

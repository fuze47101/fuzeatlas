/**
 * My Book — the per-person account book and the weekly check-in.
 *
 * An "account" is a Brand, Factory or Distributor that a person is
 * responsible for. Ownership comes from two places, unioned:
 *   1. EntityManager rows (entityType/entityId/userId) — the book of record
 *   2. Brand.salesRepId / Factory.salesRepId — the legacy BD claim
 * Reading both means nobody loses an account on day one; writing always goes
 * to EntityManager.
 *
 * Visibility:
 *   - ADMIN / EMPLOYEE / SALES_MANAGER (internal): may read anyone's book.
 *   - A user attached to a distributor (Hi-Goal reps): own book only, unless
 *     they hold an EntityManager row with role DISTRIBUTOR_LEAD on their own
 *     distributor (Cynthia), in which case they see every book under it.
 *   - Everyone else: own book only.
 */
import { prisma } from "@/lib/prisma";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/auth";

export type EntityType = "BRAND" | "FACTORY" | "DISTRIBUTOR";
export type CheckinKind = "NONE" | "UPDATE" | "SUPER" | "HELP";

export const INTERNAL_ROLES: any[] = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];
export const MANAGER_ROLES: any[] = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

/** Monday 00:00 UTC of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

/** The Friday 23:59 UTC that ends the week of `weekOf` + `weeks` ahead. */
export function fridayAfter(weekOf: Date, weeks = 1): Date {
  const f = new Date(weekOf);
  f.setUTCDate(f.getUTCDate() + 4 + 7 * (weeks - 1));
  f.setUTCHours(23, 59, 0, 0);
  return f;
}

export interface BookAccount {
  entityType: EntityType;
  entityId: string;
  name: string;
  country: string | null;
  stage: string | null;
  forecastQuarter: string | null;
  galaLead: boolean;
  primaryContact: string | null;
  isPrimary: boolean;
  /** last touch of any kind written through the book */
  lastCheckinAt: Date | null;
  lastCheckinKind: CheckinKind | null;
  /** last touch that carried content (UPDATE/SUPER/HELP) or legacy lastActivityAt */
  lastRealTouchAt: Date | null;
  lastNote: string | null;
  nextStep: string | null;
  nextStepAt: Date | null;
  /** consecutive weeks of NONE (or nothing) since the last real touch */
  silentWeeks: number;
  checkedInThisWeek: boolean;
  openHelp: number;
  attention: "ok" | "amber" | "red";
}

export async function canReadBook(viewer: SessionUser, targetUserId: string): Promise<boolean> {
  if (viewer.id === targetUserId) return true;
  if (MANAGER_ROLES.includes(viewer.role)) return true;
  if (viewer.distributorId) {
    const lead = await prisma.entityManager.findFirst({
      where: {
        entityType: "DISTRIBUTOR",
        entityId: viewer.distributorId,
        userId: viewer.id,
        role: "DISTRIBUTOR_LEAD",
      },
      select: { id: true },
    });
    if (!lead) return false;
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { distributorId: true },
    });
    return target?.distributorId === viewer.distributorId;
  }
  return false;
}

/** Users whose books the viewer may open (for the manager switcher). */
export async function visibleBookOwners(viewer: SessionUser) {
  if (MANAGER_ROLES.includes(viewer.role)) {
    return prisma.user.findMany({
      where: { status: "ACTIVE", role: { in: [...INTERNAL_ROLES, "DISTRIBUTOR_USER"] as any } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        distributorId: true,
        timezone: true,
      },
      orderBy: { name: "asc" },
    });
  }
  if (viewer.distributorId) {
    const lead = await prisma.entityManager.findFirst({
      where: {
        entityType: "DISTRIBUTOR",
        entityId: viewer.distributorId,
        userId: viewer.id,
        role: "DISTRIBUTOR_LEAD",
      },
      select: { id: true },
    });
    if (lead) {
      return prisma.user.findMany({
        where: { status: "ACTIVE", distributorId: viewer.distributorId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          distributorId: true,
          timezone: true,
        },
        orderBy: { name: "asc" },
      });
    }
  }
  const me = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { id: true, name: true, email: true, role: true, distributorId: true, timezone: true },
  });
  return me ? [me] : [];
}

/** Raw ownership for one user: primary EntityManager rows ∪ legacy salesRepId.
 *  Non-primary (SUPPORT) rows are visible on the account card but do not put
 *  the account in that person's Friday queue. */
export async function ownedEntityKeys(
  userId: string,
): Promise<Array<{ entityType: EntityType; entityId: string; isPrimary: boolean }>> {
  const [em, brands, factories] = await Promise.all([
    prisma.entityManager.findMany({
      where: { userId, entityType: { in: ["BRAND", "FACTORY", "DISTRIBUTOR"] }, isPrimary: true },
      select: { entityType: true, entityId: true, isPrimary: true },
    }),
    // Legacy claims count only once a brand is past LEAD — a LEAD enters a book when someone adds it on purpose.
    prisma.brand.findMany({
      where: { salesRepId: userId, pipelineStage: { notIn: ["ARCHIVE", "LEAD"] } },
      select: { id: true },
    }),
    prisma.factory.findMany({ where: { salesRepId: userId }, select: { id: true } }),
  ]);
  const map = new Map<string, { entityType: EntityType; entityId: string; isPrimary: boolean }>();
  for (const r of em)
    map.set(`${r.entityType}:${r.entityId}`, {
      entityType: r.entityType as EntityType,
      entityId: r.entityId,
      isPrimary: r.isPrimary,
    });
  for (const b of brands)
    if (!map.has(`BRAND:${b.id}`))
      map.set(`BRAND:${b.id}`, { entityType: "BRAND", entityId: b.id, isPrimary: true });
  for (const f of factories)
    if (!map.has(`FACTORY:${f.id}`))
      map.set(`FACTORY:${f.id}`, { entityType: "FACTORY", entityId: f.id, isPrimary: true });
  return [...map.values()];
}

function weeksBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (7 * 24 * 3600 * 1000)));
}

export async function getBook(userId: string, now = new Date()): Promise<BookAccount[]> {
  const keys = await ownedEntityKeys(userId);
  if (!keys.length) return [];
  const thisWeek = mondayOf(now);

  const brandIds = keys.filter((k) => k.entityType === "BRAND").map((k) => k.entityId);
  const factoryIds = keys.filter((k) => k.entityType === "FACTORY").map((k) => k.entityId);
  const distIds = keys.filter((k) => k.entityType === "DISTRIBUTOR").map((k) => k.entityId);

  const [brands, factories, dists, checkins, help] = await Promise.all([
    brandIds.length
      ? prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: {
            id: true,
            name: true,
            pipelineStage: true,
            forecastQuarter: true,
            galaLead: true,
            lastActivityAt: true,
            researchData: true,
            contacts: { where: { isPrimary: true }, take: 1, select: { name: true } },
          },
        })
      : [],
    factoryIds.length
      ? prisma.factory.findMany({
          where: { id: { in: factoryIds } },
          select: {
            id: true,
            name: true,
            country: true,
            pipelineStage: true,
            forecastQuarter: true,
            galaLead: true,
            lastActivityAt: true,
            contacts: { where: { isPrimary: true }, take: 1, select: { name: true } },
          },
        })
      : [],
    distIds.length
      ? prisma.distributor.findMany({
          where: { id: { in: distIds } },
          select: { id: true, name: true, country: true },
        })
      : [],
    prisma.accountCheckin.findMany({
      where: {
        OR: [
          ...(brandIds.length ? [{ entityType: "BRAND", entityId: { in: brandIds } }] : []),
          ...(factoryIds.length ? [{ entityType: "FACTORY", entityId: { in: factoryIds } }] : []),
          ...(distIds.length ? [{ entityType: "DISTRIBUTOR", entityId: { in: distIds } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        entityType: true,
        entityId: true,
        kind: true,
        createdAt: true,
        weekOf: true,
        note: true,
        headline: true,
        nextStep: true,
        nextStepAt: true,
      },
    }),
    prisma.helpRequest.groupBy({
      by: ["entityType", "entityId"],
      where: { status: { in: ["OPEN", "ACKED", "ESCALATED"] } },
      _count: { _all: true },
    }),
  ]);

  const helpMap = new Map(help.map((h) => [`${h.entityType}:${h.entityId}`, h._count._all]));
  const byEntity = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const k = `${c.entityType}:${c.entityId}`;
    if (!byEntity.has(k)) byEntity.set(k, []);
    byEntity.get(k)!.push(c);
  }

  const out: BookAccount[] = [];
  const build = (
    entityType: EntityType,
    id: string,
    name: string,
    country: string | null,
    stage: string | null,
    forecastQuarter: string | null,
    galaLead: boolean,
    lastActivityAt: Date | null,
    primaryContact: string | null,
  ) => {
    const key = `${entityType}:${id}`;
    const own = keys.find((k) => k.entityType === entityType && k.entityId === id);
    const list = byEntity.get(key) || [];
    const last = list[0] || null;
    const lastReal = list.find((c) => c.kind !== "NONE") || null;
    const lastRealTouchAt = lastReal?.createdAt || lastActivityAt || null;
    const silentWeeks = lastRealTouchAt
      ? weeksBetween(mondayOf(lastRealTouchAt), thisWeek)
      : last
        ? weeksBetween(mondayOf(last.createdAt), thisWeek) + 1
        : 99;
    const withNext = list.find((c) => c.nextStep) || null;
    out.push({
      entityType,
      entityId: id,
      name,
      country,
      stage,
      forecastQuarter,
      galaLead,
      primaryContact,
      isPrimary: own?.isPrimary ?? true,
      lastCheckinAt: last?.createdAt || null,
      lastCheckinKind: (last?.kind as CheckinKind) || null,
      lastRealTouchAt,
      lastNote: lastReal?.headline || lastReal?.note || null,
      nextStep: withNext?.nextStep || null,
      nextStepAt: withNext?.nextStepAt || null,
      silentWeeks,
      checkedInThisWeek: !!last && last.weekOf.getTime() === thisWeek.getTime(),
      openHelp: helpMap.get(key) || 0,
      attention: silentWeeks >= 4 ? "red" : silentWeeks >= 2 ? "amber" : "ok",
    });
  };

  for (const b of brands) {
    const country = (b.researchData as any)?.hubspotLocation?.split(",").pop()?.trim() || null;
    build(
      "BRAND",
      b.id,
      b.name,
      country,
      b.pipelineStage,
      b.forecastQuarter,
      b.galaLead,
      b.lastActivityAt,
      b.contacts[0]?.name || null,
    );
  }
  for (const f of factories)
    build(
      "FACTORY",
      f.id,
      f.name,
      f.country,
      f.pipelineStage,
      f.forecastQuarter,
      f.galaLead,
      f.lastActivityAt,
      f.contacts[0]?.name || null,
    );
  for (const d of dists)
    build("DISTRIBUTOR", d.id, d.name, d.country, null, null, false, null, null);

  // Needs-attention first: not yet checked in this week, then most silent,
  // then nearest next step, then name.
  out.sort((a, b) => {
    if (a.checkedInThisWeek !== b.checkedInThisWeek) return a.checkedInThisWeek ? 1 : -1;
    if (a.openHelp !== b.openHelp) return b.openHelp - a.openHelp;
    if (a.silentWeeks !== b.silentWeeks) return b.silentWeeks - a.silentWeeks;
    const an = a.nextStepAt?.getTime() ?? Infinity,
      bn = b.nextStepAt?.getTime() ?? Infinity;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });
  return out;
}

/* ── Magic link: one click from the Friday email into the wizard ──────── */
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fuze-atlas-dev-secret-change-in-production",
);

export async function createBookLinkToken(userId: string, days = 10): Promise<string> {
  return new SignJWT({ sub: userId, purpose: "book" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(SECRET);
}

export async function verifyBookLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== "book" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fuzeatlas.com")
  );
}

/** 8am local for a user → true if `now` is inside that hour in their zone. */
export function isLocalHour(now: Date, timezone: string | null | undefined, hour: number): boolean {
  const tz = timezone || "America/Denver";
  try {
    const h = Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(
        now,
      ),
    );
    return h % 24 === hour;
  } catch {
    return now.getUTCHours() === 15; // 8am Denver fallback
  }
}

export function entityHref(entityType: EntityType, id: string): string {
  if (entityType === "BRAND") return `/brands/${id}`;
  if (entityType === "FACTORY") return `/factories/${id}`;
  return `/admin/distributors`;
}

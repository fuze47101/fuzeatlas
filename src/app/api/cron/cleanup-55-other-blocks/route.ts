// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/cleanup-55-other-blocks?meetingId=<id>
 *
 * Phase 55 follow-up — for a single meeting, walks every
 * MeetingProjectBlock whose customerType is OTHER and:
 *
 *  1. Tries to resolve `internalLabel` against the Brand table
 *     (exact insensitive → prefix → contains, in that order). If
 *     exactly one match lands, flips the block to BRAND.
 *  2. Falls back to Factory the same way.
 *  3. Re-runs owner resolution. The original backfill skipped
 *     ambiguous first-name matches; this pass adds a preference rule:
 *     when @firstname matches more than one active user, prefer the
 *     one whose email domain ends in `@fuze47.com` (canonical FUZE
 *     account). Andrew → andrew@fuze47.com, Scott → scott@fuze47.com,
 *     etc. Real ambiguity (two same-first-name fuze47 accounts) still
 *     stays unset and is reported.
 *
 * Idempotent — running twice is a no-op for blocks already resolved.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

const FIRST_NAMES = /@(\w+)/g;

async function pickBrand(label: string) {
  const exact = await (prisma as any).brand.findFirst({
    where: { name: { equals: label, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (exact) return [exact];
  const prefix = await (prisma as any).brand.findMany({
    where: { name: { startsWith: label, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  if (prefix.length > 0) return prefix;
  const contains = await (prisma as any).brand.findMany({
    where: { name: { contains: label, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  return contains;
}

async function pickFactory(label: string) {
  const exact = await (prisma as any).factory.findFirst({
    where: { name: { equals: label, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (exact) return [exact];
  const prefix = await (prisma as any).factory.findMany({
    where: { name: { startsWith: label, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  if (prefix.length > 0) return prefix;
  const contains = await (prisma as any).factory.findMany({
    where: { name: { contains: label, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  return contains;
}

function firstMentionUserId(
  text: string,
  users: Array<{ id: string; name: string | null; email: string | null }>,
): { ownerId: string | null; ambiguousTag: string | null } {
  for (const m of text.matchAll(FIRST_NAMES)) {
    const tag = String(m[1] || "").toLowerCase();
    if (!tag) continue;
    const matches = users.filter((u) => {
      const first = String(u.name || "").split(/\s+/)[0]?.toLowerCase();
      const local = String(u.email || "").split("@")[0]?.toLowerCase();
      return first === tag || local === tag;
    });
    if (matches.length === 1) return { ownerId: matches[0].id, ambiguousTag: null };
    if (matches.length > 1) {
      // Disambiguation rule: prefer @fuze47.com account.
      const fuze47 = matches.filter((u) => /@fuze47\.com$/i.test(u.email || ""));
      if (fuze47.length === 1) return { ownerId: fuze47[0].id, ambiguousTag: null };
      // Still ambiguous — report the tag.
      return { ownerId: null, ambiguousTag: tag };
    }
  }
  return { ownerId: null, ambiguousTag: null };
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meetingId required" }, { status: 400 });
  }

  const meeting = await (prisma as any).meetingNote.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true },
  });
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "MeetingNote not found" }, { status: 404 });
  }

  const blocks = await (prisma as any).meetingProjectBlock.findMany({
    where: { meetingNoteId: meetingId },
    select: {
      id: true,
      customerType: true,
      internalLabel: true,
      brandId: true,
      factoryId: true,
      ownerId: true,
      discussionMd: true,
    },
  });

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });

  const customerFlips: any[] = [];
  const ambiguousLabels: any[] = [];
  const ownerFlips: any[] = [];

  for (const b of blocks) {
    // Customer-type resolution for OTHER blocks.
    if (b.customerType === "OTHER" && b.internalLabel) {
      const brandMatches = await pickBrand(b.internalLabel);
      if (brandMatches.length === 1) {
        await (prisma as any).meetingProjectBlock.update({
          where: { id: b.id },
          data: {
            customerType: "BRAND",
            brandId: brandMatches[0].id,
            internalLabel: null,
          },
        });
        customerFlips.push({
          blockId: b.id,
          label: b.internalLabel,
          newType: "BRAND",
          newId: brandMatches[0].id,
          newName: brandMatches[0].name,
        });
        continue;
      }
      const factoryMatches = await pickFactory(b.internalLabel);
      if (factoryMatches.length === 1) {
        await (prisma as any).meetingProjectBlock.update({
          where: { id: b.id },
          data: {
            customerType: "FACTORY",
            factoryId: factoryMatches[0].id,
            internalLabel: null,
          },
        });
        customerFlips.push({
          blockId: b.id,
          label: b.internalLabel,
          newType: "FACTORY",
          newId: factoryMatches[0].id,
          newName: factoryMatches[0].name,
        });
        continue;
      }
      ambiguousLabels.push({
        blockId: b.id,
        label: b.internalLabel,
        brandCandidates: brandMatches.map((x) => x.name),
        factoryCandidates: factoryMatches.map((x) => x.name),
      });
    }

    // Owner resolution for blocks with no owner.
    if (!b.ownerId && b.discussionMd) {
      const { ownerId, ambiguousTag } = firstMentionUserId(b.discussionMd, users);
      if (ownerId) {
        await (prisma as any).meetingProjectBlock.update({
          where: { id: b.id },
          data: { ownerId },
        });
        ownerFlips.push({ blockId: b.id, ownerId, resolvedTag: "first @-mention" });
      } else if (ambiguousTag) {
        ownerFlips.push({ blockId: b.id, ambiguousTag, ownerId: null });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    meetingTitle: meeting.title,
    blocksScanned: blocks.length,
    customerFlips,
    customerFlipsCount: customerFlips.length,
    ambiguousLabels,
    ambiguousLabelsCount: ambiguousLabels.length,
    ownerFlips,
    ownerFlipsCount: ownerFlips.filter((o) => o.ownerId).length,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;

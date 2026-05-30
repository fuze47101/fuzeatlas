// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/backfill-55-monday-meeting?meetingId=<id>
 *
 * Phase 55 — convert the seeded Monday Global Meeting's free-text
 * `notesMd` (markdown with `**Section**` headers) into structured
 * MeetingProjectBlock rows, then re-attach existing MeetingActionItem
 * rows by parser-position to their bucket via projectBlockId.
 *
 * For each `**Header — ...**` section, the cron:
 *   1. Strips priority phrases from the header to derive the
 *      project name and the priority band (A/B/C/D).
 *   2. Looks up the brand by name (BRAND customer-type when found),
 *      otherwise tries factory, otherwise OTHER (internal label).
 *   3. Picks the first @-mention in the section as block owner.
 *   4. Stores the section bullets as discussionMd.
 *   5. Re-attaches existing MeetingActionItem rows whose sourceEntry
 *      starts in this section.
 *
 * Idempotent — won't double-create if the meeting already has any
 * MeetingProjectBlock rows unless `?force=1` is passed.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

function priorityFromHeader(header: string): "A" | "B" | "C" | null {
  const upper = header.toUpperCase();
  if (/PRIORITY\s*1|URGENT|P1|ASAP/.test(upper)) return "A";
  if (/PRIORITY\s*2|HIGH/.test(upper)) return "B";
  if (/PRIORITY\s*3|LOW/.test(upper)) return "C";
  return null;
}
function stripPriorityFromHeader(header: string): string {
  return header
    .replace(/\s*[—\-—]\s*Priority\s*\d.*$/i, "")
    .replace(/\s*[—\-—]\s*URGENT.*$/i, "")
    .replace(/\s*[—\-—]\s*HIGH PRIORITY.*$/i, "")
    .replace(/\s*\(URGENT\)/i, "")
    .replace(/\s*\(HIGH\)/i, "")
    .trim();
}

type Section = {
  headerRaw: string;
  headerClean: string;
  priority: "A" | "B" | "C" | "D" | null;
  body: string[];
};

function parseSections(notesMd: string): Section[] {
  const lines = notesMd.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    const headerRaw = boldMatch ? boldMatch[1] : headingMatch ? headingMatch[1] : null;

    // Skip stamp lines like `**[Andrew Peterson, 2026-05-27 12:30]**`.
    const isStamp = headerRaw && /^\[.+\]$/.test(headerRaw);
    // Skip lines that contain @ — they're action items, not headers.
    const isActionLike = headerRaw && /@/.test(headerRaw);

    if (headerRaw && !isStamp && !isActionLike) {
      if (current) sections.push(current);
      current = {
        headerRaw,
        headerClean: stripPriorityFromHeader(headerRaw),
        priority: priorityFromHeader(headerRaw),
        body: [],
      };
      continue;
    }

    if (current) current.body.push(line);
    // Lines before the first header are dropped.
  }
  if (current) sections.push(current);

  // Default priority C for sections without an explicit hint.
  for (const s of sections) {
    if (!s.priority) s.priority = "C";
  }
  return sections;
}

const FIRST_NAMES = /@(\w+)/g;

function firstMentionedUserId(
  section: Section,
  users: Array<{ id: string; name: string | null; email: string | null }>,
): string | null {
  const text = section.body.join("\n");
  for (const m of text.matchAll(FIRST_NAMES)) {
    const tag = String(m[1] || "").toLowerCase();
    if (!tag) continue;
    // Match by first-name component of name OR email local-part.
    const matches = users.filter((u) => {
      const first = String(u.name || "").split(/\s+/)[0]?.toLowerCase();
      const local = String(u.email || "").split("@")[0]?.toLowerCase();
      return first === tag || local === tag;
    });
    if (matches.length === 1) return matches[0].id;
    // Ambiguous → skip, try next mention.
  }
  return null;
}

async function resolveCustomer(name: string) {
  const brand = await (prisma as any).brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (brand) return { customerType: "BRAND" as const, brandId: brand.id, factoryId: null, internalLabel: null };

  const factory = await (prisma as any).factory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (factory) return { customerType: "FACTORY" as const, brandId: null, factoryId: factory.id, internalLabel: null };

  return { customerType: "OTHER" as const, brandId: null, factoryId: null, internalLabel: name };
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId");
  const force = url.searchParams.get("force") === "1";
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meetingId required" }, { status: 400 });
  }

  const meeting = await (prisma as any).meetingNote.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, notesMd: true },
  });
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "MeetingNote not found" }, { status: 404 });
  }

  const existingBlockCount = await (prisma as any).meetingProjectBlock.count({
    where: { meetingNoteId: meetingId },
  });
  if (existingBlockCount > 0 && !force) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `meeting already has ${existingBlockCount} project blocks. Pass ?force=1 to wipe + rebuild.`,
    });
  }
  if (force && existingBlockCount > 0) {
    // Detach action items from existing blocks first, then drop blocks.
    await (prisma as any).meetingActionItem.updateMany({
      where: { meetingNoteId: meetingId, projectBlockId: { not: null } },
      data: { projectBlockId: null },
    });
    await (prisma as any).meetingProjectBlock.deleteMany({
      where: { meetingNoteId: meetingId },
    });
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });

  const sections = parseSections(meeting.notesMd || "");

  // Pre-fetch action items for the meeting, ordered by createdAt.
  const allItems = await (prisma as any).meetingActionItem.findMany({
    where: { meetingNoteId: meetingId },
    orderBy: { createdAt: "asc" },
    select: { id: true, description: true },
  });

  const createdBlocks: any[] = [];
  let sortOrder = 0;
  let itemCursor = 0;

  for (const s of sections) {
    const resolved = await resolveCustomer(s.headerClean);
    const ownerId = firstMentionedUserId(s, users);

    const block = await (prisma as any).meetingProjectBlock.create({
      data: {
        meetingNoteId: meetingId,
        customerType: resolved.customerType,
        brandId: resolved.brandId,
        factoryId: resolved.factoryId,
        internalLabel: resolved.internalLabel,
        ownerId,
        priority: s.priority,
        sortOrder: sortOrder++,
        discussionMd: s.body.join("\n").trim(),
      },
      select: { id: true, customerType: true, priority: true, ownerId: true },
    });

    // Re-attach action items whose description appears anywhere in
    // this section's body. Walk the cursor forward; an item can only
    // be attached to one block, so order-of-appearance suffices.
    const bodyText = s.body.join("\n");
    const taken: string[] = [];
    while (itemCursor < allItems.length) {
      const item = allItems[itemCursor];
      // Use the first 50 chars of the description as a fingerprint.
      const fingerprint = String(item.description || "").slice(0, 40);
      if (fingerprint && bodyText.includes(fingerprint.slice(0, 30))) {
        taken.push(item.id);
        itemCursor++;
      } else {
        break;
      }
    }
    if (taken.length) {
      await (prisma as any).meetingActionItem.updateMany({
        where: { id: { in: taken } },
        data: { projectBlockId: block.id },
      });
    }

    createdBlocks.push({
      blockId: block.id,
      header: s.headerClean,
      priority: block.priority,
      customerType: block.customerType,
      ownerSet: Boolean(block.ownerId),
      itemsAttached: taken.length,
    });
  }

  const remainingOrphan = await (prisma as any).meetingActionItem.count({
    where: { meetingNoteId: meetingId, projectBlockId: null },
  });

  return NextResponse.json({
    ok: true,
    meetingId,
    meetingTitle: meeting.title,
    sectionsParsed: sections.length,
    blocksCreated: createdBlocks.length,
    remainingOrphanActionItems: remainingOrphan,
    blocks: createdBlocks,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;

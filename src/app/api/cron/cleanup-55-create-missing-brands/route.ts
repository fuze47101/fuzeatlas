// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/cleanup-55-create-missing-brands?meetingId=<id>
 *
 * For each MeetingProjectBlock on the meeting still tagged OTHER
 * with a non-empty internalLabel that isn't a known internal
 * code-name (INTERNAL_LABEL_DENYLIST), creates the corresponding
 * Brand row with sensible defaults and re-links the block to it.
 *
 * Code-named internal projects stay OTHER — those aren't customers,
 * just placeholder tags for sensitive outreach (e.g. "Project Red
 * Rover"). Filtering on the denylist keeps the auto-create path
 * additive and reversible: we only mint brands the conversation
 * already implied were brands.
 *
 * Idempotent — running twice creates nothing new for blocks already
 * linked.
 *
 * Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;

const INTERNAL_LABEL_DENYLIST = [
  /^Project\s+/i, // Project Red Rover, etc.
  /^Internal\s+/i,
  /^FUZE\s+/i,
];

function isInternalCode(label: string): boolean {
  return INTERNAL_LABEL_DENYLIST.some((rx) => rx.test(label));
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

  const blocks = await (prisma as any).meetingProjectBlock.findMany({
    where: { meetingNoteId: meetingId, customerType: "OTHER", internalLabel: { not: null } },
    select: { id: true, internalLabel: true },
  });

  const created: any[] = [];
  const skipped: any[] = [];

  for (const b of blocks) {
    const label = String(b.internalLabel || "").trim();
    if (!label) continue;
    if (isInternalCode(label)) {
      skipped.push({ blockId: b.id, label, reason: "internal code-name" });
      continue;
    }

    // Re-check exact-insensitive match — staircase may have grown.
    const existing = await (prisma as any).brand.findFirst({
      where: { name: { equals: label, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    let brandId: string;
    let brandName: string;
    let didCreate = false;
    if (existing) {
      brandId = existing.id;
      brandName = existing.name;
    } else {
      const brand = await (prisma as any).brand.create({
        data: {
          name: label,
          pipelineStage: "LEAD",
        },
        select: { id: true, name: true },
      });
      brandId = brand.id;
      brandName = brand.name;
      didCreate = true;
    }

    await (prisma as any).meetingProjectBlock.update({
      where: { id: b.id },
      data: {
        customerType: "BRAND",
        brandId,
        internalLabel: null,
      },
    });
    created.push({ blockId: b.id, label, brandId, brandName, didCreateBrand: didCreate });
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    blocksScanned: blocks.length,
    linked: created,
    linkedCount: created.length,
    brandsCreated: created.filter((x) => x.didCreateBrand).length,
    skipped,
    skippedCount: skipped.length,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/link-blocks-to-projects?meetingId=<id>
 *
 * Backfills MeetingProjectBlock.projectId by matching each block on
 * the meeting to a Project row:
 *
 *   1. exact brand match  → block.brandId === project.brandId
 *   2. exact factory match → block.factoryId === project.factoryId
 *   3. label match — block.internalLabel (case-insensitive) ===
 *      project.name
 *
 * Skips blocks already linked. Bearer-authed.
 */
const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_MEETING_ID = "cmpr5ob9i0001jy04k5uyt8ss";

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId") || DEFAULT_MEETING_ID;

  const blocks = await (prisma as any).meetingProjectBlock.findMany({
    where: { meetingNoteId: meetingId, projectId: null },
    select: { id: true, customerType: true, brandId: true, factoryId: true, internalLabel: true },
  });

  const projects = await prisma.project.findMany({
    where: { closedAt: null } as any,
    select: { id: true, name: true, brandId: true, factoryId: true } as any,
  });

  const linked: any[] = [];
  const unmatched: any[] = [];

  for (const b of blocks) {
    let match: any = null;
    if (b.brandId) {
      match = projects.find((p: any) => p.brandId === b.brandId);
    }
    if (!match && b.factoryId) {
      match = projects.find((p: any) => p.factoryId === b.factoryId);
    }
    if (!match && b.internalLabel) {
      const label = b.internalLabel.toLowerCase();
      match = projects.find((p: any) => p.name.toLowerCase() === label);
    }
    if (match) {
      await (prisma as any).meetingProjectBlock.update({
        where: { id: b.id },
        data: { projectId: match.id },
      });
      linked.push({ blockId: b.id, projectId: match.id, projectName: match.name });
    } else {
      unmatched.push({ blockId: b.id, internalLabel: b.internalLabel, brandId: b.brandId, factoryId: b.factoryId });
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    blocksScanned: blocks.length,
    linkedCount: linked.length,
    unmatchedCount: unmatched.length,
    linked,
    unmatched,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 60;

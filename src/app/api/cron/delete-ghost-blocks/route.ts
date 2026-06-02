// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/delete-ghost-blocks?meetingId=<id>
 *
 * Wipes "ghost" MeetingProjectBlock rows on a meeting — rows that
 * were created during the addBlock diagnostic clicks tonight and
 * have no real content yet. Fingerprint:
 *
 *   customerType === "OTHER"
 *   internalLabel IS NULL
 *   discussionMd === ""
 *   no actionItems attached
 *
 * Bearer-authed.
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

  const candidates = await (prisma as any).meetingProjectBlock.findMany({
    where: {
      meetingNoteId: meetingId,
      customerType: "OTHER",
      internalLabel: null,
      discussionMd: "",
    },
    select: {
      id: true,
      createdAt: true,
      _count: { select: { actionItems: true } },
    },
  });

  const toDelete = candidates.filter((c: any) => c._count.actionItems === 0);
  const ids = toDelete.map((c: any) => c.id);

  let deleted = 0;
  if (ids.length > 0) {
    const r = await (prisma as any).meetingProjectBlock.deleteMany({
      where: { id: { in: ids } },
    });
    deleted = r.count;
  }

  return NextResponse.json({
    ok: true,
    meetingId,
    candidatesFound: candidates.length,
    deleted,
    deletedIds: ids,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 30;

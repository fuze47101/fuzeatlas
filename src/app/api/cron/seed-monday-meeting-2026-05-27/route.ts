// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractActionItems } from "@/lib/meeting-mentions";
import { sendImmediateAssignmentEmail } from "@/lib/meeting-emails";

/**
 * POST /api/cron/seed-monday-meeting-2026-05-27
 *
 * One-shot seeder for Andrew's 2026-05-27 Monday Global Meeting notes.
 * Bearer-authed via CRON_SECRET. Idempotent — if a MeetingNote with
 * the exact title already exists, skips and returns
 * { ok: true, skipped: true, existingMeetingId }.
 *
 * Pipeline mirrors POST /api/meeting-notes/[id]/entries:
 *   - Author = andrew@fuze47.com
 *   - Series = cmpob1jv80001l204a56xutem (Monday Global Meeting)
 *   - Creates MeetingNote + MeetingNoteEntry + MeetingActionItem rows
 *     for every @mention via extractActionItems()
 *   - Fires immediate-assignment notifications + emails for every
 *     action item with an assignee
 */
const CRON_SECRET = process.env.CRON_SECRET;
const SERIES_ID = "cmpob1jv80001l204a56xutem";
const MEETING_TITLE = "Monday Global Meeting — 2026-05-27";
const MEETING_DATE = new Date("2026-05-28T01:00:00.000Z"); // 2026-05-27 19:00 Mountain (UTC-6)

const NOTES_BODY = `**MMI**
- @Ryan global follow-up
- @Kaylee to prep for ICP and send the 4 samples to CTLA today (5-day process)
- @Andrew emailed Tandy to find out application process

**Target**
- @Ryan global follow-up
- @Andrew emailed John for a circle-up
- @Kathir determined that they are using a Rudolf product for antimicrobial in India at Trident
- @Andrew did full research on the Rudolf product for competitive analysis

**Tencate**
- @Ryan global follow-up
- @Andrew visited factories
- Tencate (Matthew) applied at spin finish
- Waiting on the samples of spin finish to determine pickup by ICP
- Waiting on master batch samples from John Greenup

**Hurricane**
- @Andrew global follow-up
- @Andrew completed site visit
- Hurricane arranging upgrade and install of air compressors
- @Andrew to send Hurricane engineering drawings

**Nike — Priority 1 URGENT**
- @Andrew global follow-up
- @Andrew to replace the Pi on the Solaris machine — add a temp sensor above the fabric with humidity
- Samples to be made: 1 control + 5 Helios (au sprays), FUZE, and Combo at 1 spray, 2 spray, 3 spray, 4 spray, 5 spray
- Testing: Quick dry and wicking on the Baals machine; Solaris Testing machine on all 16 samples in frame and draped

**Allied**
- @Andrew to complete new test device in refrigeration
- Luke is in town for 2 days next week in lab

**Project Red Rover**
- @Ryan LinkedIn reach-out for contact — soft requests on consulting availability: Lee Howarth, Harry Schmoot, Bryan Dill

**PVH**
- @Barth global follow-up — next steps
- @Andrew follow up on Sri Lanka TeeJay trial

**SanMar**
- @Tina global follow-up
- @Kaylee to perform antimicrobial testing on Paradise fabric (Antimicrobial + ICP), Hone Strong (Antimicrobial + ICP), Fountain Set (Antimicrobial + ICP)
- @Andrew to confirm wash data

**Skims**
- @Scott global follow-up
- @Andrew to message Brittany and Mario
- Relay to @Tina — Best Pacific has manufacturing in mainland China, Vietnam, and Sri Lanka

**Loftex**
- @Barth global follow-up
- Meeting to discuss pricing on May 27th at 12:20
- Review testing protocol — ICP Report: Pad and Bath at 0.25 for 0 wash and 0.22 at 100 wash

**WooJoo**
- @Andrew global follow-up
- @Andrew to send email to determine if it came treated or not
- Perform recipe analysis
- ICP recipe is due back next week

**Patriots**
- @Scott global follow-up
- @Scott to build new sprayers — equipment all here
- @Tina to call and see if we can get new plastic heads for the 30 broken pumps — new pump order 10?

**Seissence**
- @Andrew to send completed test report

**Gul Ahmed**
- @Scott global follow-up (Sky Home also @Barth)
- Pakistan sent back fabric with low ICP — 0.01 when target was 0.5
- @Scott to follow up on the ICP testing and their pitch to Wal-Mart for FUZE
- @Kaylee to create a recipe build for their failed fabric

**Classic Fashion**
- @Barth global follow-up
- @Tandy to reach out to Changzhou factory to discuss new approval of FUZE by Target and Wal-Mart (Logesh)
- @Barth follow up Richard Tinsley`;

const INTERNAL_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
];

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 1. Resolve Andrew + the series.
  const andrew = await prisma.user.findUnique({
    where: { email: "andrew@fuze47.com" },
    select: { id: true, name: true, email: true },
  });
  if (!andrew) {
    return NextResponse.json({ ok: false, error: "andrew@fuze47.com not found" }, { status: 404 });
  }
  const series = await (prisma as any).meetingSeries.findUnique({
    where: { id: SERIES_ID },
    select: { id: true, name: true, brandId: true, factoryId: true },
  });
  if (!series) {
    return NextResponse.json({ ok: false, error: `series ${SERIES_ID} not found` }, { status: 404 });
  }

  // 2. Idempotency check.
  const existing = await (prisma as any).meetingNote.findFirst({
    where: { title: MEETING_TITLE },
    select: { id: true, _count: { select: { actionItems: true } } },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      existingMeetingId: existing.id,
      existingActionItemCount: existing._count?.actionItems ?? null,
      verdict: `MeetingNote '${MEETING_TITLE}' already exists; nothing seeded.`,
    });
  }

  // 3. Create MeetingNote.
  const note = await (prisma as any).meetingNote.create({
    data: {
      seriesId: series.id,
      title: MEETING_TITLE,
      meetingDate: MEETING_DATE,
      status: "COMPLETED",
      notesMd: "",
      brandId: series.brandId,
      factoryId: series.factoryId,
      createdById: andrew.id,
    },
    select: { id: true, title: true },
  });

  // 4. Create MeetingNoteEntry — mirrors the
  //    /api/meeting-notes/[id]/entries POST pipeline.
  const entry = await (prisma as any).meetingNoteEntry.create({
    data: {
      meetingNoteId: note.id,
      authorId: andrew.id,
      bodyMd: NOTES_BODY,
    },
    select: { id: true, createdAt: true },
  });

  // Stamp the author header onto the meeting markdown.
  const stamp = `**[${andrew.name || andrew.email}, ${new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}]**`;
  const notesMd = `${stamp}\n${NOTES_BODY}`;
  await (prisma as any).meetingNote.update({
    where: { id: note.id },
    data: { notesMd },
  });

  // 5. Pull internal users for @mention matching + run extractActionItems.
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: INTERNAL_ROLES } },
    select: { id: true, name: true, email: true, updatedAt: true },
  });
  const extracted = extractActionItems(NOTES_BODY, users as any);

  // 6. Create MeetingActionItem rows + fire immediate-assignment fan-out.
  const created: any[] = [];
  for (const ex of extracted) {
    const item = await (prisma as any).meetingActionItem.create({
      data: {
        meetingNoteId: note.id,
        sourceEntryId: entry.id,
        description: ex.description,
        assigneeId: ex.assigneeId,
        priority: ex.priority,
        dueDate: ex.dueDate,
        createdById: andrew.id,
      },
      select: {
        id: true,
        description: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
      },
    });

    let assigneeEmail: string | null = null;
    if (item.assigneeId) {
      const u = users.find((x) => x.id === item.assigneeId);
      assigneeEmail = u?.email ?? null;
      // In-app + email notification (best-effort, non-blocking on failure).
      await prisma.notification
        .create({
          data: {
            userId: item.assigneeId,
            type: "SYSTEM",
            title: `New action item: ${item.description.slice(0, 60)}`,
            message: `Andrew assigned this to you in '${note.title}'.`,
            link: `/my-tasks`,
          },
        })
        .catch(() => null);
      void sendImmediateAssignmentEmail({ actionItemId: item.id }).catch(() => null);
    }

    created.push({
      description: item.description,
      assigneeEmail,
      priority: item.priority,
      dueDate: item.dueDate,
    });
  }

  return NextResponse.json({
    ok: true,
    meetingId: note.id,
    entryId: entry.id,
    actionItemCount: created.length,
    actionItems: created,
    verdict: `Seeded MeetingNote '${MEETING_TITLE}' with ${created.length} action item(s).`,
  });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
export const maxDuration = 120;

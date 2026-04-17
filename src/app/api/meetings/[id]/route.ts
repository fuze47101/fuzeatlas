// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcsContent, meetingIcsUid } from "@/lib/meeting-templates";
import { sendMeetingInvite } from "@/lib/email";

/**
 * Monotonic sequence number for .ics updates. We don't persist a sequence
 * column on Meeting yet — epoch seconds guarantee strict monotonicity across
 * any number of edits, which is all Outlook/Gmail need to apply the newer
 * copy. When we care about exact edit counts we can add an `icsSequence`
 * Int column later.
 */
function nextIcsSequence() {
  return Math.floor(Date.now() / 1000);
}

function pickAttendees(raw: any): { name: string; email: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => a && a.email)
    .map((a: any) => ({ name: a.name || a.email, email: a.email }));
}

async function resolveOrganizer(organizerId: string | null | undefined) {
  if (!organizerId) return undefined;
  const u = await prisma.user.findUnique({
    where: { id: organizerId },
    select: { name: true, email: true },
  });
  return u?.email ? { name: u.name || u.email, email: u.email } : undefined;
}

/* ── GET /api/meetings/[id] ── Meeting detail ──── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ ok: false, error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, meeting });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── PUT /api/meetings/[id] ── Update meeting ──── */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Handle status actions
    if (body.action) {
      const updates: any = {};
      switch (body.action) {
        case "complete":
          updates.status = "COMPLETED";
          if (body.notes) updates.notes = body.notes;
          if (body.outcome) updates.outcome = body.outcome;
          break;
        case "cancel":
          updates.status = "CANCELLED";
          break;
        case "reschedule":
          updates.status = "RESCHEDULED";
          if (body.startTime) updates.startTime = new Date(body.startTime);
          if (body.endTime) updates.endTime = new Date(body.endTime);
          break;
        default:
          break;
      }

      const meeting = await prisma.meeting.update({
        where: { id },
        data: updates,
      });

      /* ── Fire cancel / update invites when appropriate (non-blocking) ── */
      if (body.action === "cancel" || body.action === "reschedule") {
        (async () => {
          try {
            const attendeeList = pickAttendees(meeting.attendees);
            if (attendeeList.length === 0) return;
            const organizer = await resolveOrganizer(meeting.organizerId);
            await sendMeetingInvite({
              action: body.action === "cancel" ? "cancel" : "update",
              to: attendeeList.map((a) => a.email),
              title: meeting.title,
              description: meeting.description || "",
              startTime: meeting.startTime,
              endTime: meeting.endTime,
              timezone: meeting.timezone || "Asia/Taipei",
              location: meeting.location || undefined,
              teamsLink: meeting.teamsLink || undefined,
              uid: meetingIcsUid(meeting.id),
              sequence: nextIcsSequence(),
              organizer,
              attendees: attendeeList,
            });
          } catch (err) {
            console.error("[MEETINGS] Calendar action email failed:", err);
          }
        })();
      }

      return NextResponse.json({ ok: true, meeting });
    }

    // Regular field update
    const {
      title,
      description,
      meetingType,
      startTime,
      endTime,
      timezone,
      location,
      brandId,
      projectId,
      attendees,
      notes,
      outcome,
    } = body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (meetingType !== undefined) data.meetingType = meetingType;
    if (startTime !== undefined) data.startTime = new Date(startTime);
    if (endTime !== undefined) data.endTime = new Date(endTime);
    if (timezone !== undefined) data.timezone = timezone;
    if (location !== undefined) data.location = location;
    if (brandId !== undefined) data.brandId = brandId || null;
    if (projectId !== undefined) data.projectId = projectId || null;
    if (attendees !== undefined) data.attendees = attendees;
    if (notes !== undefined) data.notes = notes;
    if (outcome !== undefined) data.outcome = outcome;

    const meeting = await prisma.meeting.update({
      where: { id },
      data,
    });

    /* ── Fire an UPDATE invite if any calendar-visible field changed ── */
    const calendarFieldChanged =
      data.title !== undefined ||
      data.description !== undefined ||
      data.startTime !== undefined ||
      data.endTime !== undefined ||
      data.location !== undefined ||
      data.attendees !== undefined;

    if (calendarFieldChanged) {
      (async () => {
        try {
          const attendeeList = pickAttendees(meeting.attendees);
          if (attendeeList.length === 0) return;
          const organizer = await resolveOrganizer(meeting.organizerId);
          await sendMeetingInvite({
            action: "update",
            to: attendeeList.map((a) => a.email),
            title: meeting.title,
            description: meeting.description || "",
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            timezone: meeting.timezone || "Asia/Taipei",
            location: meeting.location || undefined,
            teamsLink: meeting.teamsLink || undefined,
            uid: meetingIcsUid(meeting.id),
            sequence: nextIcsSequence(),
            organizer,
            attendees: attendeeList,
          });
        } catch (err) {
          console.error("[MEETINGS] Calendar update email failed:", err);
        }
      })();
    }

    return NextResponse.json({ ok: true, meeting });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/meetings/[id] ── Delete meeting ──── */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Read first so we can send cancellation emails before the row disappears
    const meeting = await prisma.meeting.findUnique({ where: { id } });

    await prisma.meeting.delete({ where: { id } });

    if (meeting) {
      (async () => {
        try {
          const attendeeList = pickAttendees(meeting.attendees);
          if (attendeeList.length === 0) return;
          const organizer = await resolveOrganizer(meeting.organizerId);
          await sendMeetingInvite({
            action: "cancel",
            to: attendeeList.map((a) => a.email),
            title: meeting.title,
            description: meeting.description || "",
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            timezone: meeting.timezone || "Asia/Taipei",
            location: meeting.location || undefined,
            teamsLink: meeting.teamsLink || undefined,
            uid: meetingIcsUid(meeting.id),
            sequence: nextIcsSequence(),
            organizer,
            attendees: attendeeList,
          });
        } catch (err) {
          console.error("[MEETINGS] Calendar cancel email failed:", err);
        }
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcsContent } from "@/lib/meeting-templates";

/* ── GET /api/meetings/[id] ── Meeting detail ──── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    return NextResponse.json({ ok: true, meeting });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/meetings/[id] ── Delete meeting ──── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

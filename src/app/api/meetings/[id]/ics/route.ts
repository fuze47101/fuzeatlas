// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcsContent } from "@/lib/meeting-templates";

/* ── GET /api/meetings/[id]/ics ── Download .ics calendar file ──── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        organizer: { select: { name: true, email: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ ok: false, error: "Meeting not found" }, { status: 404 });
    }

    const attendeesList = Array.isArray(meeting.attendees)
      ? (meeting.attendees as any[]).filter((a) => a.name && a.email)
      : [];

    const icsContent = generateIcsContent({
      title: meeting.title,
      description: meeting.description || "",
      startTime: new Date(meeting.startTime),
      endTime: new Date(meeting.endTime),
      location: meeting.location || undefined,
      organizer: meeting.organizer
        ? { name: meeting.organizer.name, email: meeting.organizer.email }
        : undefined,
      attendees: attendeesList,
    });

    const filename = `${meeting.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;

    return new Response(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

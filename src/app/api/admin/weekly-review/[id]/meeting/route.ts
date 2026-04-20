// @ts-nocheck
/**
 * POST /api/admin/weekly-review/:id/meeting
 *
 * Schedule a meeting inline from the weekly review. Writes to the Meeting
 * table with the current user as organizer. If a brand is supplied we
 * tag the meeting for that brand so it appears on the brand's timeline.
 *
 * Body:
 *   { title, startTime, endTime?, brandId?, meetingType?, location?, description? }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { gateReport } from "@/lib/weekly-review/access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser().catch(() => null);
  const gate = await gateReport(id, user);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
  if (!body.startTime) return NextResponse.json({ ok: false, error: "startTime is required" }, { status: 400 });

  const startTime = new Date(body.startTime);
  const endTime = body.endTime
    ? new Date(body.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000); // default 1h

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description: body.description || null,
      meetingType: body.meetingType || "INTERNAL",
      startTime,
      endTime,
      timezone: body.timezone || "America/Denver",
      location: body.location || null,
      brandId: body.brandId || null,
      organizerId: user.id,
      attendees: body.attendees || [],
      status: "SCHEDULED",
    },
    select: {
      id: true, title: true, startTime: true, endTime: true,
      brand: { select: { id: true, name: true } },
    },
  });

  // Stamp brand activity if brand is attached.
  if (body.brandId) {
    await prisma.brand.update({
      where: { id: body.brandId },
      data: { lastActivityAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, meeting });
}

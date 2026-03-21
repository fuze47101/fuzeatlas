// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PIPELINE_MEETING_TEMPLATES,
  generateTeamsLink,
  generateIcsContent,
} from "@/lib/meeting-templates";

/* ── GET /api/meetings ── List meetings with filtering ──── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId") || "";
    const projectId = searchParams.get("projectId") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const upcoming = searchParams.get("upcoming");

    const where: any = {};
    if (brandId) where.brandId = brandId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (type) where.meetingType = type;
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }
    if (upcoming === "true") {
      where.startTime = { gte: new Date() };
      where.status = "SCHEDULED";
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        organizer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: "asc" },
    });

    // Stats
    const now = new Date();
    const upcomingCount = meetings.filter(
      (m) => m.status === "SCHEDULED" && new Date(m.startTime) >= now
    ).length;
    const thisWeek = meetings.filter((m) => {
      const d = new Date(m.startTime);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return d >= now && d <= weekEnd && m.status === "SCHEDULED";
    }).length;
    const completedCount = meetings.filter((m) => m.status === "COMPLETED").length;

    return NextResponse.json({
      ok: true,
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        meetingType: m.meetingType,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        timezone: m.timezone,
        location: m.location,
        teamsLink: m.teamsLink,
        brand: m.brand?.name || null,
        brandId: m.brandId,
        project: m.project?.name || null,
        projectId: m.projectId,
        pipelineStage: m.pipelineStage,
        autoScheduled: m.autoScheduled,
        organizer: m.organizer?.name || null,
        organizerId: m.organizerId,
        attendees: m.attendees,
        status: m.status,
        notes: m.notes,
        outcome: m.outcome,
      })),
      stats: { upcoming: upcomingCount, thisWeek, completed: completedCount, total: meetings.length },
    });
  } catch (err: any) {
    console.error("Meetings GET error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/* ── POST /api/meetings ── Create a meeting ──── */
export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    const body = await req.json();
    const {
      title,
      description,
      meetingType = "INTERNAL",
      startTime,
      endTime,
      timezone = "Asia/Taipei",
      location,
      brandId,
      projectId,
      pipelineStage,
      autoScheduled = false,
      attendees,
    } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { ok: false, error: "title, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    // Generate Teams deep link
    const attendeeEmails = (attendees || [])
      .map((a: any) => a.email)
      .filter(Boolean);
    const teamsLink = generateTeamsLink({
      title,
      startTime,
      endTime,
      attendees: attendeeEmails,
    });

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description: description || null,
        meetingType,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        timezone,
        location: location || null,
        teamsLink,
        brandId: brandId || null,
        projectId: projectId || null,
        pipelineStage: pipelineStage || null,
        autoScheduled,
        organizerId: userId,
        attendees: attendees || null,
        status: "SCHEDULED",
      },
    });

    return NextResponse.json({ ok: true, meeting });
  } catch (err: any) {
    console.error("Meetings POST error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// autoScheduleMeeting is now in @/lib/meeting-templates for clean imports

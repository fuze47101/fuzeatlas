// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildProjectTimeline } from "@/lib/project-timeline";

/**
 * GET /api/brands/[id]/activity
 * Returns a unified CRM activity timeline for a brand — notes, outreach messages,
 * meetings, and contact interactions merged chronologically.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;

    // Fetch all activity types in parallel
    const [notes, contacts, outreachMessages, meetings, projectEntries] = await Promise.all([
      // Notes (all types: NOTE, CALL, EMAIL, MEETING, TASK, FOLLOW_UP)
      prisma.note.findMany({
        where: { brandId: id },
        select: {
          id: true,
          content: true,
          noteType: true,
          date: true,
          contactName: true,
          createdAt: true,
          emailDirection: true,
          emailSubject: true,
          emailFrom: true,
          emailTo: true,
          emailCc: true,
          emailMessageId: true,
          contact: { select: { id: true, name: true, email: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        take: 100,
      }),

      // Contacts with outreach status
      prisma.contact.findMany({
        where: { brandId: id },
        select: {
          id: true,
          name: true,
          jobTitle: true,
          email: true,
          phone: true,
          linkedinUrl: true,
          outreachStatus: true,
          lastContactedAt: true,
          outreachCount: true,
          decisionMaker: true,
          seniority: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      // Outreach messages sent to contacts at this brand
      prisma.outreachMessage.findMany({
        where: {
          contact: { brandId: id },
        },
        select: {
          id: true,
          channel: true,
          subject: true,
          body: true,
          toAddress: true,
          status: true,
          sentAt: true,
          createdAt: true,
          contact: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // Meetings associated with this brand
      prisma.meeting.findMany({
        where: { brandId: id },
        select: {
          id: true,
          title: true,
          description: true,
          meetingType: true,
          startTime: true,
          endTime: true,
          location: true,
          teamsLink: true,
          status: true,
          attendees: true,
          createdAt: true,
        },
        orderBy: { startTime: "desc" },
        take: 50,
      }),

      // Phase 53/54/54.5/56 — Project + Project weekly updates +
      // MeetingActionItem + MeetingProjectBlock discussion entries
      // tied to this brand.
      buildProjectTimeline({ brandId: id }),
    ]);

    // Build unified timeline
    const timeline: any[] = [];

    for (const n of notes) {
      timeline.push({
        type: "note",
        subtype: n.noteType || "NOTE",
        id: n.id,
        date: n.date || n.createdAt,
        content: n.content,
        contactName: n.contactName,
        user: n.user,
      });
    }

    for (const m of outreachMessages) {
      timeline.push({
        type: "outreach",
        subtype: m.channel || "email",
        id: m.id,
        date: m.sentAt || m.createdAt,
        subject: m.subject,
        content: m.body,
        toAddress: m.toAddress,
        status: m.status,
        contactName: m.contact?.name,
        contactId: m.contact?.id,
      });
    }

    for (const mt of meetings) {
      timeline.push({
        type: "meeting",
        subtype: mt.meetingType || "GENERAL",
        id: mt.id,
        date: mt.startTime || mt.createdAt,
        title: mt.title,
        content: mt.description,
        location: mt.location,
        teamsLink: mt.teamsLink,
        status: mt.status,
        attendees: mt.attendees,
        endTime: mt.endTime,
      });
    }

    // Phase 53/54/54.5/56 entries — already shaped by buildProjectTimeline.
    for (const e of projectEntries) timeline.push(e);

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ok: true,
      timeline,
      contacts,
      summary: {
        totalNotes: notes.length,
        totalOutreach: outreachMessages.length,
        totalMeetings: meetings.length,
        totalContacts: contacts.length,
        totalProjectEntries: projectEntries.length,
      },
    });
  } catch (e: any) {
    console.error("Brand activity error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

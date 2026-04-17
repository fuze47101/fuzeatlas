// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/factories/[id]/activity
 * Returns a unified CRM activity timeline for a factory — notes and contact interactions.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;

    // Fetch all activity types in parallel
    const [notes, contacts] = await Promise.all([
      prisma.note.findMany({
        where: { factoryId: id },
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

      prisma.contact.findMany({
        where: { factoryId: id },
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
    ]);

    // Build timeline from notes
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

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ok: true,
      timeline,
      contacts,
      summary: {
        totalNotes: notes.length,
        totalOutreach: 0,
        totalMeetings: 0,
        totalContacts: contacts.length,
      },
    });
  } catch (e: any) {
    console.error("Factory activity error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

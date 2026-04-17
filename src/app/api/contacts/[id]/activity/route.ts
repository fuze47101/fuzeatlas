// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/contacts/[id]/activity
 * Timeline for a single contact — notes (including inbound/outbound emails),
 * outreach checks, outreach messages, ordered newest first.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;

    const [notes, outreachChecks, outreachMessages, contact] = await Promise.all([
      prisma.note.findMany({
        where: { contactId: id },
        select: {
          id: true,
          content: true,
          noteType: true,
          date: true,
          createdAt: true,
          contactName: true,
          emailDirection: true,
          emailSubject: true,
          emailFrom: true,
          emailTo: true,
          emailCc: true,
          emailMessageId: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.contactOutreach.findMany({
        where: { contactId: id },
        select: {
          id: true,
          type: true,
          sentAt: true,
          notes: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 50,
      }),
      prisma.outreachMessage
        .findMany({
          where: { contactId: id },
          select: {
            id: true,
            subject: true,
            body: true,
            channel: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
        .catch(() => []),
      prisma.contact.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          personalEmail: true,
          jobTitle: true,
          brandId: true,
          factoryId: true,
          distributorId: true,
        },
      }),
    ]);

    if (!contact) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Build a unified, typed timeline
    type Item = {
      id: string;
      kind: "NOTE" | "EMAIL" | "OUTREACH" | "MESSAGE";
      at: string;
      data: any;
    };

    const timeline: Item[] = [];

    for (const n of notes) {
      timeline.push({
        id: n.id,
        kind: n.noteType === "EMAIL" ? "EMAIL" : "NOTE",
        at: (n.date || n.createdAt).toISOString(),
        data: n,
      });
    }
    for (const o of outreachChecks) {
      timeline.push({
        id: o.id,
        kind: "OUTREACH",
        at: o.sentAt.toISOString(),
        data: o,
      });
    }
    for (const m of outreachMessages as any[]) {
      timeline.push({
        id: m.id,
        kind: "MESSAGE",
        at: (m.sentAt || m.createdAt).toISOString(),
        data: m,
      });
    }

    timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

    return NextResponse.json({ ok: true, contact, timeline });
  } catch (e: any) {
    console.error("[contact-activity] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

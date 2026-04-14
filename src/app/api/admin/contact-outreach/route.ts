// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/contact-outreach?contactIds=id1,id2,id3
 * Returns outreach checks for the current user + all users for given contacts
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const contactIds = url.searchParams.get("contactIds")?.split(",").filter(Boolean) || [];

    if (contactIds.length === 0) {
      return NextResponse.json({ ok: true, outreach: {} });
    }

    // Get all outreach checks for these contacts (from all users)
    const checks = await prisma.contactOutreach.findMany({
      where: { contactId: { in: contactIds } },
      select: {
        contactId: true,
        userId: true,
        type: true,
        sentAt: true,
        user: { select: { id: true, name: true } },
      },
    });

    // Group by contactId → { LINKEDIN: [...users], EMAIL: [...users] }
    const outreach: Record<string, any> = {};
    for (const check of checks) {
      if (!outreach[check.contactId]) {
        outreach[check.contactId] = { LINKEDIN: [], EMAIL: [] };
      }
      outreach[check.contactId][check.type]?.push({
        userId: check.userId,
        userName: check.user.name,
        sentAt: check.sentAt,
        isMe: check.userId === user.id,
      });
    }

    return NextResponse.json({ ok: true, outreach, currentUserId: user.id });
  } catch (e: any) {
    console.error("Contact outreach GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/contact-outreach
 * Toggle an outreach checkmark for the current user
 * Body: { contactId, type: "LINKEDIN" | "EMAIL" }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { contactId, type } = await req.json();

    if (!contactId || !["LINKEDIN", "EMAIL"].includes(type)) {
      return NextResponse.json({ ok: false, error: "contactId and type (LINKEDIN/EMAIL) required" }, { status: 400 });
    }

    // Check if already exists — toggle off
    const existing = await prisma.contactOutreach.findUnique({
      where: {
        contactId_userId_type: { contactId, userId: user.id, type },
      },
    });

    if (existing) {
      // Uncheck — delete it
      await prisma.contactOutreach.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, action: "unchecked", type, contactId });
    } else {
      // Check — create it
      await prisma.contactOutreach.create({
        data: { contactId, userId: user.id, type },
      });

      // Also update the contact's outreachStatus if it's still not_contacted
      const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { outreachStatus: true } });
      if (contact?.outreachStatus === "not_contacted" || !contact?.outreachStatus) {
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            outreachStatus: "contacted",
            lastContactedAt: new Date(),
            outreachCount: { increment: 1 },
          },
        });
      }

      return NextResponse.json({ ok: true, action: "checked", type, contactId });
    }
  } catch (e: any) {
    console.error("Contact outreach POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

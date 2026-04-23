// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeHygieneSnapshot } from "@/lib/contact-quality";

/**
 * POST /api/admin/contact-hygiene/[id]/unflag
 *
 * Reverse a hide — `hiddenFromWizard: false`. Also rescans the contact
 * so the verdict reflects whatever we know right now (if the rep
 * enriched or fixed the data since the last scan, the score should
 * update too). An audit note is written if the admin provides a reason.
 *
 * Body: { reason?: string }
 *
 * Admin + EMPLOYEE + SALES_MANAGER only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { reason?: string };

    const existing = await prisma.contact.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        title: true,
        linkedinUrl: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    const snap = computeHygieneSnapshot(existing);

    const contact = await prisma.$transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id },
        data: {
          hiddenFromWizard: false,
          hygieneScore: snap.hygieneScore,
          hygieneVerdict: snap.hygieneVerdict,
          hygieneFlags: snap.hygieneFlags,
          hygieneCheckedAt: snap.hygieneCheckedAt,
          emailValidity: snap.emailValidity,
          linkedinValidity: snap.linkedinValidity,
        },
      });
      if (body.reason && body.reason.trim()) {
        await tx.note.create({
          data: {
            contactId: id,
            userId: user.id,
            noteType: "HYGIENE",
            date: new Date(),
            content: `👀 Un-hidden from BD Wizard by ${user.name || user.email}: ${body.reason.trim()}`,
          },
        });
      }
      return updated;
    });

    return NextResponse.json({
      ok: true,
      contact: {
        id: contact.id,
        hiddenFromWizard: false,
        hygieneScore: snap.hygieneScore,
        hygieneVerdict: snap.hygieneVerdict,
      },
    });
  } catch (e: any) {
    console.error("[contact-hygiene/unflag] failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

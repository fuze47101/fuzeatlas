// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/contact-hygiene/[id]/hide
 *
 * Flip `hiddenFromWizard: true` on a contact. The BD Wizard's contact
 * picker respects this explicitly — a hidden contact won't show up even
 * if its computed verdict would otherwise mark it "real".
 *
 * Body: { reason?: string } — optional note the admin can leave for the
 * audit trail. Written as a Note on the contact if present.
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

    // Hide + drop an audit note in one transaction so we can reverse
    // course later ("who hid this, when, and why").
    const contact = await prisma.$transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id },
        data: { hiddenFromWizard: true },
      });
      if (body.reason && body.reason.trim()) {
        await tx.note.create({
          data: {
            contactId: id,
            userId: user.id,
            noteType: "HYGIENE",
            date: new Date(),
            content: `🙈 Hidden from BD Wizard by ${user.name || user.email}: ${body.reason.trim()}`,
          },
        });
      }
      return updated;
    });

    return NextResponse.json({ ok: true, contact: { id: contact.id, hiddenFromWizard: true } });
  } catch (e: any) {
    console.error("[contact-hygiene/hide] failed:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

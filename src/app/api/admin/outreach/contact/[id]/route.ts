// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * PATCH /api/admin/outreach/contact/[id]
 * Update a contact's outreach status and other fields inline.
 *
 * Body: { outreachStatus?, vertical?, decisionMaker?, notes? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin or manager only" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const allowedFields = ["outreachStatus", "vertical", "decisionMaker", "notes", "outreachCount", "lastContactedAt", "lastResponseAt"];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle special action: mark LinkedIn reached or email sent
    if (body.action === "linkedin_reached") {
      updateData.outreachStatus = updateData.outreachStatus || "contacted";
      updateData.lastContactedAt = new Date();
      // Increment outreach count
      const current = await prisma.contact.findUnique({ where: { id }, select: { outreachCount: true } });
      updateData.outreachCount = (current?.outreachCount || 0) + 1;
    }
    if (body.action === "email_sent") {
      updateData.outreachStatus = updateData.outreachStatus || "contacted";
      updateData.lastContactedAt = new Date();
      const current = await prisma.contact.findUnique({ where: { id }, select: { outreachCount: true } });
      updateData.outreachCount = (current?.outreachCount || 0) + 1;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, contact: updated });
  } catch (error: any) {
    console.error("Contact update error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

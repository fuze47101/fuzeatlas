// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole, hashPassword } from "@/lib/auth";
import { sendAccessApprovedEmail } from "@/lib/email";

/* ── POST /api/access-requests/[id]/resend-email ── ADMIN: resend approval email with new temp password ── */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Find the access request
    const request = await prisma.accessRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, status: true } } },
    });

    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "APPROVED") {
      return NextResponse.json({ ok: false, error: "Can only resend email for approved requests" }, { status: 400 });
    }

    if (!request.user) {
      return NextResponse.json({ ok: false, error: "No user account linked to this request" }, { status: 400 });
    }

    // Generate a new temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    // Update the user's password
    await prisma.user.update({
      where: { id: request.user.id },
      data: { password: hashedPassword, mustChangePassword: true },
    });

    // Send the approval email
    const accountType = request.requestType === "FACTORY" ? "factory" : "brand";
    const result = await sendAccessApprovedEmail({
      email: request.email,
      name: `${request.firstName} ${request.lastName}`,
      tempPassword,
      companyName: request.company,
      accountType,
    });

    if (!result.ok) {
      console.error("Resend email failed:", result.error);
      return NextResponse.json({
        ok: false,
        error: `Email send failed: ${result.error}`,
        tempPassword, // Still return the password so admin can share manually
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Approval email resent to ${request.email} with new temporary password.`,
      tempPassword,
    });
  } catch (e: any) {
    console.error("Resend email error:", e);
    return NextResponse.json({ ok: false, error: "Failed to resend email" }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const specials = "!@#$&";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  const pos = Math.floor(Math.random() * pw.length);
  pw = pw.slice(0, pos) + specials[Math.floor(Math.random() * specials.length)] + pw.slice(pos);
  return pw;
}

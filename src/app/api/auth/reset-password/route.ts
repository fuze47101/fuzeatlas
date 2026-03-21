// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

/* ── POST /api/auth/reset-password ── reset password with token ────────── */
export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { ok: false, error: "Token and new password are required" },
        { status: 400 }
      );
    }

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Reset token has expired" },
        { status: 400 }
      );
    }

    // Check if token already used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { ok: false, error: "This reset link has already been used" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset-password:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reset password" },
      { status: 500 }
    );
  }
}

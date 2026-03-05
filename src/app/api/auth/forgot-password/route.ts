// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/* ── POST /api/auth/forgot-password ── initiate password reset ────────── */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success message for security (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If an account exists with that email, you'll receive a reset link.",
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // TODO: Send email with reset link: /reset-password?token={token}
    // For now, return token in response for testing
    return NextResponse.json({
      ok: true,
      message: "If an account exists with that email, you'll receive a reset link.",
      token, // Remove in production after email integration
    });
  } catch (error) {
    console.error("Error in forgot-password:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

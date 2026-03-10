// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Fetch full user with password hash
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true, mustChangePassword: true },
    });

    if (!fullUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // If user has an existing password, verify current password
    // (skip verification only if this is a forced change from a temp password with no currentPassword provided)
    if (fullUser.password && currentPassword) {
      const valid = await verifyPassword(currentPassword, fullUser.password);
      if (!valid) {
        return NextResponse.json(
          { ok: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
    } else if (fullUser.password && !fullUser.mustChangePassword) {
      // Has a password and NOT forced change — must provide current password
      return NextResponse.json(
        { ok: false, error: "Current password is required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { ok: false, error: "Password must contain at least one uppercase letter" },
        { status: 400 }
      );
    }
    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { ok: false, error: "Password must contain at least one number" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    // Generate email verification token if not already verified
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true, email: true, name: true },
    });

    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        ...(!currentUser?.emailVerified && {
          emailVerifyToken: verifyToken,
          emailVerifyExpiry: verifyExpiry,
        }),
      },
    });

    // Send verification email if not yet verified
    if (currentUser && !currentUser.emailVerified) {
      await sendEmailVerification({
        email: currentUser.email,
        name: currentUser.name,
        verifyToken,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Password changed successfully",
      emailVerificationSent: !currentUser?.emailVerified,
    });
  } catch (e: any) {
    console.error("Change password error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

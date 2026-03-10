// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailVerification } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: "Email already verified" });
    }

    // Generate verification token (24 hour expiry)
    const token = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: token,
        emailVerifyExpiry: expiry,
      },
    });

    // Send verification email
    await sendEmailVerification({
      email: user.email,
      name: user.name,
      verifyToken: token,
    });

    return NextResponse.json({ ok: true, message: "Verification email sent" });
  } catch (e: any) {
    console.error("Send verification error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

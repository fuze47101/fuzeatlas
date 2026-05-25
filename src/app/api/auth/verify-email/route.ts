// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiry: { gte: new Date() },
      },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired verification link. Please request a new one." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    return NextResponse.json({ ok: true, message: "Email verified successfully", name: user.name });
  } catch (e: any) {
    console.error("Verify email error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * GET /api/auth/verify-email?token=<token>
 *
 * Click-target for the verification email sent on user creation
 * (T8 phase 16). Looks up the user, stamps emailVerifiedAt, and
 * redirects to /login?verified=1.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const origin = baseUrl || url.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login?verifyError=missing-token", origin));
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, emailVerifyExpiry: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login?verifyError=unknown-token", origin));
  }
  if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
    return NextResponse.redirect(new URL("/login?verifyError=expired", origin));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    },
  });

  return NextResponse.redirect(new URL("/login?verified=1", origin));
}

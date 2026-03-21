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

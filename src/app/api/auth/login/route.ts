// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Account is not active. Contact an administrator." },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { ok: false, error: "Account has no password set. Contact an administrator." },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      brandId: user.brandId,
      factoryId: user.factoryId,
      distributorId: user.distributorId,
    };

    const token = await createToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, user: sessionUser });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

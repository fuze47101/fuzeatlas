// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setSessionCookie, getCurrentUser, hasMinRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if any users exist — first user becomes ADMIN automatically
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // If not first user, require admin to create accounts
    if (!isFirstUser) {
      const currentUser = await getCurrentUser();
      if (!currentUser || !hasMinRole(currentUser.role, "ADMIN")) {
        return NextResponse.json(
          { ok: false, error: "Only administrators can create new accounts" },
          { status: 403 }
        );
      }
    }

    // Check for existing email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: isFirstUser ? "ADMIN" : (role || "EMPLOYEE"),
        status: "ACTIVE",
      },
    });

    // If first user, auto-login
    if (isFirstUser) {
      const sessionUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        brandId: null,
        factoryId: null,
        distributorId: null,
      };
      const token = await createToken(sessionUser);
      await setSessionCookie(token);
      return NextResponse.json({ ok: true, user: sessionUser, firstUser: true });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

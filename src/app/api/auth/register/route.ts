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

    // Check if any users WITH passwords exist — first password-bearing user becomes ADMIN
    // This handles the case where users were imported from CSV without passwords
    // Count users with a real password (not null, not empty string)
    const usersWithPassword = await prisma.user.count({
      where: {
        password: { not: null },
        NOT: { password: "" },
      },
    });
    const isFirstAdmin = usersWithPassword === 0;

    // If not first admin setup, require admin to create accounts
    if (!isFirstAdmin) {
      const currentUser = await getCurrentUser();
      if (!currentUser || !hasMinRole(currentUser.role, "ADMIN")) {
        return NextResponse.json(
          { ok: false, error: "Only administrators can create new accounts" },
          { status: 403 }
        );
      }
    }

    // Check for existing user by email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Hash password
    const hashedPassword = await hashPassword(password);

    let user;

    if (existing) {
      // User exists from CSV import — update them with password + name + ADMIN role
      if (isFirstAdmin) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            password: hashedPassword,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });
      } else {
        // Not first admin, and email already exists — can't create duplicate
        return NextResponse.json(
          { ok: false, error: "An account with this email already exists" },
          { status: 409 }
        );
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: isFirstAdmin ? "ADMIN" : (role || "EMPLOYEE"),
          status: "ACTIVE",
        },
      });
    }

    // If first admin, auto-login
    if (isFirstAdmin) {
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

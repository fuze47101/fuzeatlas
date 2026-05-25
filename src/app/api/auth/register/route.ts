// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createToken,
  setSessionCookie,
  getCurrentUser,
  hasMinRole,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  try {
    // ── Rate limit: 5 register attempts per IP per hour ──
    const ip = getClientIp(req.headers);
    const rl = checkRateLimit(`register:${ip}`, { limit: 5, windowSec: 3600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const body = await req.json();
    const { name, email, password, role, brandId, factoryId, distributorId, labId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters" },
        { status: 400 },
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
          { status: 403 },
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
          { status: 409 },
        );
      }
    } else {
      // Create new user — non-admin users must change password on first login.
      // LAB_USER added to external-role list as part of Tina's admin tooling
      // gap fix (Apr 2026) so newly invited lab users get the change-password
      // prompt on first sign-in, same as factory/brand/distributor.
      const isExternalRole = [
        "FACTORY_USER",
        "FACTORY_MANAGER",
        "BRAND_USER",
        "DISTRIBUTOR_USER",
        "LAB_USER",
      ].includes(role);
      user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: isFirstAdmin ? "ADMIN" : role || "EMPLOYEE",
          status: "ACTIVE",
          mustChangePassword: !isFirstAdmin && isExternalRole,
          ...(brandId && { brandId }),
          ...(factoryId && { factoryId }),
          ...(distributorId && { distributorId }),
          ...(labId && { labId }),
        },
      });
    }

    // Fire verification email so address typos surface early (T8
    // phase 16). Diagnostic only — does NOT block sign-in. Skip
    // the first admin (they're creating the system from scratch
    // and don't need to verify themselves).
    if (!isFirstAdmin && user?.email) {
      try {
        const verifyToken = randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifyToken: verifyToken,
            emailVerifyExpiry: expiry,
          },
        });
        await sendEmailVerification({
          email: user.email,
          name: user.name,
          verifyToken,
        });
      } catch (verifyErr) {
        console.error(
          `[register] verification email to ${user.email} failed:`,
          verifyErr,
        );
        // Non-blocking — the admin still gets the success response.
      }
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
        labId: null,
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
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUserLogin } from "@/lib/notify";
import { sendLoginNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    // ── Rate limit: 5 login attempts per IP per 15 minutes ──
    const ip = getClientIp(req.headers);
    const rl = checkRateLimit(`login:${ip}`, { limit: 5, windowSec: 900 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSec),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

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
      labId: user.labId,
    };

    const token = await createToken(sessionUser);
    await setSessionCookie(token);

    // ─── Fire-and-forget login notification to AMs + admins ───
    try {
      // In-app notification
      notifyUserLogin({
        userId: user.id,
        userName: user.name || "",
        userEmail: user.email,
        userRole: user.role,
        brandId: user.brandId,
        factoryId: user.factoryId,
        distributorId: user.distributorId,
      });

      // Email notification to AM (for brand/factory logins only)
      const isBrandOrFactory = ["BRAND_USER", "BRAND_MANAGER", "FACTORY_USER", "FACTORY_MANAGER"].includes(user.role);
      if (isBrandOrFactory) {
        (async () => {
          try {
            let entityName = "";
            let entityType = "";
            let salesRepId: string | null = null;

            if (user.brandId) {
              const brand = await prisma.brand.findUnique({ where: { id: user.brandId }, select: { name: true, salesRepId: true } });
              entityName = brand?.name || "Unknown brand";
              entityType = "Brand";
              salesRepId = brand?.salesRepId || null;
            } else if (user.factoryId) {
              const factory = await prisma.factory.findUnique({ where: { id: user.factoryId }, select: { name: true, salesRepId: true } });
              entityName = factory?.name || "Unknown factory";
              entityType = "Factory";
              salesRepId = factory?.salesRepId || null;
            }

            if (salesRepId) {
              const am = await prisma.user.findUnique({ where: { id: salesRepId }, select: { email: true, name: true } });
              if (am?.email) {
                sendLoginNotificationEmail({
                  email: am.email,
                  managerName: am.name || "Account Manager",
                  userName: user.name || user.email,
                  entityType,
                  entityName,
                });
              }
            }
          } catch {}
        })();
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      ok: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword || false,
      emailVerified: user.emailVerified || false,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

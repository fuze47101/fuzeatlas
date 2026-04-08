// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";
import { cookies } from "next/headers";

const IMPERSONATE_COOKIE = "fuze-impersonate";

// POST — start or stop impersonation
export async function POST(req: Request) {
  try {
    const user = await getRealUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN can impersonate
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { action, userId } = body;

    const cookieStore = await cookies();

    if (action === "stop") {
      cookieStore.delete(IMPERSONATE_COOKIE);
      return NextResponse.json({ ok: true, impersonating: null });
    }

    if (action === "start") {
      if (!userId) {
        return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });
      }

      // Can't impersonate yourself
      if (userId === user.id) {
        return NextResponse.json({ ok: false, error: "Cannot impersonate yourself" }, { status: 400 });
      }

      // Verify target user exists
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          brandId: true,
          factoryId: true,
          distributorId: true,
          labId: true,
          brand: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          lab: { select: { id: true, name: true } },
        },
      });

      if (!target) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }

      // Set impersonation cookie
      cookieStore.set(IMPERSONATE_COOKIE, userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 4 * 60 * 60, // 4 hours max
        path: "/",
      });

      const entityName =
        target.brand?.name ||
        target.factory?.name ||
        target.distributor?.name ||
        target.lab?.name ||
        null;

      return NextResponse.json({
        ok: true,
        impersonating: {
          id: target.id,
          name: target.name,
          email: target.email,
          role: target.role,
          entityName,
        },
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    console.error("Impersonate error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET — list users available for impersonation
export async function GET() {
  try {
    const user = await getRealUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    // Get all active users grouped by role
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
        labId: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    // Check if currently impersonating
    const cookieStore = await cookies();
    const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value || null;

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        entityName:
          u.brand?.name ||
          u.factory?.name ||
          u.distributor?.name ||
          u.lab?.name ||
          null,
      })),
      currentImpersonation: impersonateId,
    });
  } catch (e: any) {
    console.error("Impersonate list error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

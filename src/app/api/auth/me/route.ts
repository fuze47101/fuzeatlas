// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";

const IMPERSONATE_COOKIE = "fuze-impersonate";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // Check for impersonation cookie
    const cookieStore = await cookies();
    const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value || null;

    // If admin is impersonating someone, return the impersonated user's data
    if (impersonateId && sessionUser.role === "ADMIN") {
      const target = await prisma.user.findUnique({
        where: { id: impersonateId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          mustChangePassword: true,
          emailVerified: true,
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

      if (target) {
        const entityName =
          target.brand?.name ||
          target.factory?.name ||
          target.distributor?.name ||
          target.lab?.name ||
          null;

        return NextResponse.json({
          ok: true,
          user: {
            id: target.id,
            name: target.name,
            email: target.email,
            role: target.role,
            status: target.status,
            mustChangePassword: false, // never show this when impersonating
            emailVerified: target.emailVerified,
            brandId: target.brandId,
            factoryId: target.factoryId,
            distributorId: target.distributorId,
            labId: target.labId,
          },
          impersonating: {
            active: true,
            targetName: target.name,
            targetRole: target.role,
            targetEmail: target.email,
            entityName,
            realAdmin: {
              id: sessionUser.id,
              name: sessionUser.name,
              email: sessionUser.email,
            },
          },
        });
      }

      // If target user not found, clear the cookie and fall through
      cookieStore.delete(IMPERSONATE_COOKIE);
    }

    // Normal flow — return the actual logged-in user
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        emailVerified: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user, impersonating: null });
  } catch (e: any) {
    console.error("Auth me error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

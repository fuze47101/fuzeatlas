// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser, hasMinRole } from "@/lib/auth";

export async function GET() {
  try {
    // Admin/staff permission gate — use the REAL session user so
    // View-As doesn't lock admins out of the user list.
    const currentUser = await getRealUser();
    if (!currentUser || !hasMinRole(currentUser.role, "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        canClaim: true,
        canApproveTests: true,
        emailVerified: true,
        emailVerifiedAt: true,
        emailBounceCount: true,
        brandId: true,
        factoryId: true,
        distributorId: true,
        labId: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
        distributor: { select: { name: true } },
        lab: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

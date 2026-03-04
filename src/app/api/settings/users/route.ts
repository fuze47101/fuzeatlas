// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
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
        brandId: true,
        factoryId: true,
        distributorId: true,
        brand: { select: { name: true } },
        factory: { select: { name: true } },
        distributor: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

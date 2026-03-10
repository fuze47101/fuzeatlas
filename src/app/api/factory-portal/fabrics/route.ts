// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";

    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Admin can optionally pass ?factoryId= to view a specific factory's fabrics
    const url0 = new URL(req.url);
    const factoryId = isAdmin
      ? url0.searchParams.get("factoryId") || user.factoryId
      : user.factoryId;

    if (!factoryId) {
      return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    }

    // Optional search filter
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";

    const where: any = { factoryId };

    if (search) {
      where.OR = [
        { customerCode: { contains: search, mode: "insensitive" } },
        { construction: { contains: search, mode: "insensitive" } },
        { factoryCode: { contains: search, mode: "insensitive" } },
        { note: { contains: search, mode: "insensitive" } },
      ];
      const numSearch = parseInt(search);
      if (!isNaN(numSearch)) {
        where.OR.push({ fuzeNumber: numSearch });
      }
    }

    const fabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        note: true,
        weightGsm: true,
        widthInches: true,
        construction: true,
        yarnType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, fabrics });
  } catch (e: any) {
    console.error("Factory fabrics error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

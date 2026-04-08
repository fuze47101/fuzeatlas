// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/distributors/[id] — single distributor detail
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const d = await prisma.distributor.findUnique({
      where: { id },
      include: {
        inventory: true,
        pricing: true,
        factories: { select: { id: true, name: true, country: true } },
        contacts: true,
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!d) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, distributor: d });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/distributors/[id] — update distributor fields
 *
 * Body: { name?, chineseName?, country?, region?, city?, address?,
 *         email?, phone?, website?, status?, active?, coverageCountries?, localCurrency?, notes? }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();

    // Whitelist updatable fields
    const allowed = [
      "name", "chineseName", "specialty", "country", "region", "city", "address",
      "email", "phone", "website", "status", "active", "coverageCountries", "localCurrency", "notes",
    ];

    const data: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        // coverageCountries comes as array, store as JSON string
        if (key === "coverageCountries" && Array.isArray(body[key])) {
          data[key] = JSON.stringify(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.distributor.update({
      where: { id },
      data,
      select: {
        id: true, name: true, chineseName: true, country: true, region: true,
        city: true, address: true, email: true, phone: true, website: true,
        status: true, active: true, coverageCountries: true, localCurrency: true, notes: true,
      },
    });

    return NextResponse.json({ ok: true, distributor: updated });
  } catch (e: any) {
    console.error("Distributor update error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Update failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/distributors/[id] — deactivate (not hard delete)
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    await prisma.distributor.update({
      where: { id },
      data: { active: false, status: "INACTIVE" },
    });

    return NextResponse.json({ ok: true, message: "Distributor deactivated" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

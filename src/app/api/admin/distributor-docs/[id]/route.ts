// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET /api/admin/distributor-docs/[id] ── single document detail ── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isDistributor = user.role === "DISTRIBUTOR_USER";

    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const doc = await prisma.distributorDocument.findUnique({
      where: { id },
      include: {
        distributor: {
          select: {
            id: true, name: true, country: true, region: true,
            contactName: true, contactEmail: true, phone: true, address: true,
          },
        },
        factory: {
          select: { id: true, name: true, country: true, city: true, address: true },
        },
      },
    });

    if (!doc) return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });

    // Distributor users can only see their own docs
    if (isDistributor && doc.distributorId !== user.distributorId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

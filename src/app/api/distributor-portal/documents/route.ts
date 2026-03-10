// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "DISTRIBUTOR_USER") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const distributorId = user.distributorId;
    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const docType = url.searchParams.get("docType") || "";
    const search = url.searchParams.get("search") || "";

    const where: any = { distributorId };
    if (docType) where.docType = docType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { batchNumber: { contains: search, mode: "insensitive" } },
        { poNumber: { contains: search, mode: "insensitive" } },
        { shipmentRef: { contains: search, mode: "insensitive" } },
      ];
    }

    const documents = await prisma.distributorDocument.findMany({
      where,
      select: {
        id: true,
        docType: true,
        title: true,
        description: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        url: true,
        shipmentRef: true,
        batchNumber: true,
        poNumber: true,
        portOfOrigin: true,
        portOfDest: true,
        hsCode: true,
        expiresAt: true,
        createdAt: true,
        factory: { select: { id: true, name: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, documents });
  } catch (e: any) {
    console.error("Distributor documents error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

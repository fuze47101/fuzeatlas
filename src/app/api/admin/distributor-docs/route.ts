// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

// GET: List all distributor documents (admin view)
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const distributorId = url.searchParams.get("distributorId") || "";
    const docType = url.searchParams.get("docType") || "";

    const where: any = {};
    if (distributorId) where.distributorId = distributorId;
    if (docType) where.docType = docType;

    const documents = await prisma.distributorDocument.findMany({
      where,
      include: {
        distributor: { select: { id: true, name: true, country: true } },
        factory: { select: { id: true, name: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all distributors for dropdown
    const distributors = await prisma.distributor.findMany({
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
    });

    // Get factories for dropdown
    const factories = await prisma.factory.findMany({
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, documents, distributors, factories });
  } catch (e: any) {
    console.error("Admin distributor docs error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST: Create a new distributor document entry
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "EMPLOYEE")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      distributorId, docType, title, description,
      filename, contentType, sizeBytes, url,
      factoryId, invoiceId,
      shipmentRef, batchNumber, poNumber,
      portOfOrigin, portOfDest, hsCode,
      expiresAt,
    } = body;

    if (!distributorId) {
      return NextResponse.json({ ok: false, error: "Distributor is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const doc = await prisma.distributorDocument.create({
      data: {
        distributorId,
        docType: docType || "OTHER",
        title,
        description: description || null,
        filename: filename || null,
        contentType: contentType || null,
        sizeBytes: sizeBytes || null,
        url: url || null,
        factoryId: factoryId || null,
        invoiceId: invoiceId || null,
        shipmentRef: shipmentRef || null,
        batchNumber: batchNumber || null,
        poNumber: poNumber || null,
        portOfOrigin: portOfOrigin || null,
        portOfDest: portOfDest || null,
        hsCode: hsCode || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        uploadedBy: user.id,
      },
      include: {
        distributor: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    console.error("Create distributor doc error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

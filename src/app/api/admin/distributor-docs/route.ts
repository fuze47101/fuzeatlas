// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";
import { uploadToS3, generateS3Key, isS3Configured, S3_PREFIXES } from "@/lib/s3";

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
      filename, contentType, sizeBytes, url, base64Data,
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

    // Upload file to S3 if base64 data is provided
    let fileUrl = url || null;
    let s3Bucket: string | null = null;
    let s3Key: string | null = null;

    if (base64Data && isS3Configured()) {
      const buffer = Buffer.from(base64Data, "base64");
      const key = generateS3Key(S3_PREFIXES.DISTRIBUTOR_DOCS, filename || "document.pdf", distributorId);
      const s3Result = await uploadToS3(key, buffer, contentType || "application/pdf", {
        distributorId,
        docType: docType || "OTHER",
        originalFilename: filename || "document.pdf",
      });
      fileUrl = s3Result.url;
      s3Bucket = s3Result.bucket;
      s3Key = s3Result.key;
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
        url: fileUrl,
        bucket: s3Bucket,
        key: s3Key,
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

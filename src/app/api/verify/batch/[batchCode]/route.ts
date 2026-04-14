// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Batch QR verification endpoint.
 * Requires Atlas auth (any registered user: admin, factory, brand,
 * distributor, lab). Returns batch details + batch COA + master TDS/SDS.
 * Logs each scan to BatchScanLog for traceability auditing.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchCode: string }> }
) {
  try {
    const { batchCode } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please log in to Atlas to view batch details", needsAuth: true }, { status: 401 });
    }

    const batch = await prisma.productionBatch.findUnique({
      where: { batchCode },
      select: {
        id: true, batchCode: true, productionDate: true,
        volumeProducedLiters: true, bottlesFilled: true,
        coaDocUrl: true, coaUploadedAt: true,
        concentrationMgPerL: true, qcPassed: true,
        notes: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
    }

    // Master docs (TDS / SDS) — product-wide
    const productDocs = await prisma.productDocument.findMany({
      where: { docType: { in: ["TDS", "SDS", "PRODUCT_SPEC"] } },
      orderBy: { docType: "asc" },
    });

    // Log the scan (fire and forget)
    const headers = Object.fromEntries(req.headers.entries());
    prisma.batchScanLog.create({
      data: {
        batchId: batch.id,
        userId: user.id,
        userName: user.name || user.email,
        userRole: user.role,
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || null,
        userAgent: headers["user-agent"] || null,
        location: user.factoryId ? "Factory" : user.distributorId ? "Distributor" : user.brandId ? "Brand" : "Internal",
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, batch, productDocs });
  } catch (e: any) {
    console.error("Batch verify error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

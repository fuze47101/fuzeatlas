// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Production Batch Management
 *
 * GET  /api/admin/batches       — list batches (most recent first)
 * POST /api/admin/batches       — create a new batch
 * PATCH /api/admin/batches      — update batch (COA upload, QC, notes)
 */

function generateBatchCode() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FB-${ymd}-${rand}`;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    // Admin/Employee/Distributor all allowed to read batch list (distributors
    // need it when selecting which batch they're shipping from).
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "DISTRIBUTOR_USER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }
    const batches = await prisma.productionBatch.findMany({
      orderBy: { productionDate: "desc" },
      include: {
        _count: { select: { orders: true, scans: true } },
      },
      take: 200,
    });
    return NextResponse.json({ ok: true, batches });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json();
    const {
      batchCode,
      productionDate,
      volumeProducedLiters,
      bottlesFilled,
      concentrationMgPerL,
      qcPassed,
      qcNotes,
      notes,
      coaDocUrl,
      ablationRunIds,
    } = body;

    const batch = await prisma.productionBatch.create({
      data: {
        batchCode: batchCode || generateBatchCode(),
        productionDate: productionDate ? new Date(productionDate) : new Date(),
        volumeProducedLiters: Number(volumeProducedLiters) || 0,
        bottlesFilled: bottlesFilled ? Number(bottlesFilled) : null,
        concentrationMgPerL: concentrationMgPerL ? Number(concentrationMgPerL) : 30,
        qcPassed: qcPassed !== false,
        qcNotes: qcNotes || null,
        notes: notes || null,
        coaDocUrl: coaDocUrl || null,
        coaUploadedAt: coaDocUrl ? new Date() : null,
        coaUploadedById: coaDocUrl ? user.id : null,
        ablationRunIds: ablationRunIds || null,
      },
    });
    return NextResponse.json({ ok: true, batch });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json();
    const { id, ...updates } = body;
    const data: any = {};
    if (updates.coaDocUrl !== undefined) {
      data.coaDocUrl = updates.coaDocUrl;
      data.coaUploadedAt = new Date();
      data.coaUploadedById = user.id;
    }
    if (updates.qcPassed !== undefined) data.qcPassed = updates.qcPassed;
    if (updates.qcNotes !== undefined) data.qcNotes = updates.qcNotes;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.bottlesFilled !== undefined) data.bottlesFilled = Number(updates.bottlesFilled);
    if (updates.volumeProducedLiters !== undefined) data.volumeProducedLiters = Number(updates.volumeProducedLiters);
    const batch = await prisma.productionBatch.update({ where: { id }, data });
    return NextResponse.json({ ok: true, batch });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

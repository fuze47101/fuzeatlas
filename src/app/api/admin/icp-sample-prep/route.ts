// @ts-nocheck
/**
 * ICP Sample Prep API — creates a single FUZE PO with one
 * TestRequestLine per fabric, so CTLA can be billed per fabric
 * submission number while we track the whole batch as one PO.
 *
 * POST /api/admin/icp-sample-prep
 *   body: {
 *     labSlug: "CTLA",            // defaults to CTLA; auto-upserts the lab
 *     priority: "NORMAL" | "HIGH" | "URGENT",
 *     rush: boolean,
 *     notes: string,
 *     samples: [{
 *       fabricId: string,
 *       sampleMassG: number,     // > 5 g target
 *       sampleAreaCm2: number,   // default 100
 *       tier: "F1"|"F2"|"F3"|"F4",
 *       benchTestId?: string,    // optional link to RecipeBenchTest
 *       notes?: string,
 *     }]
 *   }
 *
 * GET /api/admin/icp-sample-prep?poNumber=FUZE-PO-YYYYMMDD-NNNN
 *   returns the PO + lines + fabric details for printing/review
 */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── CTLA lab — upsert on first submit so we don't need a migration ──
async function ensureCtlaLab() {
  const existing = await prisma.lab.findFirst({
    where: {
      OR: [
        { name: "CTLA Laboratories" },
        { name: "CTLA" },
        { name: { startsWith: "CTLA", mode: "insensitive" } },
      ],
    },
  });
  if (existing) return existing;
  return prisma.lab.create({
    data: {
      name: "CTLA Laboratories",
      address: "Utah",
      city: "Salt Lake City",
      state: "UT",
      country: "USA",
      region: "North America",
      capabilities: "ICP",
      icpApproved: true,
      active: true,
      notes: "Auto-created by ICP Sample Prep wizard. ICP-MS / microwave aqua-regia digest. Bills per fabric submission number.",
    },
  });
}

// ─── PO number generator ─────────────────────────
async function generatePoNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `FUZE-PO-${dateStr}-`;
  const latest = await prisma.testRequest.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  let seq = 1;
  if (latest?.poNumber) {
    const lastSeq = parseInt(latest.poNumber.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { labSlug = "CTLA", priority = "NORMAL", rush = false, notes, samples } = body;

    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one sample is required" }, { status: 400 });
    }
    for (const s of samples) {
      if (!s.fabricId) return NextResponse.json({ ok: false, error: "Every sample must have a fabricId" }, { status: 400 });
      if (!s.sampleMassG || Number(s.sampleMassG) <= 0) {
        return NextResponse.json({ ok: false, error: `Sample ${s.fabricId} missing a valid mass` }, { status: 400 });
      }
    }

    // 1. Resolve lab (default CTLA)
    const lab = labSlug.toUpperCase().startsWith("CTLA")
      ? await ensureCtlaLab()
      : await prisma.lab.findFirst({ where: { name: { equals: labSlug, mode: "insensitive" } } });

    if (!lab) {
      return NextResponse.json({ ok: false, error: `Lab "${labSlug}" not found` }, { status: 400 });
    }

    // 2. Grab fabric details for every sample in one query
    const fabrics = await prisma.fabric.findMany({
      where: { id: { in: samples.map((s: any) => s.fabricId) } },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        construction: true,
        color: true,
        weightGsm: true,
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
    });
    const fabricMap = new Map(fabrics.map((f) => [f.id, f]));

    // 3. ICP-OES/MS pricing from LabService if configured
    const services = await prisma.labService.findMany({
      where: { labId: lab.id, testType: "ICP" },
    });
    const icpService = services[0];
    const unitPrice = icpService?.priceUSD ?? null;
    const rushPrice = rush ? (icpService?.rushPriceUSD ?? null) : null;
    const estimatedDays = rush ? (icpService?.rushDays ?? icpService?.turnaroundDays ?? 5) : (icpService?.turnaroundDays ?? 10);

    const userId = request.headers.get("x-user-id") || null;
    const poNumber = await generatePoNumber();

    // 4. Create PO — fabricId at top level is left null (batch spans many fabrics);
    //    each line carries its own fabric identity in notes + description.
    const estimatedCost = samples.reduce((sum: number, _s: any) => sum + (unitPrice ?? 0) + (rushPrice ?? 0), 0);

    const lineData = samples.map((s: any) => {
      const f = fabricMap.get(s.fabricId);
      const fuzeLabel = f?.fuzeNumber ? `FUZE-${f.fuzeNumber}` : "(unknown)";
      const customerCode = f?.customerCode ? ` / ${f.customerCode}` : "";
      const lineMeta = {
        kind: "icp-sample-prep",
        fabricId: s.fabricId,
        fuzeNumber: f?.fuzeNumber ?? null,
        customerCode: f?.customerCode ?? null,
        factoryCode: f?.factoryCode ?? null,
        color: f?.color ?? null,
        construction: f?.construction ?? null,
        weightGsm: f?.weightGsm ?? null,
        brandName: f?.brand?.name ?? null,
        factoryName: f?.factory?.name ?? null,
        sampleMassG: Number(s.sampleMassG),
        sampleAreaCm2: Number(s.sampleAreaCm2 || 100),
        digestTargetG: 0.5,
        tier: s.tier || null,
        benchTestId: s.benchTestId || null,
        sampleNotes: s.notes || null,
      };
      return {
        testType: "ICP",
        testMethod: "ICP-MS · Microwave Aqua Regia Digest",
        description: `ICP-MS Ag (mg/kg) · ${fuzeLabel}${customerCode} · ${lineMeta.sampleMassG.toFixed(2)} g sample`,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice != null ? unitPrice + (rushPrice || 0) : null,
        rush,
        rushPrice,
        estimatedDays,
        notes: JSON.stringify(lineMeta),
      };
    });

    const testRequest = await prisma.testRequest.create({
      data: {
        poNumber,
        labId: lab.id,
        labCustomerNumber: lab.customerNumber || null,
        status: "PENDING_APPROVAL",
        requestedById: userId,
        requestedAt: new Date(),
        priority,
        estimatedCost,
        currency: "USD",
        specialInstructions: [
          "ICP-MS quantitative determination of silver (Ag) on FUZE-treated fabric.",
          "Microwave-assisted aqua regia digest, 0.5 g per digest run.",
          "Report result in mg/kg fabric (ppm) per fabric submission number (see line items).",
          "Invoice per fabric submission number (Atlas PO line) so we can reconcile in Atlas.",
          notes ? `Tech notes: ${notes}` : null,
        ].filter(Boolean).join("\n"),
        internalNotes: JSON.stringify({ kind: "icp-sample-prep-batch", sampleCount: samples.length }),
        lines: { create: lineData },
      },
      include: {
        lab: true,
        lines: true,
      },
    });

    return NextResponse.json({ ok: true, testRequest, poNumber, lab });
  } catch (e: any) {
    console.error("ICP Sample Prep POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const poNumber = url.searchParams.get("poNumber");
    const recent = url.searchParams.get("recent") === "1";

    if (poNumber) {
      const tr = await prisma.testRequest.findUnique({
        where: { poNumber },
        include: {
          lab: true,
          lines: true,
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      });
      if (!tr) return NextResponse.json({ ok: false, error: "PO not found" }, { status: 404 });
      return NextResponse.json({ ok: true, testRequest: tr });
    }

    if (recent) {
      const list = await prisma.testRequest.findMany({
        where: {
          internalNotes: { contains: "icp-sample-prep-batch" },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          lab: { select: { name: true } },
          _count: { select: { lines: true } },
        },
      });
      return NextResponse.json({ ok: true, requests: list });
    }

    return NextResponse.json({ ok: false, error: "Provide ?poNumber or ?recent=1" }, { status: 400 });
  } catch (e: any) {
    console.error("ICP Sample Prep GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

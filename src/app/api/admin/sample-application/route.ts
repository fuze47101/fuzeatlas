// @ts-nocheck
/**
 * SAMPLE APPLICATION API
 *
 * A SampleApplication is the physical act of padding a fabric sample
 * through the FUZE vertical micro-padder and drying it in the dryer
 * chamber before it ships to CTLA for ICP validation.
 *
 * The recipe (pickup %, per-tier dilution, padder settings) is pulled
 * directly from a validated RecipeBenchTest — no re-derivation in the
 * lab. Operator just confirms the bath, pads, dries, saves.
 *
 * Routes:
 *   POST /api/admin/sample-application
 *     body: { fabricId, benchTestId, tier, bathVolumeL, operator?, notes? }
 *     → creates the record with fuzeMl/waterMl/bathConcentration computed
 *       from the bench test and stamps paddedAt + driedAt to now.
 *
 *   PATCH /api/admin/sample-application?id=...
 *     body: { paddedAt? | driedAt? | notes? | operator? }
 *     → used by the wizard to stamp "pad complete" then "dry complete"
 *       as Ashlee works through the bench.
 *
 *   GET /api/admin/sample-application?id=...   → single record w/ joins
 *   GET /api/admin/sample-application?fabricId=... → all applications for a fabric
 *   GET /api/admin/sample-application?recent=1 → last 25 for the dashboard
 */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STOCK_MG_PER_L = 30;
const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };

// ─── APP number generator — FUZE-APP-YYYYMMDD-NNNN ─────────
async function generateAppNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `FUZE-APP-${dateStr}-`;
  const latest = await prisma.sampleApplication.findFirst({
    where: { appNumber: { startsWith: prefix } },
    orderBy: { appNumber: "desc" },
    select: { appNumber: true },
  });
  let seq = 1;
  if (latest?.appNumber) {
    const lastSeq = parseInt(latest.appNumber.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// Given a bench test record + chosen tier + bath volume, compute the
// actual mL of FUZE stock + mL of DI water to prepare the bath.
//
//   bath_conc (mg/L) = tier_mg_per_kg / (pickupDryToWetPct / 100)
//   fuzeMl = bathVolumeL * (bath_conc / stock_mg_per_L) * 1000
//   waterMl = bathVolumeL * 1000 - fuzeMl
function computeBath(bench: any, tier: string, bathVolumeL: number) {
  const stock = bench.stockMgPerL || STOCK_MG_PER_L;
  const pickup = bench.pickupDryToWetPct;
  const mgPerKg = TIER_MG_PER_KG[tier];
  if (!pickup || pickup <= 0) {
    throw new Error("Bench test has no pickupDryToWetPct — cannot compute bath");
  }
  if (!mgPerKg) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  const bathMgPerL = mgPerKg / (pickup / 100);
  const fuzeMl = bathVolumeL * (bathMgPerL / stock) * 1000;
  const waterMl = bathVolumeL * 1000 - fuzeMl;
  return {
    stockMgPerL: stock,
    bathConcentrationMgPerL: round(bathMgPerL, 4),
    fuzeMl: round(fuzeMl, 2),
    waterMl: round(waterMl, 2),
  };
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fabricId, benchTestId, tier, bathVolumeL = 1.0, operator, notes, stampLifecycle = true } = body;

    if (!fabricId) return NextResponse.json({ ok: false, error: "fabricId is required" }, { status: 400 });
    if (!benchTestId) return NextResponse.json({ ok: false, error: "benchTestId is required" }, { status: 400 });
    if (!tier || !TIER_MG_PER_KG[tier]) {
      return NextResponse.json({ ok: false, error: "tier must be F1, F2, F3, or F4" }, { status: 400 });
    }
    const vol = Number(bathVolumeL);
    if (!Number.isFinite(vol) || vol <= 0) {
      return NextResponse.json({ ok: false, error: "bathVolumeL must be a positive number" }, { status: 400 });
    }

    const bench = await prisma.recipeBenchTest.findUnique({ where: { id: benchTestId } });
    if (!bench) return NextResponse.json({ ok: false, error: "benchTestId not found" }, { status: 404 });

    const recipe = computeBath(bench, tier, vol);
    const appNumber = await generateAppNumber();
    const now = new Date();
    const userId = req.headers.get("x-user-id") || null;

    const record = await prisma.sampleApplication.create({
      data: {
        appNumber,
        fabricId,
        benchTestId,
        tier,
        bathVolumeL: vol,
        stockMgPerL: recipe.stockMgPerL,
        bathConcentrationMgPerL: recipe.bathConcentrationMgPerL,
        fuzeMl: recipe.fuzeMl,
        waterMl: recipe.waterMl,
        // Padder settings — read from bench test, snapshot onto this application
        squeezePressure: bench.squeezePressure ?? null,
        vfdFrequencyHz: bench.vfdFrequencyHz ?? null,
        lineSpeedMPerMin: bench.lineSpeedMPerMin ?? null,
        pickupDryToWetPct: bench.pickupDryToWetPct ?? null,
        // Lifecycle — if caller says "I'm recording a run I already did", stamp both;
        // if they're stepping through the wizard, leave null and PATCH in two hits.
        paddedAt: stampLifecycle ? now : null,
        driedAt: stampLifecycle ? now : null,
        operator: operator || null,
        notes: notes || null,
        createdById: userId,
      },
      include: {
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true, construction: true, color: true, weightGsm: true } },
        benchTest: { select: { id: true, testNumber: true, applicationMethod: true } },
      },
    });

    return NextResponse.json({ ok: true, sampleApplication: record, appNumber });
  } catch (e: any) {
    console.error("SampleApplication POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "?id= required" }, { status: 400 });

    const body = await req.json();
    const data: any = {};
    if (body.paddedAt !== undefined) data.paddedAt = body.paddedAt ? new Date(body.paddedAt) : null;
    if (body.driedAt !== undefined) data.driedAt = body.driedAt ? new Date(body.driedAt) : null;
    if (body.operator !== undefined) data.operator = body.operator || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const record = await prisma.sampleApplication.update({ where: { id }, data });
    return NextResponse.json({ ok: true, sampleApplication: record });
  } catch (e: any) {
    console.error("SampleApplication PATCH error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const fabricId = url.searchParams.get("fabricId");
    const recent = url.searchParams.get("recent") === "1";

    if (id) {
      const record = await prisma.sampleApplication.findUnique({
        where: { id },
        include: {
          fabric: {
            select: {
              id: true, fuzeNumber: true, customerCode: true, factoryCode: true,
              construction: true, color: true, weightGsm: true, widthInches: true,
              brand: { select: { id: true, name: true } },
              factory: { select: { id: true, name: true } },
            },
          },
          benchTest: true,
        },
      });
      if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true, sampleApplication: record });
    }

    if (fabricId) {
      const list = await prisma.sampleApplication.findMany({
        where: { fabricId },
        orderBy: { createdAt: "desc" },
        include: { benchTest: { select: { id: true, testNumber: true } } },
      });
      return NextResponse.json({ ok: true, sampleApplications: list });
    }

    if (recent) {
      const list = await prisma.sampleApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          fabric: { select: { id: true, fuzeNumber: true, customerCode: true, construction: true, color: true } },
          benchTest: { select: { id: true, testNumber: true } },
        },
      });
      return NextResponse.json({ ok: true, sampleApplications: list });
    }

    return NextResponse.json({ ok: false, error: "Provide ?id, ?fabricId, or ?recent=1" }, { status: 400 });
  } catch (e: any) {
    console.error("SampleApplication GET error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

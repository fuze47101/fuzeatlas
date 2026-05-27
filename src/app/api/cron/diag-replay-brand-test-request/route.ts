// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/POST /api/cron/diag-replay-brand-test-request
 *
 * Bearer-authed Kaylee-Pace-replay probe. Walks the EXACT
 * /api/brand-portal/test-request POST pipeline against the prod DB
 * but rolls back at the end. Surfaces the underlying Prisma error
 * with its full message + meta + code so we can target the fix
 * without poking at Vercel runtime logs (which truncate the body).
 *
 * Query params (or POST body):
 *   fabricId  default cmpog8kwr0005jx04y03hwjs7 (Kaylee's FUZE-2576)
 *   labName   default 'FUZE Atlas Lab' (matches by name contains)
 *   testType  default ANTIBACTERIAL
 *   testMethod default AATCC 100
 */
const CRON_SECRET = process.env.CRON_SECRET;

async function handle(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const fabricId = url.searchParams.get("fabricId") || "cmpog8kwr0005jx04y03hwjs7";
  const labName = url.searchParams.get("labName") || "FUZE Atlas Lab";
  const testType = url.searchParams.get("testType") || "ANTIBACTERIAL";
  const testMethod = url.searchParams.get("testMethod") || "AATCC 100";

  const trace: any[] = [];
  try {
    // 1. Pull fabric
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true, brandId: true, factoryId: true },
    });
    trace.push({ step: "fabric.findUnique", ok: !!fabric, fabric });
    if (!fabric) return NextResponse.json({ ok: false, trace, error: "fabric not found" }, { status: 404 });

    // 2. Find/create a lab matching the name (don't actually create — read-only probe)
    const lab = await prisma.lab.findFirst({
      where: { OR: [{ name: { contains: labName, mode: "insensitive" } }, { name: { contains: "FUZE", mode: "insensitive" } }] },
      select: { id: true, name: true, customerNumber: true },
    });
    trace.push({ step: "lab.findFirst", ok: !!lab, lab });
    if (!lab) return NextResponse.json({ ok: false, trace, error: "no matching lab found" }, { status: 404 });

    // 3. Look up lab services (informational)
    const labServices = await prisma.labService.findMany({ where: { labId: lab.id, testType }, take: 5 });
    trace.push({ step: "labService.findMany", count: labServices.length });

    // 4. Find or stage a FabricSubmission (do not write — dry-run only)
    const submission = await prisma.fabricSubmission.findFirst({
      where: { fabricId: fabric.id, brandId: fabric.brandId || undefined },
      select: { id: true, brandId: true, factoryId: true, fabricId: true },
    });
    trace.push({ step: "fabricSubmission.findFirst", ok: !!submission, submission });

    // 5. Generate PO number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `FUZE-PO-DRYRUN-${dateStr}-`;
    const seq = Math.floor(Math.random() * 9000 + 1000);
    const poNumber = `${prefix}${seq}`;
    trace.push({ step: "poNumber", poNumber });

    // 6. Replay the create inside a transaction we WILL roll back.
    let prismaError: any = null;
    try {
      await prisma.$transaction(async (tx) => {
        const replaySubmission =
          submission ||
          (await tx.fabricSubmission.create({
            data: {
              brandId: fabric.brandId,
              factoryId: fabric.factoryId,
              fabricId: fabric.id,
              fuzeFabricNumber: fabric.fuzeNumber ?? null,
              customerFabricCode: fabric.customerCode || null,
              factoryFabricCode: fabric.factoryCode || null,
              status: "Submitted",
              testStatus: "PENDING",
              progressPercent: 10,
            },
          }));
        trace.push({ step: "tx.fabricSubmission resolved", id: replaySubmission.id });

        const testRequest = await tx.testRequest.create({
          data: {
            poNumber,
            brandId: fabric.brandId,
            fabricId: fabric.id,
            submissionId: replaySubmission.id,
            labId: lab.id,
            status: "PENDING_APPROVAL",
            requestedAt: new Date(),
            priority: "NORMAL",
            estimatedCost: 0,
            fuzeFabricNumber: fabric.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : null,
            customerFabricCode: fabric.customerCode || null,
            factoryFabricCode: fabric.factoryCode || null,
            lines: {
              create: [{
                testType,
                testMethod,
                description: "dry-run replay",
                quantity: 1,
                unitPrice: null,
                totalPrice: null,
                rush: false,
                rushPrice: null,
                estimatedDays: null,
              }],
            },
          },
          select: { id: true, poNumber: true },
        });
        trace.push({ step: "tx.testRequest.create", id: testRequest.id, poNumber: testRequest.poNumber });

        // Roll back the dry-run.
        throw new Error("__DRY_RUN_ROLLBACK__");
      });
    } catch (e: any) {
      if (e?.message === "__DRY_RUN_ROLLBACK__") {
        trace.push({ step: "ROLLBACK", verdict: "create path succeeded end-to-end — no Prisma error" });
        return NextResponse.json({ ok: true, dryRun: "succeeded then rolled back", trace });
      }
      prismaError = e;
    }

    return NextResponse.json({
      ok: false,
      verdict: "Prisma error during create path",
      error: {
        message: prismaError?.message || String(prismaError),
        code: prismaError?.code || null,
        meta: prismaError?.meta || null,
        clientVersion: prismaError?.clientVersion || null,
        stackHead: String(prismaError?.stack || "").split("\n").slice(0, 8).join("\n"),
      },
      trace,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      verdict: "fatal outside transaction",
      error: { message: e?.message, stackHead: String(e?.stack || "").split("\n").slice(0, 5).join("\n") },
      trace,
    }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

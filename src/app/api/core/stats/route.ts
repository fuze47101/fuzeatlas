import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [
      fabrics,
      fabricContents,
      submissions,
      testRuns,
      icpResults,
      abResults,
      brands,
      factories,
      labs,
      contacts,
      distributors,
      documents,
      sourceRecords,
    ] = await Promise.all([
      prisma.fabric.count(),
      prisma.fabricContent.count(),
      prisma.fabricSubmission.count(),
      prisma.testRun.count(),
      prisma.icpResult.count(),
      prisma.antibacterialResult.count(),
      prisma.brand.count(),
      prisma.factory.count(),
      prisma.lab.count(),
      prisma.contact.count(),
      prisma.distributor.count(),
      prisma.document.count(),
      prisma.sourceRecord.count(),
    ]);

    const data = {
      ts: new Date().toISOString(),
      counts: {
        fabrics,
        fabricContents,
        submissions,
        testRuns,
        icpResults,
        abResults,
        brands,
        factories,
        labs,
        contacts,
        distributors,
        documents,
        sourceRecords,
      },
    };

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "stats_error", ts: new Date().toISOString() },
      { status: 500 }
    );
  }
}

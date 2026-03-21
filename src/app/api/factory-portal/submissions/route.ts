// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "FACTORY_USER" && user.role !== "FACTORY_MANAGER")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const factoryId = user.factoryId;
    if (!factoryId) {
      return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    }

    const submissions = await prisma.fabricSubmission.findMany({
      where: {
        fabric: { factoryId },
      },
      include: {
        fabric: {
          select: {
            id: true,
            note: true,
            fuzeNumber: true,
            construction: true,
          },
        },
        testRequests: {
          select: {
            id: true,
            status: true,
            poNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform data
    const transformedSubmissions = submissions.map(s => ({
      id: s.id,
      status: s.status,
      fabric: s.fabric,
      createdAt: s.createdAt,
      testResults: s.testRequests.map(tr => ({
        testType: "FUZE Treatment",
        status: tr.status,
      })),
    }));

    return NextResponse.json({
      ok: true,
      submissions: transformedSubmissions,
    });
  } catch (e: any) {
    console.error("Factory submissions error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

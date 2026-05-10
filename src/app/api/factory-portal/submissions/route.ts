// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { submissionScopeForFactory } from "@/lib/acl";

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

    // ACL helper picks up fabrics submitted directly via intake
    // (FabricSubmission.factoryId set, Fabric.factoryId often null).
    // Old query only checked Fabric.factoryId — same shape of bug
    // that bit Tina's tests page (c0f67e6).
    const submissions = await prisma.fabricSubmission.findMany({
      where: submissionScopeForFactory(factoryId),
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

    // Transform data — Phase 7F surfaces approval status alongside
    // the operational status so factories see what the brand is
    // sitting on.
    const transformedSubmissions = submissions.map((s: any) => ({
      id: s.id,
      status: s.status,
      fabric: s.fabric,
      createdAt: s.createdAt,
      brandApprovalStatus: s.brandApprovalStatus || null,
      brandRejectionReason: s.brandRejectionReason || null,
      testResults: s.testRequests.map((tr: any) => ({
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

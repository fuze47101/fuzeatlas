// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: {
      churnRiskScore: true,
      churnRiskReasoning: true,
      churnRiskUpdatedAt: true,
    },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    score: brand.churnRiskScore,
    reasoning: brand.churnRiskReasoning,
    updatedAt: brand.churnRiskUpdatedAt,
  });
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["LAB_USER", "LAB_MANAGER"].includes(user.role) || !user.labId) {
    return NextResponse.json({ ok: false, error: "Lab access required" }, { status: 403 });
  }
  const credits = await prisma.labCredit.findMany({
    where: { labId: user.labId },
    orderBy: { createdAt: "desc" },
  });
  const balance = credits.reduce(
    (acc, c) => (c.spentAt ? acc : acc + (c.amountUsd || 0)),
    0,
  );
  return NextResponse.json({ ok: true, credits, balance });
}

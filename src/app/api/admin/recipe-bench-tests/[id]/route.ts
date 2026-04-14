// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }
    const test = await prisma.recipeBenchTest.findUnique({
      where: { id },
      include: { fabric: { select: { id: true, fuzeNumber: true, name: true } } },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

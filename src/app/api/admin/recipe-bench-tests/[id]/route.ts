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
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    // Any authenticated internal user can read a bench test (read-only)
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
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

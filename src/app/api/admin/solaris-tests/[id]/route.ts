// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const test = await prisma.solarisTest.findUnique({
      where: { id },
      include: { fabric: { select: { id: true, fuzeNumber: true, customerCode: true } } },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const body = await req.json();
    const test = await prisma.solarisTest.update({ where: { id }, data: body });
    return NextResponse.json({ ok: true, test });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadApprovalsForBrand } from "@/lib/approval-queue";

const READ_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BRAND_MANAGER"];

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!READ_ROLES.includes(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await props.params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, name: true, requiresApproval: true },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  const data = await loadApprovalsForBrand(id);
  return NextResponse.json({ ok: true, brand, ...data });
}

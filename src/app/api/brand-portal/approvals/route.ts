// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadApprovalsForBrand } from "@/lib/approval-queue";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.brandId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const data = await loadApprovalsForBrand(user.brandId);
  return NextResponse.json({ ok: true, ...data });
}

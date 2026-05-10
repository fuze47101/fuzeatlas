// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { explainEngagement } from "@/lib/brand-engagement";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const explanation = await explainEngagement(id);
  if (!explanation) {
    return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...explanation });
}

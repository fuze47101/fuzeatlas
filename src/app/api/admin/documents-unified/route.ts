// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/document-acl";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "TESTING_MANAGER"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") || undefined) as any;
  const q = url.searchParams.get("q") || undefined;
  const documents = await listDocumentsForUser(user as any, { category, q });
  return NextResponse.json({ ok: true, documents });
}

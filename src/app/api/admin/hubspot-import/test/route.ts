// @ts-nocheck
/**
 * GET /api/admin/hubspot-import/test
 *
 * Confirms HUBSPOT_API_KEY is set + the token works against HubSpot.
 * Run before kicking off a real import batch so the user sees a
 * helpful error instead of partial-progress confusion.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { testConnection } from "@/lib/hubspot-client";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Admin / employee only" },
        { status: 403 },
      );
    }
    const r = await testConnection();
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

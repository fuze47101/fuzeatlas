// @ts-nocheck
/**
 * GET /api/admin/dedupe/data
 *
 * ADMIN-only (impersonation-safe via getRealUser) read-only data endpoint for
 * the /admin/dedupe dashboard. Same scan as diag-duplicates. no-store so the
 * UI always reflects post-merge reality.
 */
import { NextResponse } from "next/server";
import { getRealUser } from "@/lib/auth";
import { scanDuplicates } from "@/lib/dedupe-scan";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRealUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }
  try {
    const result = await scanDuplicates();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}

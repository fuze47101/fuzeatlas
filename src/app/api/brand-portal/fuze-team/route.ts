// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveFuzeTeam } from "@/lib/fuze-team";

/* ── GET /api/brand-portal/fuze-team ───────────────────────────────
   Item 8 — returns the brand's FUZE-side people (Account Manager,
   Region Manager, Lab Manager, Exec Team) for the "Your FUZE Team"
   page. Scoped to the caller's brand.                                 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const brandId = user.brandId;
    if (!brandId) {
      return NextResponse.json(
        { ok: false, error: "No brand associated with this account" },
        { status: 403 },
      );
    }

    const team = await resolveFuzeTeam(brandId);
    return NextResponse.json({ ok: true, ...team });
  } catch (e: any) {
    console.error("[brand-portal/fuze-team] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load FUZE team" },
      { status: 500 },
    );
  }
}

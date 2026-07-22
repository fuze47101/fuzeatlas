// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveFuzeTeam } from "@/lib/fuze-team";

/* ── GET /api/brand-portal/fuze-team ───────────────────────────────
   Item 8 — returns the brand's FUZE-side people for the "Your FUZE
   Team" page: { accountManager, corporate[], regionalManagers[],
   technicalContacts[] }. Scoped to the caller's brand; region/technical
   sets are computed from the brand's factory countries.               */
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
